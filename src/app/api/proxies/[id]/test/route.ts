import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { fetchText } from '@/lib/extractor';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: Ctx) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const { id } = await params;
  const row = await prisma.proxy.findUnique({ where: { id: Number(id) } });
  if (!row) return NextResponse.json({ error: 'Proxy tidak ditemukan' }, { status: 404 });

  const t0 = Date.now();
  try {
    const r = await fetchText('https://jwplyr.com/', {}, row.url);
    const ms = Date.now() - t0;
    const ok = r.status === 200;
    await prisma.proxy.update({
      where: { id: row.id },
      data: { lastTestOk: ok, lastTestAt: new Date() },
    });
    return NextResponse.json({ ok, ms, status: r.status });
  } catch (e) {
    await prisma.proxy.update({
      where: { id: row.id },
      data: { lastTestOk: false, lastTestAt: new Date() },
    });
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }
}
