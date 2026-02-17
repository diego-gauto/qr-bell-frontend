'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { AppUpdateBanner } from '@/features/pwa/components/AppUpdateBanner/AppUpdateBanner';

export function Providers({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) {
      hydrate();
    }
  }, [hydrate, isHydrated]);

  return (
    <>
      <AppUpdateBanner />
      {children}
    </>
  );
}
