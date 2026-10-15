import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { minFail?: number; onlyScraped?: boolean };
  const minFail = Math.max(Number(body.minFail) || 5, 1);
  const onlyScraped = body.onlyScraped !== false;

  const res = await prisma.proxy.deleteMany({
    where: {
      failCount: { gte: minFail },
      ...(onlyScraped ? { source: 'scrape' } : {}),
    },
  });

  return NextResponse.json({ ok: true, deleted: res.count, minFail, onlyScraped });
}
