import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { extractWithFailover } from '@/lib/extractService';
import { signPayload } from '@/lib/sign';
import { getSettings, isUrlAllowed, type AppSettings } from '@/lib/settings';
import { recordExtract, recordBlocked } from '@/lib/stats';
import { checkVpnForRequest } from '@/lib/vpn';
import { probe, isPublicUrl } from '@/lib/ytdlp';

export const runtime = 'nodejs';
export const maxDuration = 120;

const LINK_TTL_MS = 60 * 60 * 1000; // 1 jam

interface PublicToken {
  m?: string; // mode: undefined = jwplyr, 'yd' = yt-dlp direct, 'ym' = yt-dlp merge
  u: string; // video URL (direct) atau URL halaman (merge)
  h?: Record<string, string>; // extra headers (yt-dlp direct)
  t: string; // title
  r?: string; // referer (origin situs asal)
  e?: string; // ekstensi
}

function hostMatchesAllowed(url: string, settings: AppSettings): boolean {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (settings.allowedDomains.some((d) => host === d || host.endsWith('.' + d))) return true;
  return settings.allowedLinks.some((l) => {
    if (!url.startsWith(l)) return false;
    const rest = url.slice(l.length);
    return rest === '' || rest[0] === '/' || rest[0] === '?' || rest[0] === '#';
  });
}

export async function POST(req: Request) {
  const raw = await req.text().catch(() => '');
  if (raw.length > 4096) {
    return NextResponse.json({ error: 'Permintaan terlalu besar.' }, { status: 413 });
  }
  let url: unknown;
  try {
    url = (JSON.parse(raw || '{}') as { url?: unknown }).url;
  } catch {
    return NextResponse.json({ error: 'Format permintaan tidak valid.' }, { status: 400 });
  }
  const clean = String(url || '').trim().slice(0, 2048);

  const settings = await getSettings();

  if (!settings.publicEnabled) {
    return NextResponse.json(
      { error: 'Layanan publik sedang dinonaktifkan oleh admin.' },
      { status: 503 },
    );
  }

  if (!clean || !/^https?:\/\//i.test(clean)) {
    return NextResponse.json(
      { error: 'Masukkan URL video yang valid (contoh: https://jwplyr.com/e/xxxx).' },
      { status: 400 },
    );
  }

  // jwplyr (atau mode "izinkan semua" tanpa yt-dlp) diproses parser khusus.
  const jwplyrLike =
    hostMatchesAllowed(clean, settings) || (settings.allowAllDomains && !settings.ytdlpEnabled);
  if (!jwplyrLike && (!settings.ytdlpEnabled || !isPublicUrl(clean))) {
    const list = settings.allowedDomains.join(', ') || '-';
    return NextResponse.json(
      {
        error: settings.allowAllDomains
          ? 'URL tidak valid atau tidak didukung.'
          : `Domain tidak didukung. Hanya: ${list}`,
      },
      { status: 400 },
    );
  }
  if (jwplyrLike && !isUrlAllowed(clean, settings)) {
    const list = settings.allowedDomains.join(', ') || '-';
    return NextResponse.json({ error: `Domain tidak didukung. Hanya: ${list}` }, { status: 400 });
  }

  // Blokir VPN/proxy/datacenter. Admin yang login di-bypass.
  const vpn = await checkVpnForRequest(req);
  const sess = settings.vpnBlockEnabled && vpn.isVpn ? await getSession(req).catch(() => null) : null;
  if (settings.vpnBlockEnabled && vpn.isVpn && !sess) {
    await recordBlocked(req, `VPN/proxy ditolak: ${clean}`, vpn).catch(() => undefined);
    return NextResponse.json(
      {
        error:
          'VPN/proxy terdeteksi. Matikan VPN lalu coba lagi, atau gunakan koneksi internet biasa.',
        vpn: true,
      },
      { status: 403 },
    );
  }

  const referer = new URL(clean).origin + '/';

  // 1) Jalur khusus jwplyr (parser halaman embed).
  if (jwplyrLike) {
    try {
      const r = await extractWithFailover(clean);
      await recordExtract(req, true, clean, vpn);
      const token = signPayload(
        { u: r.videoUrl, t: r.title || r.videoId, r: referer },
        LINK_TTL_MS,
      );
      const base = '/d/' + encodeURIComponent(token);
      return NextResponse.json({
        ok: true,
        source: 'jwplyr',
        videoId: r.videoId,
        title: r.title,
        thumb: r.thumb,
        expiresAt: r.expiresAt,
        streamUrl: base,
        downloadUrl: base + '&download=1&name=' + encodeURIComponent(r.title || r.videoId),
      });
    } catch (e) {
      if (!settings.ytdlpEnabled || !isPublicUrl(clean)) {
        await recordExtract(req, false, clean, vpn);
        return NextResponse.json(
          { error: (e as Error).message || 'Gagal mengekstrak video.' },
          { status: 502 },
        );
      }
      // gagal di jalur jwplyr -> coba yt-dlp sebagai cadangan
    }
  }

  // 2) Jalur umum via yt-dlp (YouTube, TikTok, IG, X, dll).
  try {
    const p = await probe(clean, settings.ytdlpCookies);
    await recordExtract(req, true, `${p.extractor}: ${clean}`, vpn);

    let payload: PublicToken;
    if (p.mode === 'direct' && p.direct) {
      payload = { m: 'yd', u: p.direct.url, h: p.direct.headers, t: p.title, r: referer, e: p.direct.ext };
    } else {
      payload = { m: 'ym', u: clean, t: p.title, r: referer };
    }
    const token = signPayload(payload as unknown as Record<string, unknown>, LINK_TTL_MS);
    const base = '/d/' + encodeURIComponent(token);

    return NextResponse.json({
      ok: true,
      source: 'ytdlp',
      platform: p.extractor,
      videoId: p.id,
      title: p.title,
      thumb: p.thumb,
      duration: p.duration,
      height: p.height,
      expiresAt: null,
      streamUrl: base,
      downloadUrl: base + '&download=1&name=' + encodeURIComponent(p.title || p.id),
    });
  } catch (e) {
    await recordExtract(req, false, clean, vpn);
    return NextResponse.json(
      { error: (e as Error).message || 'Gagal mengekstrak video.' },
      { status: 502 },
    );
  }
}
