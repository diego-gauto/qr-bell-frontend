'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { withAuthRetry } from '@/features/auth/services/authService';
import { ROUTES } from '@/lib/constants/routes';
import { useAuthStore } from '@/store/authStore';
import { requireApiBaseUrl } from '@/lib/config/apiBaseUrl';
import { safeFetch } from '@/lib/net/safeFetch';
import { createOwnerCallSocket } from '@/lib/realtime/callSocket';
import { createAudioPeerConnection, getLocalAudioStream, stopStream } from '@/lib/webrtc/peer';

type CallStatus = 'accepted' | 'missed';
type VoiceState = 'idle' | 'waiting' | 'connecting' | 'connected' | 'ended';

interface CallPageProps {
  // This repo's Next types currently model `params` as a Promise in generated `.next/types`.
  params: Promise<{ callId: string }>;
}

interface ApiErrorPayload {
  message?: string | string[];
}

function getErrorMessage(payload: ApiErrorPayload, fallback: string): string {
  if (Array.isArray(payload.message)) {
    return payload.message.join(', ');
  }

  if (typeof payload.message === 'string' && payload.message.length > 0) {
    return payload.message;
  }

  return fallback;
}

async function updateCallStatusWithAccessToken(
  accessToken: string,
  callId: string,
  status: CallStatus
): Promise<void> {
  const API_BASE_URL = requireApiBaseUrl();
  const response = await safeFetch(`${API_BASE_URL}/api/calls/${encodeURIComponent(callId)}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'ngrok-skip-browser-warning': 'true',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  }, { apiBaseUrl: API_BASE_URL });

  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = {};
    }

    // Prefix status so `withAuthRetry` can detect 401.
    throw new Error(`${response.status}: ${getErrorMessage(payload, 'No se pudo actualizar el estado')}`);
  }
}

async function updateCallStatus(callId: string, status: CallStatus): Promise<void> {
  await withAuthRetry<void>((accessToken) => updateCallStatusWithAccessToken(accessToken, callId, status));
}

export default function CallPage({ params }: CallPageProps): React.JSX.Element {
  const router = useRouter();
  const { accessToken, isHydrated } = useAuthStore();
  const [callId, setCallId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [peerStatus, setPeerStatus] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const voiceStateRef = useRef<VoiceState>('idle');

  const socketRef = useRef<ReturnType<typeof createOwnerCallSocket> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    let isMounted = true;
    void params.then(({ callId: nextCallId }) => {
      if (isMounted) setCallId(nextCallId);
    });
    return () => {
      isMounted = false;
    };
  }, [params]);

  const canUseSocket = useMemo(() => Boolean(accessToken && callId), [accessToken, callId]);

  const cleanup = (): void => {
    try {
      socketRef.current?.disconnect();
    } catch {
      // ignore
    }
    socketRef.current = null;

    try {
      pcRef.current?.close();
    } catch {
      // ignore
    }
    pcRef.current = null;

    stopStream(localStreamRef.current);
    localStreamRef.current = null;

    stopStream(remoteStreamRef.current);
    remoteStreamRef.current = null;

    pendingIceRef.current = [];
    pendingOfferRef.current = null;
  };

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!accessToken) {
      const nextPath = callId ? `/call/${encodeURIComponent(callId)}` : ROUTES.dashboard;
      router.replace(`${ROUTES.login}?next=${encodeURIComponent(nextPath)}`);
    }
  }, [accessToken, callId, isHydrated, router]);

  useEffect(() => {
    if (!canUseSocket || socketRef.current) {
      return;
    }

    const socket = createOwnerCallSocket({ callId, accessToken: accessToken as string });
    socketRef.current = socket;

    socket.on('call:error', (payload) => {
      setError(payload.message || 'Error de señalizacion.');
    });

    socket.on('call:ended', () => {
      setVoiceState('ended');
      cleanup();
    });

    socket.on('call:peer_joined', (payload) => {
      if (payload.role === 'visitor') {
        setPeerStatus('Visitante conectado.');
      }
    });

    socket.on('call:peer_left', () => {
      setPeerStatus('Visitante desconectado.');
    });

    socket.on('webrtc:offer', async (payload) => {
      if (!payload?.sdp) return;
      if (!pcRef.current) {
        pendingOfferRef.current = payload.sdp;
        return;
      }

      try {
        await pcRef.current.setRemoteDescription(payload.sdp);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit('webrtc:answer', { sdp: answer });

        const pending = pendingIceRef.current;
        pendingIceRef.current = [];
        for (const candidate of pending) {
          try {
            await pcRef.current.addIceCandidate(candidate);
          } catch {
            // ignore
          }
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'No se pudo responder la llamada.';
        setError(message);
        setVoiceState('ended');
        cleanup();
      }
    });

    socket.on('webrtc:ice', async (payload) => {
      if (!payload?.candidate) return;
      if (!pcRef.current || !pcRef.current.remoteDescription) {
        pendingIceRef.current.push(payload.candidate);
        return;
      }
      try {
        await pcRef.current.addIceCandidate(payload.candidate);
      } catch {
        // ignore
      }
    });

    socket.on('webrtc:answer', async (payload) => {
      // Owner does not expect answers; ignore.
      void payload;
    });

    socket.on('connect', () => {
      setVoiceState('waiting');
      setPeerStatus(null);
    });

    return () => {
      cleanup();
    };
  }, [canUseSocket]);

  const startOwnerVoiceSession = async (): Promise<void> => {
    const socket = socketRef.current;
    if (!socket) {
      throw new Error('No hay conexion de señalizacion.');
    }

    const localStream = await getLocalAudioStream();
    localStreamRef.current = localStream;

    const pc = createAudioPeerConnection();
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'failed' || state === 'disconnected') {
        setError('No se pudo conectar la voz (red). Intenta nuevamente.');
        setVoiceState('ended');
        cleanup();
      }
    };

    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      remoteStreamRef.current = stream;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch((err) => {
          console.warn('[WebRTC] Autoplay bloqueado por el navegador', err);
          if (err.name === 'NotAllowedError') {
            setAudioBlocked(true);
          }
        });
      }
      setVoiceState('connected');
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:ice', { candidate: event.candidate.toJSON() });
      }
    };

    // If an offer arrived before we created the PC, process it now.
    const offer = pendingOfferRef.current;
    if (offer) {
      console.log('[WebRTC] Processing pending offer');
      pendingOfferRef.current = null;
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc:answer', { sdp: answer });
      
      // Process any ICE candidates that arrived before we had a remote description
      const pending = pendingIceRef.current;
      if (pending.length > 0) {
        console.log(`[WebRTC] Processing ${pending.length} pending ICE candidates`);
        pendingIceRef.current = [];
        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (e) {
            console.warn('[WebRTC] Failed to add pending ICE candidate', e);
          }
        }
      }
    }
  };

  const onUpdate = async (status: CallStatus): Promise<void> => {
    if (!callId) {
      setError('CallId invalido.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      if (status === 'accepted') {
        setVoiceState('connecting');
        // Persist "accepted" first so late-connecting visitors can replay state via gateway.
        await updateCallStatus(callId, 'accepted');
        // Reliability: re-emit accept a few times. If a client missed one realtime event,
        // it will still learn the status via call:sync, but this reduces perceived latency.
        const emitAccept = () => {
          try {
            socketRef.current?.emit('call:accept');
          } catch {
            // ignore
          }
        };
        emitAccept();
        setTimeout(emitAccept, 1000);
        setTimeout(emitAccept, 2500);
        await startOwnerVoiceSession();

        setTimeout(() => {
          if (voiceStateRef.current === 'connecting') {
            setError('No se pudo conectar la voz (timeout). Pidele al visitante que reintente.');
            setVoiceState('ended');
            cleanup();
          }
        }, 25000);
      } else {
        socketRef.current?.emit('call:end', { reason: 'owner_missed' });
        setVoiceState('ended');
        cleanup();
      }
      if (status !== 'accepted') {
        await updateCallStatus(callId, status);
      }
      setResult(status === 'accepted' ? 'Llamada aceptada.' : 'Llamada marcada como perdida.');

      if (status !== 'accepted') {
        router.replace(ROUTES.dashboard);
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo actualizar el estado';
      setError(message);
      setVoiceState('ended');
      cleanup();
    } finally {
      setIsLoading(false);
    }
  };

  const onManualPlay = (): void => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().then(() => {
        setAudioBlocked(false);
      }).catch((err) => {
        console.warn('[WebRTC] Fallo al intentar reproducir manualmente', err);
      });
    }
  };

  const onHangup = (): void => {
    try {
      socketRef.current?.emit('call:end', { reason: 'owner_hangup' });
    } catch {
      // ignore
    }
    setVoiceState('ended');
    cleanup();
    router.replace(ROUTES.dashboard);
  };

  return (
    <main style={{ padding: '1.5rem', display: 'grid', gap: '1rem', maxWidth: 520, margin: '0 auto' }}>
      <h1 style={{ margin: 0 }}>Llamada</h1>
      <p style={{ margin: 0, color: '#4b5563' }}>ID: {callId}</p>

      <p style={{ margin: 0 }}>
        Selecciona el estado de la llamada. Si tocas "Aceptar", se intentara iniciar voz (puede pedir microfono la primera vez).
      </p>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={() => onUpdate('accepted')}
          disabled={isLoading}
          style={{
            padding: '0.9rem 1rem',
            borderRadius: 12,
            border: '1px solid #16a34a',
            background: '#16a34a',
            color: '#ffffff',
            fontWeight: 600
          }}
        >
          {isLoading ? 'Actualizando...' : 'Aceptar (voz)'}
        </button>
        <button
          type="button"
          onClick={() => onUpdate('missed')}
          disabled={isLoading}
          style={{
            padding: '0.9rem 1rem',
            borderRadius: 12,
            border: '1px solid #dc2626',
            background: '#dc2626',
            color: '#ffffff',
            fontWeight: 600
          }}
        >
          {isLoading ? 'Actualizando...' : 'Perdida'}
        </button>
      </div>

      {voiceState === 'waiting' ? <p style={{ margin: 0, color: '#4b5563' }}>Esperando visitante...</p> : null}
      {voiceState === 'connecting' ? <p style={{ margin: 0, color: '#4b5563' }}>Conectando voz...</p> : null}
      {peerStatus ? <p style={{ margin: 0, color: '#4b5563' }}>{peerStatus}</p> : null}
      {voiceState === 'connected' ? (
        <>
          <p style={{ margin: 0, color: '#16a34a' }}>Voz conectada.</p>
          <audio ref={remoteAudioRef} autoPlay playsInline />
          
          {audioBlocked ? (
            <button
              type="button"
              onClick={onManualPlay}
              style={{
                padding: '0.9rem 1rem',
                borderRadius: 12,
                border: '2px solid #eab308',
                background: '#fef08a',
                color: '#854d0e',
                fontWeight: 600,
                marginTop: '1rem',
                marginBottom: '1rem',
              }}
            >
              🔊 Tocar aquí para escuchar el audio
            </button>
          ) : null}

          <button
            type="button"
            onClick={onHangup}
            style={{
              padding: '0.9rem 1rem',
              borderRadius: 12,
              border: '1px solid #111827',
              background: '#111827',
              color: '#ffffff',
              fontWeight: 600
            }}
          >
            Cortar llamada
          </button>
        </>
      ) : null}

      {result ? <p style={{ color: '#16a34a', margin: 0 }}>{result}</p> : null}
      {error ? <p style={{ color: '#dc2626', margin: 0 }}>{error}</p> : null}
    </main>
  );
}
