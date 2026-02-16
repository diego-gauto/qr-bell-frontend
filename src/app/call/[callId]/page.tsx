interface CallPageProps {
  params: Promise<{ callId: string }>;
}

export default async function CallPage({ params }: CallPageProps): Promise<React.JSX.Element> {
  const { callId } = await params;

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Call {callId}</h1>
    </main>
  );
}
