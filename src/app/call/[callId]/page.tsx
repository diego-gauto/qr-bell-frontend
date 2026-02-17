'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { withAuthRetry } from '@/features/auth/services/authService';
import { ROUTES } from '@/lib/constants/routes';
import { useAuthStore } from '@/store/authStore';
import { requireApiBaseUrl } from '@/lib/config/apiBaseUrl';
import { safeFetch } from '@/lib/net/safeFetch';

type CallStatus = 'accepted' | 'missed';

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

  useEffect(() => {
    let isMounted = true;
    void params.then(({ callId: nextCallId }) => {
      if (isMounted) setCallId(nextCallId);
    });
    return () => {
      isMounted = false;
    };
  }, [params]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!accessToken) {
      const nextPath = callId ? `/call/${encodeURIComponent(callId)}` : ROUTES.dashboard;
      router.replace(`${ROUTES.login}?next=${encodeURIComponent(nextPath)}`);
    }
  }, [accessToken, callId, isHydrated, router]);

  const onUpdate = async (status: CallStatus): Promise<void> => {
    if (!callId) {
      setError('CallId invalido.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      await updateCallStatus(callId, status);
      setResult(status === 'accepted' ? 'Llamada marcada como aceptada.' : 'Llamada marcada como perdida.');
      router.replace(ROUTES.dashboard);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo actualizar el estado';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ padding: '1.5rem', display: 'grid', gap: '1rem', maxWidth: 520, margin: '0 auto' }}>
      <h1 style={{ margin: 0 }}>Llamada</h1>
      <p style={{ margin: 0, color: '#4b5563' }}>ID: {callId}</p>

      <p style={{ margin: 0 }}>
        Selecciona el estado de la llamada.
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
          {isLoading ? 'Actualizando...' : 'Aceptar'}
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

      {result ? <p style={{ color: '#16a34a', margin: 0 }}>{result}</p> : null}
      {error ? <p style={{ color: '#dc2626', margin: 0 }}>{error}</p> : null}
    </main>
  );
}
