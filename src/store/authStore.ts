import { create } from 'zustand';
import { AuthSession, AuthUser } from '@/features/auth/types/auth';

const AUTH_STORAGE_KEY = 'qr-bell-auth-session';

interface PersistedAuthState {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  hydrate: () => void;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
}

function readPersistedSession(): PersistedAuthState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PersistedAuthState;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function writePersistedSession(session: PersistedAuthState | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isHydrated: false,
  hydrate: () => {
    const persisted = readPersistedSession();

    if (persisted) {
      set({
        user: persisted.user,
        accessToken: persisted.accessToken,
        refreshToken: persisted.refreshToken,
        isHydrated: true
      });
      return;
    }

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isHydrated: true
    });
  },
  setSession: (session) => {
    const persisted: PersistedAuthState = {
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken
    };

    writePersistedSession(persisted);

    set({
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      isHydrated: true
    });
  },
  clearSession: () => {
    writePersistedSession(null);

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isHydrated: true
    });
  }
}));
