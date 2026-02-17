'use client';

import { useMemo, useState } from 'react';
import { subscribePushNotifications } from '../../services/pushService';
import styles from './NotificationSetup.module.css';

interface NotificationSetupProps {
  accessToken: string | null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function getReadyServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!window.isSecureContext) {
    throw new Error('Push requiere HTTPS o localhost. Usa la URL HTTPS del tunel.');
  }

  const registrations = await withTimeout(
    navigator.serviceWorker.getRegistrations(),
    10000,
    'No se pudo leer registros de service worker.'
  );

  await Promise.all(
    registrations.map(async (entry) => {
      const activeScript = entry.active?.scriptURL ?? entry.installing?.scriptURL ?? entry.waiting?.scriptURL ?? '';

      if (!activeScript.includes('/push-sw.js')) {
        await entry.unregister();
      }
    })
  );

  const registration = await withTimeout(
    navigator.serviceWorker.register('/push-sw.js', { scope: '/' }),
    10000,
    'Timeout registrando service worker. Recarga la pagina e intenta de nuevo.'
  );

  await withTimeout(
    registration.update(),
    8000,
    'No se pudo actualizar el service worker.'
  );

  await withTimeout(
    navigator.serviceWorker.ready,
    12000,
    'Service worker no quedo listo. Cierra y vuelve a abrir la pagina.'
  );

  return registration;
}

export function NotificationSetup({ accessToken }: NotificationSetupProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vapidPublicKey = useMemo(() => process.env['NEXT_PUBLIC_VAPID_PUBLIC_KEY'] ?? '', []);

  const onEnableNotifications = async (): Promise<void> => {
    if (!accessToken) {
      setError('Debes iniciar sesion para activar notificaciones.');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setError('Este navegador no soporta notificaciones push.');
      return;
    }

    if (!vapidPublicKey) {
      setError('Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en el frontend.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatus(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Permiso denegado para notificaciones.');
      }

      const registration = await getReadyServiceWorkerRegistration();
      const existingSubscription = await withTimeout(
        registration.pushManager.getSubscription(),
        10000,
        'No se pudo leer el estado de suscripcion push.'
      );

      const subscription =
        existingSubscription ??
        (await withTimeout(
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
          }),
          15000,
          'Timeout creando suscripcion push. Reintenta en unos segundos.'
        ));

      await withTimeout(
        subscribePushNotifications(subscription, navigator.userAgent),
        10000,
        'Timeout guardando la suscripcion en backend.'
      );
      setStatus('Notificaciones push activadas en este dispositivo.');
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'No se pudo activar notificaciones push.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={styles['panel']}>
      <h3 className={styles['title']}>Notificaciones Push</h3>
      <p className={styles['description']}>
        Activa notificaciones en este dispositivo para recibir alertas cuando un visitante toque el timbre.
      </p>

      <button
        className={styles['actionButton']}
        type="button"
        onClick={onEnableNotifications}
        disabled={isLoading}
      >
        {isLoading ? 'Activando...' : 'Activar notificaciones'}
      </button>

      {status ? <p className={styles['success']}>{status}</p> : null}
      {error ? <p className={styles['error']}>{error}</p> : null}
    </section>
  );
}
