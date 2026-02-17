import { useAuthStore } from '@/store/authStore';
import { AuthResponse, AuthSession, AuthUser, LoginPayload, RefreshPayload, RegisterPayload } from '../types/auth';
import { requireApiBaseUrl } from '@/lib/config/apiBaseUrl';
import { safeFetch } from '@/lib/net/safeFetch';

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

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const API_BASE_URL = requireApiBaseUrl();
  const response = await safeFetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }, { apiBaseUrl: API_BASE_URL });

  return parseResponse<AuthResponse>(response, 'Register failed');
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const API_BASE_URL = requireApiBaseUrl();
  const response = await safeFetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }, { apiBaseUrl: API_BASE_URL });

  return parseResponse<AuthResponse>(response, 'Login failed');
}

export async function refresh(payload: RefreshPayload): Promise<AuthResponse> {
  const API_BASE_URL = requireApiBaseUrl();
  const response = await safeFetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }, { apiBaseUrl: API_BASE_URL });

  return parseResponse<AuthResponse>(response, 'Session refresh failed');
}

export async function logout(accessToken: string): Promise<void> {
  const API_BASE_URL = requireApiBaseUrl();
  const response = await safeFetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }, { apiBaseUrl: API_BASE_URL });

  if (!response.ok) {
    throw new Error('Logout failed');
  }
}

export async function getProfile(accessToken: string): Promise<AuthUser> {
  const API_BASE_URL = requireApiBaseUrl();
  const response = await safeFetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }, { apiBaseUrl: API_BASE_URL });

  return parseResponse<AuthUser>(response, 'Unable to fetch profile');
}

export async function withAuthRetry<T>(
  request: (accessToken: string) => Promise<T>,
): Promise<T> {
  // A push notification can open the app on a deep-link route (e.g. `/call/:id`)
  // before any layout has hydrated the in-memory auth store.
  let store = useAuthStore.getState();
  if (!store.isHydrated) {
    store.hydrate();
    store = useAuthStore.getState();
  }

  if (!store.accessToken || !store.refreshToken) {
    throw new Error('Authentication required');
  }

  try {
    return await request(store.accessToken);
  } catch (error) {
    const firstError = error instanceof Error ? error : new Error('Request failed');

    if (!firstError.message.toLowerCase().includes('401')) {
      throw firstError;
    }

    try {
      const refreshed = await refresh({ refreshToken: store.refreshToken });
      const nextSession: AuthSession = {
        user: refreshed.user,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken
      };
      useAuthStore.getState().setSession(nextSession);
      return await request(refreshed.accessToken);
    } catch {
      useAuthStore.getState().clearSession();
      throw new Error('Session expired. Please login again.');
    }
  }
}
