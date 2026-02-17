'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchDeploymentVersion,
  forceAppReload,
  getStoredDeploymentVersion,
  storeDeploymentVersion
} from '@/features/pwa/update/appUpdate';
import styles from './AppUpdateBanner.module.css';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function AppUpdateBanner(): React.JSX.Element | null {
  const [isVisible, setIsVisible] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const latestVersionRef = useRef<string | null>(null);

  const check = useMemo(() => {
    return async (): Promise<void> => {
      try {
        const remote = await fetchDeploymentVersion();
        const stored = getStoredDeploymentVersion();

        // First run: seed storage.
        if (!stored) {
          storeDeploymentVersion(remote);
          setIsVisible(false);
          latestVersionRef.current = null;
          return;
        }

        if (remote !== stored) {
          latestVersionRef.current = remote;
          setIsVisible(true);
        } else {
          // Same version.
          setIsVisible(false);
          latestVersionRef.current = null;
        }
      } catch {
        // If version check fails, do not block the user.
      }
    };
  }, []);

  useEffect(() => {
    let intervalId: number | null = null;

    void check();

    intervalId = window.setInterval(() => {
      void check();
    }, CHECK_INTERVAL_MS);

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        void check();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [check]);

  const onReload = async (): Promise<void> => {
    setIsReloading(true);
    const latest = latestVersionRef.current;
    if (latest) {
      storeDeploymentVersion(latest);
    }
    await forceAppReload();
  };

  const onDismiss = (): void => {
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles['banner']} role="status" aria-live="polite">
      <div className={styles['text']}>Hay una nueva version disponible.</div>
      <div className={styles['actions']}>
        <button className={styles['button']} type="button" onClick={onDismiss} disabled={isReloading}>
          Despues
        </button>
        <button
          className={[styles['button'], styles['primary']].join(' ')}
          type="button"
          onClick={() => void onReload()}
          disabled={isReloading}
        >
          {isReloading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
    </div>
  );
}

