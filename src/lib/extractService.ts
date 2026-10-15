import { prisma } from './prisma';
import { extractVideoUrl, maskProxy, type ExtractResult } from './extractor';

const MAX_PROXY_TRIES = Math.max(parseInt(process.env.PROXY_MAX_TRIES || '8', 10) || 8, 1);

export interface FailoverResult extends ExtractResult {
  proxyId: number | null;
  proxy: string;
}

export interface TriedProxy {
  id: number;
  proxy: string;
  error: string;
}

export async function extractWithFailover(embedUrl: string): Promise<FailoverResult> {
  const proxies = await prisma.proxy.findMany({
    where: { enabled: true },
    orderBy: [{ failCount: 'asc' }, { id: 'asc' }],
    take: MAX_PROXY_TRIES,
  });

  let lastErr: Error | null = null;
  const tried: TriedProxy[] = [];

  for (const p of [...proxies, null]) {
    try {
      const result = await extractVideoUrl(embedUrl, p ? p.url : null);
      if (p) {
        await prisma.proxy.update({
          where: { id: p.id },
          data: { failCount: 0, lastUsedAt: new Date() },
        });
        return { ...result, proxyId: p.id, proxy: maskProxy(p.url) };
      }
      return { ...result, proxyId: null, proxy: 'langsung (tanpa proxy)' };
    } catch (e) {
      lastErr = e as Error;
      if (p) {
        await prisma.proxy.update({
          where: { id: p.id },
          data: { failCount: { increment: 1 } },
        });
        tried.push({ id: p.id, proxy: maskProxy(p.url), error: (e as Error).message });
      }
    }
  }

  const err = new Error(
    'Semua jalur gagal' +
      (tried.length ? ' (proxy: ' + tried.map((t) => t.error).join(' | ') + ')' : '') +
      (lastErr ? ' -> ' + lastErr.message : ''),
  ) as Error & { tried?: TriedProxy[] };
  err.tried = tried;
  throw err;
}
