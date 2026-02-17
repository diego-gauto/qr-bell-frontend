import { withAuthRetry } from '@/features/auth/services/authService';

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

async function subscribePushNotificationsWithAccessToken(
  accessToken: string,
  subscription: PushSubscription,
  userAgent: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/push/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'ngrok-skip-browser-warning': 'true',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subscription,
      userAgent
    })
  });

  if (!response.ok) {
    let payload: ApiErrorPayload = {};

    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = {};
    }

    throw new Error(`${response.status}: ${getErrorMessage(payload, 'No se pudo registrar notificaciones push')}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Respuesta invalida del backend push. Revisa el tunel HTTPS.');
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error('Respuesta incompleta al registrar notificaciones push.');
  }
}

export async function subscribePushNotifications(
  subscription: PushSubscription,
  userAgent: string
): Promise<void> {
  await withAuthRetry<void>((accessToken) =>
    subscribePushNotificationsWithAccessToken(accessToken, subscription, userAgent)
  );
}
