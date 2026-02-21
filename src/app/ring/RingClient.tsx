'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { useState } from 'react';
import { ringDoorbell } from '@/features/ring/services/ringService';
import { createAudioPeerConnection, getLocalAudioStream, stopStream } from '@/lib/webrtc/peer';
import { createVisitorCallSocket } from '@/lib/realtime/callSocket';
import styles from './page.module.css';

type VisitorCallState =
  | 'idle'
  | 'ring_sent'
  | 'waiting_accept'
  | 'connecting'
  | 'connected'
  | 'ended';

export function RingClient(): React.JSX.Element {
  const searchParams = useSearchParams();
  const homeId = searchParams.get('h');
  const [isRinging, setIsRinging] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callState, setCallState] = useState<VisitorCallState>('idle');
  const [callId, setCallId] = useState<string | null>(null);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [peerStatus, setPeerStatus] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const callStateRef = useRef<VisitorCallState>('idle');

  const socketRef = useRef<ReturnType<typeof createVisitorCallSocket> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canStartVoice = useMemo(() => Boolean(callId && visitorToken), [callId, visitorToken]);

  const cleanup = (): void => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

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

    stopStream(remoteStream);
    setRemoteStream(null);

    pendingIceRef.current = [];
  };

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((err) => {
        console.warn('[WebRTC] Autoplay bloqueado por el navegador', err);
        if (err.name === 'NotAllowedError') {
          setAudioBlocked(true);
        }
      });
    }
  }, [remoteStream]);

  const connectSignaling = (params: { callId: string; visitorToken: string; localStream: MediaStream }): void => {
    cleanup();

    // Guardar el stream que capturamos en el tap manual del usuario
    localStreamRef.current = params.localStream;

    const socket = createVisitorCallSocket(params);
    socketRef.current = socket;

    const startSyncLoop = (): void => {
      if (syncIntervalRef.current) return;
      // Reliability: on mobile networks it's common to miss a single realtime event.
      // Poll socket-side state until accepted/ended.
      syncIntervalRef.current = setInterval(() => {
        try {
          socket.emit('call:sync', {});
        } catch {
          // ignore
        }
      }, 1500);
    };

    const stopSyncLoop = (): void => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };

    socket.on('call:error', (payload) => {
      setErrorMessage(payload.message || 'Error de señalizacion.');
      setCallState('ended');
      stopSyncLoop();
      cleanup();
    });

    socket.on('call:peer_joined', (payload) => {
      if (payload.role === 'owner') {
        setPeerStatus('Propietario conectado.');
      }
    });

    socket.on('call:peer_left', () => {
      setPeerStatus('Propietario desconectado.');
    });

    socket.on('call:accepted', async () => {
      setCallState('connecting');
      setErrorMessage(null);
      stopSyncLoop();

      try {
        // We already have the mic permission from onRing (bypassing mobile restrictions)
        const localStream = localStreamRef.current;
        if (!localStream) {
          throw new Error('No se encontro el stream de audio local.');
        }

        const pc = createAudioPeerConnection();
        pcRef.current = pc;

        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === 'failed' || state === 'disconnected') {
            setErrorMessage('No se pudo conectar la voz (red). Intenta nuevamente.');
            setCallState('ended');
            cleanup();
          }
        };

        // Forzar canal de audio bidireccional (soluciona problemas de silencio en Safari/Chrome mobile)
        for (const track of localStream.getTracks()) {
          pc.addTransceiver(track, {
            direction: 'sendrecv',
            streams: [localStream]
          });
        }

        pc.ontrack = (event) => {
          const [stream] = event.streams;
          if (!stream) return;
          // Guardarlo en estado disparará el useEffect que lo asigna al <audio>
          setRemoteStream(stream);
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('[WebRTC] Sending ICE candidate');
            socket.emit('webrtc:ice', { candidate: event.candidate.toJSON() });
          }
        };

        socket.on('webrtc:answer', async (payload) => {
          if (!pcRef.current) return;
          console.log('[WebRTC] Received Answer');
          await pcRef.current.setRemoteDescription(payload.sdp);
          const pending = pendingIceRef.current;
          pendingIceRef.current = [];
          for (const candidate of pending) {
            try {
              await pcRef.current.addIceCandidate(candidate);
            } catch {
              // ignore
            }
          }
          setCallState('connected');
        });

        socket.on('webrtc:ice', async (payload) => {
          if (!pcRef.current) return;
          if (!pcRef.current.remoteDescription) {
            console.log('[WebRTC] Queueing foreign ICE candidate (no remote desc yet)');
            pendingIceRef.current.push(payload.candidate);
            return;
          }
          try {
            console.log('[WebRTC] Adding foreign ICE candidate');
            await pcRef.current.addIceCandidate(payload.candidate);
          } catch (e) {
            console.warn('[WebRTC] Failed to add foreign ICE candidate', e);
          }
        });

        socket.on('call:ended', () => {
          setCallState('ended');
          cleanup();
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('[WebRTC] Sending Offer');
        socket.emit('webrtc:offer', { sdp: offer });

        // If we never receive an answer / connection, fail fast with a clear message.
        setTimeout(() => {
          if (callStateRef.current === 'connecting') {
            setErrorMessage('No se pudo conectar la voz (timeout). Corta la llamada y reintenta.');
            setCallState('ended');
            cleanup();
          }
        }, 25000);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : 'No se pudo iniciar la llamada de voz.';
        setErrorMessage(message);
        setCallState('ended');
        stopSyncLoop();
        cleanup();
      }
    });

    socket.on('call:ended', () => {
      setCallState('ended');
      stopSyncLoop();
      cleanup();
    });

    socket.on('connect', () => {
      setCallState('waiting_accept');
      setPeerStatus(null);
      // Ask server for the authoritative status immediately, then keep syncing while waiting.
      try {
        socket.emit('call:sync', {});
      } catch {
        // ignore
      }
      startSyncLoop();
    });
  };

  const onRing = async (): Promise<void> => {
    if (!homeId) {
      setErrorMessage('No se encontro el hogar en la URL del QR.');
      return;
    }

    setIsRinging(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // 1. Pedir micrófono Inmediatamente en el tap del usuario.
      // Si esperamos al socket, Safari/Chrome móvil lanzarán "Permission denied".
      const localStream = await getLocalAudioStream();

      // 2. Llamar a la API
      const result = await ringDoorbell(homeId);
      setCallId(result.id);
      setVisitorToken(result.visitorToken);
      setSuccessMessage(`Timbre enviado. ID de llamada: ${result.id}`);
      setCallState('ring_sent');
      setPeerStatus(null);
      // 3. Iniciar WebSockets pasando el stream ya aprobado
      connectSignaling({ callId: result.id, visitorToken: result.visitorToken, localStream });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo activar el micrófono o enviar el timbre.';
      setErrorMessage(message);
    } finally {
      setIsRinging(false);
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

  const onCancel = (): void => {
    try {
      socketRef.current?.emit('call:end', { reason: 'visitor_cancel' });
    } catch {
      // ignore
    }
    setCallState('ended');
    cleanup();
  };

  return (
    <main className={styles['page']}>
      <section className={styles['card']}>
        <h1 className={styles['title']}>QR Bell</h1>
        <p className={styles['subtitle']}>
          Toca para avisar al propietario que estas en la puerta.
          Si el propietario atiende con voz, este celular puede hablar (pedira permiso de microfono la primera vez).
        </p>

        <button
          className={styles['ringButton']}
          type="button"
          onClick={onRing}
          disabled={isRinging || !homeId || callState === 'waiting_accept' || callState === 'connecting' || callState === 'connected'}
        >
          {isRinging ? 'Enviando...' : 'Tocar Timbre'}
        </button>

        {!homeId ? <p className={styles['error']}>QR invalido: falta el identificador del hogar.</p> : null}
        {successMessage ? <p className={styles['success']}>{successMessage}</p> : null}
        {errorMessage ? <p className={styles['error']}>{errorMessage}</p> : null}

        {canStartVoice && (callState === 'waiting_accept' || callState === 'connecting') ? (
          <p className={styles['subtitle']}>
            {callState === 'waiting_accept' ? 'Esperando que el propietario atienda...' : 'Conectando llamada de voz...'}
          </p>
        ) : null}

        {peerStatus ? <p className={styles['subtitle']}>{peerStatus}</p> : null}

        {callState === 'connected' ? (
          <>
            <p className={styles['success']}>Llamada conectada.</p>
            <audio ref={remoteAudioRef} autoPlay playsInline />
            
            {audioBlocked ? (
              <button
                className={styles['ringButton']}
                type="button"
                onClick={onManualPlay}
                style={{
                  border: '2px solid #eab308',
                  background: '#fef08a',
                  color: '#854d0e',
                  marginTop: '1rem',
                  marginBottom: '1rem',
                }}
              >
                🔊 Tocar aquí para escuchar el audio
              </button>
            ) : null}
          </>
        ) : null}

        {callState === 'waiting_accept' || callState === 'connecting' || callState === 'connected' ? (
          <button className={styles['ringButton']} type="button" onClick={onCancel}>
            Cortar llamada
          </button>
        ) : null}
      </section>
    </main>
  );
}
