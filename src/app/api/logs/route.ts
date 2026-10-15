import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAccessData } from '@/lib/stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const u = new URL(req.url);
  const type = u.searchParams.get('type') || undefined;
  const limit = Number(u.searchParams.get('limit') || 200) || 200;

  return NextResponse.json(await getAccessData(limit, type));
}
