import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clientIp, isSameOrigin, limitForPath, rateLimit } from './lib/security';

export const config = {
  matcher: ['/api/:path*', '/d/:path*'],
};

/**
 * Lapisan keamanan untuk semua endpoint /api/*:
 *  - Rate limit per IP (login & extract lebih ketat).
 *  - Hanya menerima request dari situs sendiri (anti-hotlink / cross-site).
 *  - Menandai respons API sebagai noindex.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204 });
  }

  const ip = clientIp(req.headers);
  const { limit, bucket } = limitForPath(pathname);
  const rl = rateLimit(`${bucket}:${ip}`, limit, 60000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  }

  const res = NextResponse.next();
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}
