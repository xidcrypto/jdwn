import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { verifyPayload } from '@/lib/sign';
import { buildVideoResponse } from '@/lib/videoResponse';
import { recordDownload, recordBlocked } from '@/lib/stats';
import { getSettings } from '@/lib/settings';
import { checkVpnForRequest } from '@/lib/vpn';

interface PublicToken {
  u: string; // videoUrl
  t: string; // title
  r?: string; // referer (origin situs asal)
}

/**
 * Logika bersama unduhan/streaming. Dipakai oleh:
 *  - /api/public/download?token=... (internal / backward-compat)
 *  - /d/[token] (URL publik yang terlihat user, token terenkripsi)
 */
export async function handlePublicDownload(
  req: Request,
  token: string | null | undefined,
): Promise<Response> {
  const u = new URL(req.url);
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

  // jwplyr: stream melalui server.
  return buildVideoResponse({
    req,
    videoUrl: payload.u,
    referer: payload.r ?? null,
    download,
    name,
  });
}
