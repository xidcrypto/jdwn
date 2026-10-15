import { NextResponse } from 'next/server';
import { verifyPayload } from '@/lib/sign';
import { buildVideoResponse } from '@/lib/videoResponse';
import { recordDownload } from '@/lib/stats';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface PublicToken {
  u: string; // videoUrl
  t: string; // title
  r?: string; // referer (origin situs asal)
}

async function handle(req: Request) {
  const u = new URL(req.url);
  const token = u.searchParams.get('token');
  const payload = verifyPayload<PublicToken>(token);

  if (!payload || !payload.u) {
    return NextResponse.json(
      { error: 'Link tidak valid atau sudah kedaluwarsa. Silakan ekstrak ulang.' },
      { status: 401 },
    );
  }

  const download = u.searchParams.get('download') === '1';
  if (download) {
    recordDownload(payload.t).catch(() => undefined);
  }

  return buildVideoResponse({
    req,
    videoUrl: payload.u,
    referer: payload.r ?? null,
    download,
    name: u.searchParams.get('name') || payload.t,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function HEAD(req: Request) {
  return handle(req);
}
