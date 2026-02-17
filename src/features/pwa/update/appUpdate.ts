const VERSION_STORAGE_KEY = 'qr-bell:deployment-version';

export interface DeploymentVersionPayload {
  version: string;
}

export async function fetchDeploymentVersion(): Promise<string> {
  const response = await fetch('/api/version', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('No se pudo verificar la version de la app.');
  }

  const payload = (await response.json()) as DeploymentVersionPayload;
  if (!payload.version || typeof payload.version !== 'string') {
    throw new Error('Respuesta invalida de version.');
  }

  return payload.version;
}

export function getStoredDeploymentVersion(): string | null {
  try {
    return localStorage.getItem(VERSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeDeploymentVersion(version: string): void {
  try {
    localStorage.setItem(VERSION_STORAGE_KEY, version);
  } catch {
    // Ignore storage errors (private mode, etc).
  }
}

export async function forceAppReload(): Promise<void> {
  // Try to update any existing SW registrations (push SW).
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.update().catch(() => undefined)));
    }
  } catch {
    // Ignore.
  }

  // Clear CacheStorage to avoid stale assets on some devices.
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Ignore.
  }

  window.location.reload();
}

