import { NextResponse } from 'next/server';
import { recordVisit } from '@/lib/stats';
import { checkVpnForRequest } from '@/lib/vpn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const vpn = await checkVpnForRequest(req);
    await recordVisit(req, vpn);
  } catch {
    /* statistik tidak boleh mengganggu pengguna */
  }
  return NextResponse.json({ ok: true });
}
