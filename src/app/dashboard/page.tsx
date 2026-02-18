'use client';

import { NotificationSetup } from '@/features/pwa/components/NotificationSetup/NotificationSetup';
import { AppUpdatePanel } from '@/features/pwa/components/AppUpdatePanel/AppUpdatePanel';
import { AudioSetup } from '@/features/pwa/components/AudioSetup/AudioSetup';
import { useAuthStore } from '@/store/authStore';

export default function DashboardPage(): React.JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);

  return (
    <main style={{ display: 'grid', gap: '1rem' }}>
      <h2>Panel principal</h2>
      <p>Tu sesion esta activa. Configura notificaciones para recibir timbres en tiempo real.</p>
      <NotificationSetup accessToken={accessToken} />
      <AudioSetup />
      <AppUpdatePanel />
    </main>
  );
}
