import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings, normalizeCookies, COOKIE_PLATFORMS, type CookieProfiles } from '@/lib/settings';
import { validateCookieProfiles } from '@/lib/cookies';
import { isPublicUrl, probe } from '@/lib/ytdlp';

export const runtime = 'nodejs';

/**
 * Tes koneksi cookies (khusus admin).
 *
 * Body: { platform?: string, url: string, cookies?: Record<string,string> | string }
 * - Bila `cookies` dikirim, yang diuji adalah teks tersebut TANPA disimpan.
 * - Bila tidak dikirim, yang diuji adalah cookies yang sudah tersimpan.
 * - Bila `platform` dikirim, hanya profil platform itu yang dipakai.
 *
 * Respons tidak pernah memuat isi cookies.
 */
export async function POST(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ ok: false, error: 'Unauthorized: login dulu' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    platform?: unknown;
    url?: unknown;
    cookies?: unknown;
  };

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!/^https?:\/\//i.test(url) || !isPublicUrl(url)) {
    return NextResponse.json(
      { ok: false, error: 'URL tes tidak valid. Tempel URL video publik (http/https).' },
      { status: 400 },
    );
  }

  let profiles: CookieProfiles;
  if (body.cookies !== undefined) {
    const check = validateCookieProfiles(body.cookies);
    if (!check.valid) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Format cookies tidak valid: ' + check.errors.slice(0, 3).join(' '),
          issues: check.errors,
        },
        { status: 400 },
      );
    }
    profiles = normalizeCookies(body.cookies);
  } else {
    profiles = (await getSettings()).ytdlpCookies;
  }

  if (body.platform !== undefined) {
    const platform = String(body.platform);
    if (!(COOKIE_PLATFORMS as readonly string[]).includes(platform)) {
      return NextResponse.json({ ok: false, error: 'Platform tidak dikenal.' }, { status: 400 });
    }
    const single = profiles[platform as keyof CookieProfiles];
    if (!single || !single.trim()) {
      return NextResponse.json(
        { ok: false, error: `Cookies ${platform} masih kosong.` },
        { status: 400 },
      );
    }
    profiles = { [platform]: single } as CookieProfiles;
  }

  if (!Object.values(profiles).some((v) => (v || '').trim())) {
    return NextResponse.json(
      { ok: false, error: 'Belum ada cookies untuk diuji. Tempel cookies dulu.' },
      { status: 400 },
    );
  }

  try {
    const p = await probe(url, profiles);
    return NextResponse.json({
      ok: true,
      extractor: p.extractor,
      title: p.title,
      mode: p.mode,
      height: p.height,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || 'Tes koneksi gagal.' });
  }
}
