import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { verifyPayload } from '@/lib/sign';
import { buildVideoResponse, buildLocalFileResponse } from '@/lib/videoResponse';
import { recordDownload, recordBlocked } from '@/lib/stats';
import { getSettings } from '@/lib/settings';
import { checkVpnForRequest } from '@/lib/vpn';
import { downloadToFile, contentTypeFor } from '@/lib/ytdlp';

export const runtime = 'nodejs';
export const maxDuration = 600;

interface PublicToken {
  m?: string; // undefined = jwplyr, 'yd' = yt-dlp direct, 'ym' = yt-dlp merge
  u: string; // videoUrl (direct) atau URL halaman (merge)
  h?: Record<string, string>; // extra headers (yt-dlp direct)
  t: string; // title
  r?: string; // referer (origin situs asal)
  e?: string; // ekstensi
}

async function handle(req: Request) {
  const u = new URL(req.url);
  const token = u.searchParams.get('token');
  const payload = verifyPayload<PublicToken>(token);

  if (!payload || !payload.u) {
    return NextResponse.json(
      { error: 'Link tidak valid atau sudah kedaluwarsa. Silakan ekstrak ulang.' },
      { status: 401 },
    );
  }

  // Blokir VPN/proxy/datacenter. Admin yang login di-bypass.
  const settings = await getSettings();
  const vpn = await checkVpnForRequest(req);
  if (settings.vpnBlockEnabled && vpn.isVpn) {
    const sess = await getSession(req).catch(() => null);
    if (!sess) {
      await recordBlocked(req, `VPN/proxy ditolak unduh: ${payload.t}`, vpn).catch(() => undefined);
      return NextResponse.json(
        { error: 'VPN/proxy terdeteksi. Matikan VPN lalu coba lagi.', vpn: true },
        { status: 403 },
      );
    }
  }

  const download = u.searchParams.get('download') === '1';
  const name = u.searchParams.get('name') || payload.t;
  if (download) {
    recordDownload(req, payload.t, vpn).catch(() => undefined);
  }

  // yt-dlp: unduh + merge ke file sementara, lalu sajikan dengan Range.
  if (payload.m === 'ym') {
    try {
      const file = await downloadToFile(payload.u, settings.ytdlpMaxHeight, settings.ytdlpCookies);
      return buildLocalFileResponse({
        req,
        filePath: file,
        contentType: contentTypeFor(file),
        download,
        name,
      });
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message || 'Gagal mengunduh video.' },
        { status: 502 },
      );
    }
  }

  // yt-dlp: stream langsung (format progresif 1 file).
  if (payload.m === 'yd') {
    return buildVideoResponse({
      req,
      videoUrl: payload.u,
      referer: payload.r ?? null,
      headers: payload.h,
      download,
      name,
    });
  }

  // jwplyr: stream melalui server.
  return buildVideoResponse({
    req,
    videoUrl: payload.u,
    referer: payload.r ?? null,
    download,
    name,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function HEAD(req: Request) {
  return handle(req);
}
