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

  const socketRef = useRef<ReturnType<typeof createVisitorCallSocket> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const canStartVoice = useMemo(() => Boolean(callId && visitorToken), [callId, visitorToken]);

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
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectSignaling = (params: { callId: string; visitorToken: string }): void => {
    cleanup();

    const socket = createVisitorCallSocket(params);
    socketRef.current = socket;

    socket.on('call:error', (payload) => {
      setErrorMessage(payload.message || 'Error de señalizacion.');
      setCallState('ended');
      cleanup();
    });

    socket.on('call:accepted', async () => {
      setCallState('connecting');
      setErrorMessage(null);

      try {
        // Request mic only after owner accepts (minimizes unnecessary prompts).
        const localStream = await getLocalAudioStream();
        localStreamRef.current = localStream;

        const pc = createAudioPeerConnection();
        pcRef.current = pc;

        for (const track of localStream.getTracks()) {
          pc.addTrack(track, localStream);
        }

        pc.ontrack = (event) => {
          const [stream] = event.streams;
          if (!stream) return;
          remoteStreamRef.current = stream;
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = stream;
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('webrtc:ice', { candidate: event.candidate.toJSON() });
          }
        };

        socket.on('webrtc:answer', async (payload) => {
          if (!pcRef.current) return;
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
            pendingIceRef.current.push(payload.candidate);
            return;
          }
          try {
            await pcRef.current.addIceCandidate(payload.candidate);
          } catch {
            // ignore
          }
        });

        socket.on('call:ended', () => {
          setCallState('ended');
          cleanup();
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:offer', { sdp: offer });
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : 'No se pudo iniciar la llamada de voz.';
        setErrorMessage(message);
        setCallState('ended');
        cleanup();
      }
    });

    socket.on('call:ended', () => {
      setCallState('ended');
      cleanup();
    });

    socket.on('connect', () => {
      setCallState('waiting_accept');
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
      const result = await ringDoorbell(homeId);
      setCallId(result.id);
      setVisitorToken(result.visitorToken);
      setSuccessMessage(`Timbre enviado. ID de llamada: ${result.id}`);
      setCallState('ring_sent');
      connectSignaling({ callId: result.id, visitorToken: result.visitorToken });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo enviar el timbre.';
      setErrorMessage(message);
    } finally {
      setIsRinging(false);
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
        <p className={styles['subtitle']}>Toca para avisar al propietario que estas en la puerta.</p>

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

        {callState === 'connected' ? (
          <>
            <p className={styles['success']}>Llamada conectada.</p>
            <audio ref={remoteAudioRef} autoPlay playsInline />
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
