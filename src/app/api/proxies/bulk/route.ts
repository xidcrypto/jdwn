import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { insertProxies } from '@/lib/proxyStore';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { proxies?: unknown[]; text?: string };
  let list: unknown[] = [];
  if (Array.isArray(body.proxies)) list = body.proxies;
  else if (typeof body.text === 'string') list = body.text.split('\n');
  else return NextResponse.json({ error: 'Kirim {proxies:[...]} atau {text:"..."}' }, { status: 400 });

  const { added, skipped } = await insertProxies(list, 'manual');
  return NextResponse.json({ added, skipped, total: list.length });
}
