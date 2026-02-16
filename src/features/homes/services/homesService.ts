import { CreateHomePayload, Home } from '../types/home';

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

export async function createHome(accessToken: string, payload: CreateHomePayload): Promise<Home> {
  const response = await fetch(`${API_BASE_URL}/api/homes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Home>(response, 'No se pudo crear el hogar');
}

export async function listHomes(accessToken: string): Promise<Home[]> {
  const response = await fetch(`${API_BASE_URL}/api/homes`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return parseResponse<Home[]>(response, 'No se pudo cargar la lista de hogares');
}
