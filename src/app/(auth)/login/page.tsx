import { Suspense } from 'react';
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense fallback={<main style={{ padding: '2rem' }}>Cargando...</main>}>
      <LoginForm />
    </Suspense>
  );
}
