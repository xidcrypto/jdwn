import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStats } from '@/lib/stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });
  return NextResponse.json(await getStats(7));
}
