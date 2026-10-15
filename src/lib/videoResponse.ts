import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { openVideoStream } from './extractor';

export interface VideoResponseOpts {
  req: Request;
  videoUrl: string;
  referer?: string | null;
  download?: boolean;
  name?: string | null;
}

function originOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return 'https://jwplyr.com/';
  }
}

/**
 * Streams a video through the server. Selalu koneksi langsung (tanpa proxy)
 * agar streaming & download lancar. Menambahkan header Referer dari situs asal.
 */
export async function buildVideoResponse({
  req,
  videoUrl,
  referer,
  download,
  name,
}: VideoResponseOpts): Promise<Response> {
  try {
    const { status, headers, stream } = await openVideoStream(videoUrl, {
      referer: referer || originOf(videoUrl),
      range: req.headers.get('range'),
      proxyUrl: null,
    });

    const out = new Headers();
    out.set('Content-Type', headers['content-type'] || 'video/mp4');
    out.set('Accept-Ranges', 'bytes');
    out.set('Cache-Control', 'no-store');
    if (headers['content-length']) out.set('Content-Length', headers['content-length']);
    if (status === 206 && headers['content-range']) out.set('Content-Range', headers['content-range']);

    if (download) {
      const safe = String(name || 'video')
        .replace(/[\\/:*?"<>|]/g, '_')
        .slice(0, 100);
      out.set(
        'Content-Disposition',
        `attachment; filename="${/\.mp4$/i.test(safe) ? safe : safe + '.mp4'}"`,
      );
    }

    if (req.method === 'HEAD') {
      try {
        stream.destroy();
      } catch {
        /* abaikan */
      }
      return new Response(null, { status, headers: out });
    }

    stream.on('error', () => {
      try {
        stream.destroy();
      } catch {
        /* abaikan */
      }
    });

    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status,
      headers: out,
    });
  } catch (e) {
    const err = e as Error & { status?: number };
    const code = err.status === 403 || err.status === 404 ? err.status : 502;
    return NextResponse.json({ error: err.message }, { status: code });
  }
}
