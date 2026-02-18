import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function getFirst(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function HomePage({
  searchParams
}: {
  // This repo's Next types currently model `searchParams` as a Promise in generated `.next/types`.
  searchParams?: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const resolved = searchParams ? await searchParams : undefined;
  const h = getFirst(resolved?.['h']);
  if (h) {
    redirect(`/ring?h=${encodeURIComponent(h)}`);
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 560, margin: '0 auto', display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>QR Bell</h1>
      <p style={{ margin: 0, color: '#4b5563' }}>
        Esta es la pantalla del visitante. Escanea el QR y toca el timbre.
      </p>

      <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem', background: '#ffffff' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>¿No llegaste desde un QR?</h2>
        <p style={{ margin: '0.5rem 0 0', color: '#4b5563' }}>
          Abre el link del QR que te pasaron. Debe verse como: <code>/?h=...</code>
        </p>
      </section>

      <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
        ¿Eres propietario? <Link href="/login">Iniciar sesion</Link>
      </p>
    </main>
  );
}
