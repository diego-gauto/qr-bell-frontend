'use client';

import { useState } from 'react';
import { fetchDeploymentVersion, forceAppReload, getStoredDeploymentVersion, storeDeploymentVersion } from '@/features/pwa/update/appUpdate';
import styles from './AppUpdatePanel.module.css';

export function AppUpdatePanel(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const onCheckNow = async (): Promise<void> => {
    setIsLoading(true);
    setNote(null);
    try {
      const remote = await fetchDeploymentVersion();
      const stored = getStoredDeploymentVersion();

      if (!stored) {
        storeDeploymentVersion(remote);
        setNote('Version guardada. No hay actualizaciones pendientes.');
        return;
      }

      if (remote === stored) {
        setNote('Estas en la ultima version.');
        return;
      }

      setNote('Hay una nueva version disponible. Toca "Actualizar app".');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo verificar actualizaciones.';
      setNote(message);
    } finally {
      setIsLoading(false);
    }
  };

  const onUpdate = async (): Promise<void> => {
    setIsLoading(true);
    setNote(null);
    try {
      const remote = await fetchDeploymentVersion();
      storeDeploymentVersion(remote);
    } catch {
      // Even if version check fails, reload still helps.
    }
    await forceAppReload();
  };

  return (
    <section className={styles['panel']}>
      <h3 className={styles['title']}>Actualizaciones</h3>
      <p className={styles['description']}>
        La app se actualiza automaticamente cuando abrís una nueva version. Si ves cambios atrasados, usa este boton.
      </p>

      <div className={styles['row']}>
        <button className={[styles['button'], styles['primary']].join(' ')} type="button" onClick={() => void onUpdate()} disabled={isLoading}>
          {isLoading ? 'Actualizando...' : 'Actualizar app'}
        </button>
        <button className={styles['button']} type="button" onClick={() => void onCheckNow()} disabled={isLoading}>
          {isLoading ? 'Revisando...' : 'Buscar actualizacion'}
        </button>
      </div>

      {note ? <p className={styles['note']}>{note}</p> : null}
    </section>
  );
}

