// Store settings → Domain → Allowed origins (pure)
export const MAX_ORIGINS = 10;

// "https://shop.example.com" only: https, a host, no path (a port is allowed for local development builds)
export function cleanOrigin(v: string): string | null {
  const s = v.trim().toLowerCase().replace(/\/+$/, "");
  return /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(:\d{1,5})?$/.test(s) ? s : null;
}
