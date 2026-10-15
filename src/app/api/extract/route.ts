import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { extractWithFailover } from '@/lib/extractService';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url || !/^https?:\/\//i.test(String(url))) {
    return NextResponse.json(
      { error: 'Field "url" wajib diisi dengan URL embed jwplyr' },
      { status: 400 },
    );
  }

  try {
    const r = await extractWithFailover(String(url).trim());
    return NextResponse.json({
      videoId: r.videoId,
      title: r.title,
      videoUrl: r.videoUrl,
      thumb: r.thumb,
      expiresAt: r.expiresAt,
      proxyId: r.proxyId,
      proxy: r.proxy,
    });
  } catch (e) {
    const err = e as Error & { tried?: unknown[] };
    return NextResponse.json({ error: err.message, tried: err.tried || [] }, { status: 502 });
  }
}
