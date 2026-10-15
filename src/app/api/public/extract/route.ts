import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { extractWithFailover } from '@/lib/extractService';
import { signPayload } from '@/lib/sign';
import { getSettings, isUrlAllowed } from '@/lib/settings';
import { recordExtract, recordBlocked } from '@/lib/stats';
import { checkVpnForRequest } from '@/lib/vpn';

export const runtime = 'nodejs';
export const maxDuration = 120;

const LINK_TTL_MS = 60 * 60 * 1000; // 1 jam

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
  if (!isUrlAllowed(clean, settings)) {
    const list = settings.allowedDomains.join(', ') || '-';
    return NextResponse.json(
      {
        error: settings.allowAllDomains
          ? 'URL tidak valid.'
          : `Domain tidak didukung. Hanya: ${list}`,
      },
      { status: 400 },
    );
  }

  // Blokir VPN/proxy/datacenter. Admin yang login di-bypass.
  const vpn = await checkVpnForRequest(req);
  if (settings.vpnBlockEnabled && vpn.isVpn) {
    const sess = await getSession(req).catch(() => null);
    if (!sess) {
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
  }

  try {
    const r = await extractWithFailover(clean);
    await recordExtract(req, true, clean, vpn);
    const referer = new URL(clean).origin + '/';
    const token = signPayload(
      { u: r.videoUrl, t: r.title || r.videoId, r: referer },
      LINK_TTL_MS,
    );
    const base = '/api/public/download?token=' + encodeURIComponent(token);

    return NextResponse.json({
      ok: true,
      videoId: r.videoId,
      title: r.title,
      thumb: r.thumb,
      expiresAt: r.expiresAt,
      streamUrl: base,
      downloadUrl: base + '&download=1&name=' + encodeURIComponent(r.title || r.videoId),
    });
  } catch (e) {
    await recordExtract(req, false, clean, vpn);
    return NextResponse.json(
      { error: (e as Error).message || 'Gagal mengekstrak video.' },
      { status: 502 },
    );
  }
}

