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

export async function subscribePushNotifications(
  accessToken: string,
  subscription: PushSubscription,
  userAgent: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/push/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

    throw new Error(getErrorMessage(payload, 'No se pudo registrar notificaciones push'));
  }
}
