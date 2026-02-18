'use client';

import { useEffect, useState } from 'react';
import styles from './AudioSetup.module.css';

type MicPermissionState = 'unknown' | 'granted' | 'denied' | 'prompt' | 'unsupported';

async function probeMicPermission(): Promise<MicPermissionState> {
  if (!('mediaDevices' in navigator) || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return 'unsupported';
  }

  // Permissions API is not available everywhere; if missing, we'll treat as unknown/prompt.
  const permissions = (navigator as unknown as { permissions?: Permissions }).permissions;
  if (!permissions || typeof permissions.query !== 'function') {
    return 'unknown';
  }

  try {
    // TS libdom doesn't always include 'microphone' depending on version.
    const status = await permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch {
    return 'unknown';
  }
}

export function AudioSetup(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<MicPermissionState>('unknown');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void probeMicPermission().then((state) => {
      if (mounted) setPermission(state);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const onEnableMic = async (): Promise<void> => {
    setIsLoading(true);
    setStatus(null);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      for (const track of stream.getTracks()) {
        track.stop();
      }

      setStatus('Microfono habilitado. Ya no deberia pedir permiso al atender.');
      setPermission(await probeMicPermission());
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : 'No se pudo habilitar el microfono.';
      setError(
        [
          'No se pudo habilitar el microfono.',
          `Detalle: ${message}`,
          'Tip: revisa permisos del sitio en Android (Configuracion del navegador -> Permisos).'
        ].join('\n')
      );
      setPermission(await probeMicPermission());
    } finally {
      setIsLoading(false);
    }
  };

  const onRecheck = async (): Promise<void> => {
    setIsLoading(true);
    setStatus(null);
    setError(null);
    try {
      setPermission(await probeMicPermission());
      setStatus('Estado actualizado.');
    } finally {
      setIsLoading(false);
    }
  };

  const helper = (() => {
    if (permission === 'granted') return 'Estado: permitido.';
    if (permission === 'denied') return 'Estado: bloqueado. Debes habilitarlo en permisos del sitio.';
    if (permission === 'prompt') return 'Estado: pedira permiso la primera vez.';
    if (permission === 'unsupported') return 'Estado: este dispositivo/navegador no soporta microfono en web.';
    return 'Estado: desconocido (se pedira permiso al atender).';
  })();

  return (
    <section className={styles['panel']}>
      <h3 className={styles['title']}>Audio (voz)</h3>
      <p className={styles['description']}>
        Para hablar durante una llamada de voz, cada celular debe permitir su propio microfono (regla del sistema).
        Esto se hace una sola vez por dispositivo.
      </p>
      <p className={styles['description']}>{helper}</p>

      <div className={styles['row']}>
        <button className={styles['actionButton']} type="button" onClick={onEnableMic} disabled={isLoading}>
          {isLoading ? 'Habilitando...' : 'Habilitar microfono'}
        </button>
        <button
          className={[styles['actionButton'], styles['actionButtonSecondary']].join(' ')}
          type="button"
          onClick={() => void onRecheck()}
          disabled={isLoading}
        >
          Revisar estado
        </button>
      </div>

      {status ? <p className={styles['success']}>{status}</p> : null}
      {error ? <p className={styles['error']}>{error}</p> : null}
    </section>
  );
}

