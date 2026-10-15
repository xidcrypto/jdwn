import { NextResponse } from 'next/server';
import { getSessionByToken } from '@/lib/auth';
import { extractWithFailover } from '@/lib/extractService';
import { buildVideoResponse } from '@/lib/videoResponse';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function handle(req: Request) {
  const u = new URL(req.url);
  const embedUrl = u.searchParams.get('url');
  if (!embedUrl) return NextResponse.json({ error: 'Parameter "url" wajib diisi' }, { status: 400 });

  const token = u.searchParams.get('token');
  const sess = await getSessionByToken(token);
  if (!sess) {
    return NextResponse.json({ error: 'Token tidak valid (parameter ?token=)' }, { status: 401 });
  }

  let info;
  try {
    info = await extractWithFailover(embedUrl);
  } catch (e) {
    return NextResponse.json({ error: 'Ekstraksi gagal: ' + (e as Error).message }, { status: 502 });
  }

  let referer: string | null = null;
  try {
    referer = new URL(embedUrl).origin + '/';
  } catch {
    referer = null;
  }

  return buildVideoResponse({
    req,
    videoUrl: info.videoUrl,
    referer,
    download: u.searchParams.get('download') === '1',
    name: u.searchParams.get('name') || info.title || info.videoId,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function HEAD(req: Request) {
  return handle(req);
}
