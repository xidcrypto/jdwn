import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { scrapeProxies } from '@/lib/proxyScraper';
import { insertProxies } from '@/lib/proxyStore';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { sources?: string[] };
  const { proxies, perSource } = await scrapeProxies(body.sources);
  const { added, skipped } = await insertProxies(proxies, 'scrape');
  return NextResponse.json({ added, skipped, total: proxies.length, perSource });
}
