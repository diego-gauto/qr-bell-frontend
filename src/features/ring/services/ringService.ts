import { RingResponse } from '../types/ring';

const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

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

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    let payload: ApiErrorPayload = {};

    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = {};
    }

    throw new Error(getErrorMessage(payload, fallbackMessage));
  }

  return (await response.json()) as T;
}

export async function ringDoorbell(homeId: string): Promise<RingResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ring`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      homeId
    })
  });

  return parseResponse<RingResponse>(response, 'No se pudo enviar el timbre');
}
