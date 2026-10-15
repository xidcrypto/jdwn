import { NextResponse } from 'next/server';
import fs from 'fs';
import { Readable } from 'stream';
import { openVideoStream } from './extractor';

export interface VideoResponseOpts {
  req: Request;
  videoUrl: string;
  referer?: string | null;
  download?: boolean;
  name?: string | null;
  headers?: Record<string, string>;
}

function originOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return 'https://jwplyr.com/';
  }
}

export interface LocalFileResponseOpts {
  req: Request;
  filePath: string;
  contentType: string;
  download?: boolean;
  name?: string | null;
}

/** Sajikan file lokal (hasil merge yt-dlp) dengan dukungan HTTP Range. */
export function buildLocalFileResponse({
  req,
  filePath,
  contentType,
  download,
  name,
}: LocalFileResponseOpts): Response {
  let size: number;
  try {
    size = fs.statSync(filePath).size;
  } catch {
    return NextResponse.json({ error: 'File video tidak ditemukan.' }, { status: 404 });
  }

  const out = new Headers();
  out.set('Content-Type', contentType);
  out.set('Accept-Ranges', 'bytes');
  out.set('Cache-Control', 'no-store');
  if (download) {
    const safe = String(name || 'video')
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 100);
    out.set('Content-Disposition', `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`);
  }

  const rangeHeader = req.headers.get('range');
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (rangeHeader) {
    const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (m) {
      if (m[1]) start = parseInt(m[1], 10);
      if (m[2]) end = parseInt(m[2], 10);
      if (Number.isNaN(start) || start < 0) start = 0;
      if (Number.isNaN(end) || end >= size) end = size - 1;
      if (start > end || start >= size) {
        out.set('Content-Range', `bytes */${size}`);
        return new Response(null, { status: 416, headers: out });
      }
      status = 206;
      out.set('Content-Range', `bytes ${start}-${end}/${size}`);
    }
  }
  const length = end - start + 1;
  out.set('Content-Length', String(length));

  if (req.method === 'HEAD') {
    return new Response(null, { status, headers: out });
  }

  const nodeStream = fs.createReadStream(filePath, { start, end });
  return new Response(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
    status,
    headers: out,
  });
}

export async function buildVideoResponse({
  req,
  videoUrl,
  referer,
  download,
  name,
  headers,
}: VideoResponseOpts): Promise<Response> {
  try {
    const { status, headers: respHeaders, stream } = await openVideoStream(videoUrl, {
      referer: referer || originOf(videoUrl),
      range: req.headers.get('range'),
      proxyUrl: null,
      headers,
    });

    const out = new Headers();
    out.set('Content-Type', respHeaders['content-type'] || 'video/mp4');
    out.set('Accept-Ranges', 'bytes');
    out.set('Cache-Control', 'no-store');
    if (respHeaders['content-length']) out.set('Content-Length', respHeaders['content-length']);
    if (status === 206 && respHeaders['content-range'])
      out.set('Content-Range', respHeaders['content-range']);

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
