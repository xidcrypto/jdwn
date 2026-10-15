import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { verifyPayload } from '@/lib/sign';
import { buildVideoResponse } from '@/lib/videoResponse';
import { recordDownload, recordBlocked } from '@/lib/stats';
import { getSettings } from '@/lib/settings';
import { checkVpnForRequest } from '@/lib/vpn';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface PublicToken {
  u: string; // videoUrl
  t: string; // title
  r?: string; // referer (origin situs asal)
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
  if (download) {
    recordDownload(req, payload.t, vpn).catch(() => undefined);
  }

  return buildVideoResponse({
    req,
    videoUrl: payload.u,
    referer: payload.r ?? null,
    download,
    name: u.searchParams.get('name') || payload.t,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function HEAD(req: Request) {
  return handle(req);
}
