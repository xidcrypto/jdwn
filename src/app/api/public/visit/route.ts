import { NextResponse } from 'next/server';
import { recordVisit } from '@/lib/stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await recordVisit(req);
  } catch {
    /* statistik tidak boleh mengganggu pengguna */
  }
  return NextResponse.json({ ok: true });
}
