import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({
    siteName: s.siteName,
    publicEnabled: s.publicEnabled,
    allowAllDomains: s.allowAllDomains,
    allowedDomains: s.allowedDomains,
    allowedLinks: s.allowedLinks,
    adsEnabled: s.adsEnabled,
    adDownloadCode: s.adDownloadCode,
    adPlayerCode: s.adPlayerCode,
    smartlinkEnabled: s.smartlinkEnabled,
    smartlinkUrl: s.smartlinkUrl,
    smartlinkDownload: s.smartlinkDownload,
    smartlinkPlayer: s.smartlinkPlayer,
    devGuardEnabled: s.devGuardEnabled,
    vpnBlockEnabled: s.vpnBlockEnabled,
    ytdlpEnabled: s.ytdlpEnabled,
  });
}
