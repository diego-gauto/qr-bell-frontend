interface RingPageProps {
  searchParams: Promise<{ h?: string }>;
}

export default async function RingPage({ searchParams }: RingPageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const homeId = params.h;

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Ring Doorbell</h1>
      {homeId ? (
        <p>Visitante listo para tocar timbre en el hogar: {homeId}</p>
      ) : (
        <p>No se encontro el identificador del hogar en la URL.</p>
      )}
    </main>
  );
}
