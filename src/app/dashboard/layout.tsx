'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logout } from '@/features/auth/services/authService';
import { ROUTES } from '@/lib/constants/routes';
import { useAuthStore } from '@/store/authStore';
import styles from './DashboardLayout.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, isHydrated, hydrate, clearSession } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isHydrated) {
      hydrate();
    }
  }, [hydrate, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!accessToken) {
      router.replace(ROUTES.login);
    }
  }, [accessToken, isHydrated, router]);

  const onLogout = async (): Promise<void> => {
    if (!accessToken) {
      clearSession();
      router.replace(ROUTES.login);
      return;
    }

    setIsLoggingOut(true);

    try {
      await logout(accessToken);
    } catch {
      // If backend fails we still clear local session to avoid stale auth.
    } finally {
      clearSession();
      setIsLoggingOut(false);
      router.replace(ROUTES.login);
    }
  };

  if (!isHydrated) {
    return <main className={styles['loading']}>Cargando sesion...</main>;
  }

  if (!accessToken) {
    return <main className={styles['loading']}>Redirigiendo...</main>;
  }

  return (
    <div className={styles['page']}>
      <header className={styles['header']}>
        <div>
          <p className={styles['caption']}>Sesion activa</p>
          <h1 className={styles['title']}>{user?.name ?? 'QR Bell'}</h1>
        </div>

        <button className={styles['logoutButton']} onClick={onLogout} type="button" disabled={isLoggingOut}>
          {isLoggingOut ? 'Cerrando...' : 'Cerrar sesion'}
        </button>
      </header>

      <nav className={styles['nav']}>
        <Link
          className={pathname === ROUTES.dashboard ? styles['activeLink'] : styles['link']}
          href={ROUTES.dashboard}
        >
          Dashboard
        </Link>
        <Link
          className={pathname === ROUTES.dashboardHomes ? styles['activeLink'] : styles['link']}
          href={ROUTES.dashboardHomes}
        >
          Homes
        </Link>
        <Link
          className={pathname === ROUTES.dashboardHistory ? styles['activeLink'] : styles['link']}
          href={ROUTES.dashboardHistory}
        >
          Historial
        </Link>
      </nav>

      <section className={styles['content']}>{children}</section>
    </div>
  );
}
