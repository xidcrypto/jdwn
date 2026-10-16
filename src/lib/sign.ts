import crypto from 'crypto';

const SECRET =
  process.env.JWT_SECRET || process.env.APP_SECRET || 'dev-insecure-secret-change-me';

// Kunci 32 byte untuk AES-256-GCM, diturunkan dari secret yang sama.
const ENC_KEY = crypto.createHash('sha256').update(SECRET).digest();

/**
 * Token unduhan/streaming TERENKRIPSI (AES-256-GCM): isi payload tidak bisa
 * dibaca user meskipun token terlihat di URL. Format: base64url(iv+ct+tag),
 * tanpa titik sehingga beda dari format lama (body.sig).
 */
export function signPayload(payload: Record<string, unknown>, ttlMs: number): string {
  const body = JSON.stringify({ ...payload, exp: Date.now() + ttlMs });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64url');
}

function verifyV2<T>(token: string): (T & { exp: number }) | null {
  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length < 12 + 16 + 1) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(raw.length - 16);
    const enc = raw.subarray(12, raw.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
    decipher.setAuthTag(tag);
    const body = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    const payload = JSON.parse(body);
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload as T & { exp: number };
  } catch {
    return null;
  }
}

/** Format lama (body.sig, HMAC saja, isi terbaca): diterima selama masa transisi. */
function verifyV1<T>(token: string): (T & { exp: number }) | null {
  try {
    const idx = token.lastIndexOf('.');
    if (idx <= 0) return null;
    const body = token.slice(0, idx);
    const sig = token.slice(idx + 1);
    const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload as T & { exp: number };
  } catch {
    return null;
  }
}

export function verifyPayload<T = Record<string, unknown>>(
  token: string | null | undefined,
): (T & { exp: number }) | null {
  if (!token) return null;
  // Format baru tidak mengandung titik (base64url murni); format lama body.sig.
  if (token.includes('.')) return verifyV1<T>(token);
  return verifyV2<T>(token);
}
