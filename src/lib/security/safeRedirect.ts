export function getSafeNextPath(value: string | null): string | null {
  if (!value) {
    return null;
  }

  // Prevent open redirects. Only allow same-origin absolute paths.
  if (!value.startsWith('/')) {
    return null;
  }

  // Disallow protocol-relative URLs.
  if (value.startsWith('//')) {
    return null;
  }

  return value;
}

