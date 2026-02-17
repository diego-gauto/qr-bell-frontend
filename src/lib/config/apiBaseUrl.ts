function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  const raw = process.env['NEXT_PUBLIC_API_URL'];
  if (!raw) {
    return '';
  }

  return normalizeOrigin(raw);
}

export function requireApiBaseUrl(): string {
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    throw new Error(
      'Configuracion invalida: falta NEXT_PUBLIC_API_URL en Vercel (Production/Preview).'
    );
  }

  // Prevent mixed-content failures: https frontend cannot call http backend.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && baseUrl.startsWith('http://')) {
    throw new Error('Configuracion invalida: NEXT_PUBLIC_API_URL debe ser https en produccion.');
  }

  return baseUrl;
}

