'use client';

import { useEffect, useMemo, useState } from 'react';
import { listCalls } from '@/features/calls/services/callsService';
import { CallHistoryItem } from '@/features/calls/types/call';
import styles from './page.module.css';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

function statusLabel(status: CallHistoryItem['status']): string {
  if (status === 'accepted') return 'Aceptada';
  if (status === 'missed') return 'Perdida';
  return 'Sonando';
}

export default function DashboardHistoryPage(): React.JSX.Element {
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load(): Promise<void> {
      try {
        setError(null);
        const items = await listCalls(50);
        if (mounted) setCalls(items);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'No se pudo cargar el historial';
        if (mounted) setError(message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const emptyText = useMemo(() => {
    if (isLoading) return 'Cargando historial...';
    if (error) return null;
    if (calls.length === 0) return 'Todavia no hay llamadas registradas.';
    return null;
  }, [calls.length, error, isLoading]);

  return (
    <main className={styles['container']}>
      <h2 className={styles['title']}>Historial de llamadas</h2>
      <p className={styles['muted']}>Ultimas 50 llamadas recibidas.</p>

      {error ? <p className={styles['error']}>{error}</p> : null}
      {emptyText ? <p className={styles['muted']}>{emptyText}</p> : null}

      {calls.length > 0 ? (
        <section className={styles['list']}>
          {calls.map((call) => (
            <article key={call.id} className={styles['item']}>
              <div className={styles['row']}>
                <span className={styles['homeName']}>{call.homeName}</span>
                <span
                  className={[
                    styles['badge'],
                    call.status === 'accepted'
                      ? styles['accepted']
                      : call.status === 'missed'
                        ? styles['missed']
                        : styles['ringing']
                  ].join(' ')}
                >
                  {statusLabel(call.status)}
                </span>
              </div>

              <div className={styles['meta']}>
                <div>Inicio: {formatDate(call.createdAt)}</div>
                {call.answeredAt ? <div>Atendida: {formatDate(call.answeredAt)}</div> : null}
                {call.missedAt ? <div>Perdida: {formatDate(call.missedAt)}</div> : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
