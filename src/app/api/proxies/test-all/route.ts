import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { fetchText, maskProxy } from '@/lib/extractor';

export const runtime = 'nodejs';
export const maxDuration = 300;

const FAST = { maxAttempts: 1, connectTimeoutMs: 8000, tlsTimeoutMs: 8000 };

export async function POST(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    limit?: number;
    concurrency?: number;
    disableFailed?: boolean;
  };
  const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 2000);
  const concurrency = Math.min(Math.max(Number(body.concurrency) || 10, 1), 30);

  const rows = await prisma.proxy.findMany({
    where: { enabled: true },
    orderBy: { id: 'asc' },
    take: limit,
  });

  let okCount = 0;
  let failCount = 0;
  const details: Array<Record<string, unknown>> = [];
  let idx = 0;

  const worker = async () => {
    while (idx < rows.length) {
      const row = rows[idx++];
      const t0 = Date.now();
      try {
        const r = await Promise.race([
          fetchText('https://jwplyr.com/', {}, row.url, FAST),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout uji 15 dtk')), 15000)),
        ]);
        const ok = r.status === 200;
        if (ok) {
          okCount++;
          await prisma.proxy.update({
            where: { id: row.id },
            data: { lastTestOk: true, lastTestAt: new Date(), failCount: 0 },
          });
        } else {
          failCount++;
          const disable = body.disableFailed !== false;
          await prisma.proxy.update({
            where: { id: row.id },
            data: {
              lastTestOk: false,
              lastTestAt: new Date(),
              enabled: disable ? false : row.enabled,
              failCount: { increment: 1 },
            },
          });
        }
        details.push({
          id: row.id,
          proxy: maskProxy(row.url),
          ok,
          ms: Date.now() - t0,
          disabled: !ok && body.disableFailed !== false,
        });
      } catch (e) {
        failCount++;
        const disable = body.disableFailed !== false;
        await prisma.proxy.update({
          where: { id: row.id },
          data: {
            lastTestOk: false,
            lastTestAt: new Date(),
            enabled: disable ? false : row.enabled,
            failCount: { increment: 1 },
          },
        });
        details.push({
          id: row.id,
          proxy: maskProxy(row.url),
          ok: false,
          error: (e as Error).message,
          disabled: disable,
        });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));

  return NextResponse.json({ tested: rows.length, ok: okCount, failed: failCount, details });
}
