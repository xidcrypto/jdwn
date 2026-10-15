import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { maskProxy } from '@/lib/extractor';
import { normalizeProxy } from '@/lib/proxyStore';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const rows = await prisma.proxy.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      proxy: maskProxy(r.url),
      enabled: r.enabled,
      failCount: r.failCount,
      source: r.source || 'manual',
      lastUsedAt: r.lastUsedAt,
      lastTestOk: r.lastTestOk,
      lastTestAt: r.lastTestAt,
      createdAt: r.createdAt,
    })),
  );
}

export async function POST(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const { proxy } = (await req.json().catch(() => ({}))) as { proxy?: string };
  const norm = normalizeProxy(proxy);
  if (!norm) return NextResponse.json({ error: 'Proxy tidak valid' }, { status: 400 });

  try {
    const created = await prisma.proxy.create({ data: { url: norm, source: 'manual' } });
    return NextResponse.json({ ok: true, id: created.id });
  } catch {
    return NextResponse.json({ error: 'Proxy sudah ada' }, { status: 409 });
  }
}

export async function DELETE(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const scope = new URL(req.url).searchParams.get('scope') || 'all';
  const where =
    scope === 'scraped'
      ? { source: 'scrape' }
      : scope === 'manual'
        ? { source: 'manual' }
        : scope === 'failed'
          ? { failCount: { gte: 5 } }
          : scope === 'disabled'
            ? { enabled: false }
            : {};

  const res = await prisma.proxy.deleteMany({ where });
  return NextResponse.json({ ok: true, deleted: res.count, scope });
}
