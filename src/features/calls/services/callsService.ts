import { requireApiBaseUrl } from '@/lib/config/apiBaseUrl';
import { safeFetch } from '@/lib/net/safeFetch';
import { withAuthRetry } from '@/features/auth/services/authService';
import { CallHistoryItem } from '../types/call';

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

    // Prefix HTTP status so `withAuthRetry` can detect 401 and refresh the session.
    throw new Error(`${response.status}: ${getErrorMessage(payload, fallbackMessage)}`);
  }

  return (await response.json()) as T;
}

export async function listCalls(limit = 50): Promise<CallHistoryItem[]> {
  const API_BASE_URL = requireApiBaseUrl();

  return withAuthRetry<CallHistoryItem[]>(async (accessToken) => {
    const url = new URL(`${API_BASE_URL}/api/calls`);
    url.searchParams.set('limit', String(limit));

    const response = await safeFetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }, { apiBaseUrl: API_BASE_URL });

    return parseResponse<CallHistoryItem[]>(response, 'No se pudo cargar el historial de llamadas');
  });
}
