import { Suspense } from 'react';
import { RingClient } from './RingClient';

export const dynamic = 'force-dynamic';

export default function RingPage(): React.JSX.Element {
  return (
    <Suspense fallback={<main style={{ padding: '2rem' }}>Cargando...</main>}>
      <RingClient />
    </Suspense>
  );
}
