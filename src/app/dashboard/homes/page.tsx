'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createHome, listHomes } from '@/features/homes/services/homesService';
import { Home } from '@/features/homes/types/home';
import { useAuthStore } from '@/store/authStore';
import styles from './page.module.css';

const createHomeSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  address: z.string().max(255, 'La direccion no puede superar 255 caracteres').optional()
});

type CreateHomeFormValues = z.infer<typeof createHomeSchema>;

export default function DashboardHomesPage(): React.JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [homes, setHomes] = useState<Home[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionMessageByHomeId, setActionMessageByHomeId] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<CreateHomeFormValues>({
    resolver: zodResolver(createHomeSchema),
    defaultValues: {
      name: '',
      address: ''
    }
  });

  useEffect(() => {
    let mounted = true;

    async function loadHomes(): Promise<void> {
      if (!accessToken) {
        setHomes([]);
        setLoadError('No hay sesion activa');
        setIsLoading(false);
        return;
      }

      try {
        setLoadError(null);
        const fetchedHomes = await listHomes(accessToken);

        if (mounted) {
          setHomes(fetchedHomes);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo cargar la lista de hogares';

        if (mounted) {
          setLoadError(message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadHomes();

    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const homesCountText = useMemo(() => {
    if (homes.length === 1) {
      return '1 hogar registrado';
    }

    return `${homes.length} hogares registrados`;
  }, [homes.length]);

  const onSubmit = async (values: CreateHomeFormValues): Promise<void> => {
    if (!accessToken) {
      setSubmitError('No hay sesion activa');
      return;
    }

    setSubmitError(null);

    try {
      const createdHome = await createHome(accessToken, {
        name: values.name,
        address: values.address?.trim() ? values.address.trim() : undefined
      });

      setHomes((previousHomes) => [createdHome, ...previousHomes]);
      reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear el hogar';
      setSubmitError(message);
    }
  };

  const setHomeActionMessage = (homeId: string, message: string): void => {
    setActionMessageByHomeId((prev) => ({ ...prev, [homeId]: message }));
    window.setTimeout(() => {
      setActionMessageByHomeId((prev) => {
        const { [homeId]: _, ...rest } = prev;
        return rest;
      });
    }, 2500);
  };

  const onCopyLink = async (home: Home): Promise<void> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(home.ringUrl);
        setHomeActionMessage(home.id, 'Link copiado.');
        return;
      }

      // Fallback for older browsers.
      const textarea = document.createElement('textarea');
      textarea.value = home.ringUrl;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      setHomeActionMessage(home.id, ok ? 'Link copiado.' : 'No se pudo copiar el link.');
    } catch {
      setHomeActionMessage(home.id, 'No se pudo copiar el link.');
    }
  };

  const onShareLink = async (home: Home): Promise<void> => {
    try {
      if (!navigator.share) {
        await onCopyLink(home);
        return;
      }

      await navigator.share({
        title: `QR Bell - ${home.name}`,
        text: `Timbre de ${home.name}`,
        url: home.ringUrl
      });
      setHomeActionMessage(home.id, 'Compartido.');
    } catch {
      // User can cancel the native share sheet; do not treat as a hard error.
      setHomeActionMessage(home.id, '');
    }
  };

  return (
    <main className={styles['container']}>
      <header className={styles['header']}>
        <h2 className={styles['title']}>Homes y QR</h2>
        <p className={styles['subtitle']}>Crea hogares y comparte su QR de timbre en segundos.</p>
      </header>

      <section className={styles['panel']}>
        <h3 className={styles['panelTitle']}>Nuevo hogar</h3>
        <form className={styles['form']} onSubmit={handleSubmit(onSubmit)}>
          <label className={styles['field']}>
            <span className={styles['label']}>Nombre</span>
            <input className={styles['input']} type="text" autoComplete="off" {...register('name')} />
            {errors.name ? <span className={styles['error']}>{errors.name.message}</span> : null}
          </label>

          <label className={styles['field']}>
            <span className={styles['label']}>Direccion (opcional)</span>
            <input className={styles['input']} type="text" autoComplete="street-address" {...register('address')} />
            {errors.address ? <span className={styles['error']}>{errors.address.message}</span> : null}
          </label>

          {submitError ? <p className={styles['error']}>{submitError}</p> : null}

          <button className={styles['submitButton']} type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creando...' : 'Crear hogar'}
          </button>
        </form>
      </section>

      <section className={styles['panel']}>
        <div className={styles['listHeader']}>
          <h3 className={styles['panelTitle']}>Hogares creados</h3>
          <span className={styles['badge']}>{homesCountText}</span>
        </div>

        {isLoading ? <p className={styles['muted']}>Cargando hogares...</p> : null}
        {loadError ? <p className={styles['error']}>{loadError}</p> : null}

        {!isLoading && !loadError && homes.length === 0 ? (
          <p className={styles['muted']}>Aun no tienes hogares. Crea el primero para generar su QR.</p>
        ) : null}

        <div className={styles['homesGrid']}>
          {homes.map((home) => (
            <article key={home.id} className={styles['homeCard']}>
              <div className={styles['homeMeta']}>
                <h4 className={styles['homeName']}>{home.name}</h4>
                <p className={styles['homeAddress']}>{home.address ?? 'Sin direccion cargada'}</p>
              </div>

              <div className={styles['qrWrap']}>
                <QRCodeSVG value={home.ringUrl} size={168} level="M" includeMargin />
              </div>

              <div className={styles['actions']}>
                <a className={styles['ringLink']} href={home.ringUrl} target="_blank" rel="noreferrer">
                  Abrir URL de timbre
                </a>

                <div className={styles['actionRow']}>
                  <button
                    type="button"
                    className={[styles['actionButton'], styles['actionButtonPrimary']].join(' ')}
                    onClick={() => void onCopyLink(home)}
                  >
                    Copiar link
                  </button>

                  <button
                    type="button"
                    className={styles['actionButton']}
                    onClick={() => void onShareLink(home)}
                  >
                    Compartir
                  </button>
                </div>

                {actionMessageByHomeId[home.id] ? (
                  <p className={styles['actionHint']}>{actionMessageByHomeId[home.id]}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
