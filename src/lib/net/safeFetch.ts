function toNetworkErrorMessage(apiBaseUrl?: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '(unknown)';
  const api = apiBaseUrl && apiBaseUrl.length > 0 ? apiBaseUrl : '(unset)';

  return [
    'No se pudo conectar al backend (Failed to fetch).',
    '',
    `Frontend: ${origin}`,
    `Backend (NEXT_PUBLIC_API_URL): ${api}`,
    '',
    'Causas tipicas:',
    '- NEXT_PUBLIC_API_URL mal configurado en Vercel (Production/Preview).',
    '- Backend (Render Free) dormido: espera 60s y reintenta.',
    '- CORS_ORIGIN/FRONTEND_APP_URL no coinciden con el dominio estable de Vercel.'
  ].join('\n');
}

export async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: { apiBaseUrl?: string }
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(toNetworkErrorMessage(opts?.apiBaseUrl));
  }
}

