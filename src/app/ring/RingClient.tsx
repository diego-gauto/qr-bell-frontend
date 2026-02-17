'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ringDoorbell } from '@/features/ring/services/ringService';
import styles from './page.module.css';

export function RingClient(): React.JSX.Element {
  const searchParams = useSearchParams();
  const homeId = searchParams.get('h');
  const [isRinging, setIsRinging] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onRing = async (): Promise<void> => {
    if (!homeId) {
      setErrorMessage('No se encontro el hogar en la URL del QR.');
      return;
    }

    setIsRinging(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const result = await ringDoorbell(homeId);
      setSuccessMessage(`Timbre enviado. ID de llamada: ${result.id}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo enviar el timbre.';
      setErrorMessage(message);
    } finally {
      setIsRinging(false);
    }
  };

  return (
    <main className={styles['page']}>
      <section className={styles['card']}>
        <h1 className={styles['title']}>QR Bell</h1>
        <p className={styles['subtitle']}>Toca para avisar al propietario que estas en la puerta.</p>

        <button className={styles['ringButton']} type="button" onClick={onRing} disabled={isRinging || !homeId}>
          {isRinging ? 'Enviando...' : 'Tocar Timbre'}
        </button>

        {!homeId ? <p className={styles['error']}>QR invalido: falta el identificador del hogar.</p> : null}
        {successMessage ? <p className={styles['success']}>{successMessage}</p> : null}
        {errorMessage ? <p className={styles['error']}>{errorMessage}</p> : null}
      </section>
    </main>
  );
}

