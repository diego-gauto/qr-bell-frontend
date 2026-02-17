import { Suspense } from 'react';
import { RegisterForm } from '@/features/auth/components/RegisterForm/RegisterForm';

export default function RegisterPage(): React.JSX.Element {
  return (
    <Suspense fallback={<main style={{ padding: '2rem' }}>Cargando...</main>}>
      <RegisterForm />
    </Suspense>
  );
}
