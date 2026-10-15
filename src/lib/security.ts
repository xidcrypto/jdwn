// Helper keamanan API — Edge-compatible (tanpa API Node).

export interface RateResult {
  ok: boolean;
  retryAfter: number;
}

interface Bucket {
  count: number;
  reset: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 30000) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (b.reset <= now) buckets.delete(k);
  }
}

/** Pembatas laju sederhana per proses (fixed window). */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
  }
  return { ok: true, retryAfter: 0 };
}

export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return headers.get('x-real-ip') || 'local';
}

function configuredOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function hostOrigins(headers: Headers): string[] {
  const host = headers.get('x-forwarded-host') || headers.get('host') || '';
  if (!host) return [];
  const proto = headers.get('x-forwarded-proto') || 'https';
  return [`${proto}://${host}`, `https://${host}`, `http://${host}`];
}

/**
 * Hanya izinkan request dari situs sendiri.
 * Utama: Fetch Metadata (Sec-Fetch-Site) dari browser; cadangan: Origin/Referer.
 * Request tanpa metadata (mis. curl) ditolak kecuali API_ALLOW_NO_ORIGIN=1.
 */
export function isSameOrigin(req: Request): boolean {
  const h = req.headers;
  const sfs = (h.get('sec-fetch-site') || '').toLowerCase();
  if (sfs === 'same-origin' || sfs === 'same-site') return true;
  if (sfs === 'cross-site') return false;

  const allowed = new Set([...hostOrigins(h), ...configuredOrigins()]);
  let candidate = h.get('origin') || '';
  if (!candidate) {
    const ref = h.get('referer');
    if (ref) {
      try {
        candidate = new URL(ref).origin;
      } catch {
        /* abaikan */
      }
    }
  }
  if (candidate) return allowed.has(candidate.replace(/\/+$/, ''));

  return process.env.API_ALLOW_NO_ORIGIN === '1';
}

/** Batas laju per jenis endpoint. */
export function limitForPath(pathname: string): { limit: number; bucket: string } {
  if (pathname === '/api/auth/login' || pathname === '/api/auth/install') {
    return { limit: 10, bucket: 'auth' };
  }
  if (pathname === '/api/public/extract') return { limit: 20, bucket: 'extract' };
  if (pathname === '/api/public/visit') return { limit: 30, bucket: 'visit' };
  if (pathname.startsWith('/api/public/')) return { limit: 60, bucket: 'pub' };
  return { limit: 240, bucket: 'api' };
}
