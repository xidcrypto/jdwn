import { prisma } from './prisma';
import { parseProxy } from './extractor';

export function normalizeProxy(str: unknown): string | null {
  const u = parseProxy(typeof str === 'string' ? str : String(str ?? ''));
  return u ? u.toString() : null;
}

export async function insertProxies(
  list: unknown[],
  source: string,
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;
  for (const raw of list) {
    const norm = source === 'scrape' ? String(raw ?? '').trim() : normalizeProxy(raw);
    if (!norm) {
      skipped++;
      continue;
    }
    try {
      await prisma.proxy.create({ data: { url: norm, source } });
      added++;
    } catch {
      skipped++;
    }
  }
  return { added, skipped };
}
