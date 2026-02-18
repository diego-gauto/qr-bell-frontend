'use client';

import { io, Socket } from 'socket.io-client';
import { requireApiBaseUrl } from '@/lib/config/apiBaseUrl';

export type CallSocketRole = 'owner' | 'visitor';

export type CallSocketServerToClientEvents = {
  'call:joined': (payload: { role: CallSocketRole; callId: string }) => void;
  'call:error': (payload: { message: string }) => void;
  'call:peer_joined': (payload: { role: CallSocketRole }) => void;
  'call:peer_left': (payload: { role?: CallSocketRole }) => void;
  'call:accepted': (payload: { callId: string }) => void;
  'call:ended': (payload: { callId: string; reason: string }) => void;
  'webrtc:offer': (payload: { sdp: RTCSessionDescriptionInit }) => void;
  'webrtc:answer': (payload: { sdp: RTCSessionDescriptionInit }) => void;
  'webrtc:ice': (payload: { candidate: RTCIceCandidateInit }) => void;
};

export type CallSocketClientToServerEvents = {
  'call:accept': () => void;
  'call:sync': (payload: Record<string, never>) => void;
  'call:end': (payload: { reason?: string }) => void;
  'webrtc:offer': (payload: { sdp: RTCSessionDescriptionInit }) => void;
  'webrtc:answer': (payload: { sdp: RTCSessionDescriptionInit }) => void;
  'webrtc:ice': (payload: { candidate: RTCIceCandidateInit }) => void;
};

export function createVisitorCallSocket(params: { callId: string; visitorToken: string }): Socket<
  CallSocketServerToClientEvents,
  CallSocketClientToServerEvents
> {
  const API_BASE_URL = requireApiBaseUrl();
  return io(API_BASE_URL, {
    // Allow polling fallback on networks where WebSocket is blocked.
    transports: ['websocket', 'polling'],
    query: {
      callId: params.callId,
      visitorToken: params.visitorToken
    }
  });
}

export function createOwnerCallSocket(params: { callId: string; accessToken: string }): Socket<
  CallSocketServerToClientEvents,
  CallSocketClientToServerEvents
> {
  const API_BASE_URL = requireApiBaseUrl();
  return io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    auth: {
      token: params.accessToken
    },
    query: {
      callId: params.callId
    }
  });
}
