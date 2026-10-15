import net from 'net';
import tls from 'tls';
import zlib from 'zlib';
import { Readable, PassThrough } from 'stream';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const BASE_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'sec-ch-ua': '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

export interface FetchOpts {
  maxAttempts?: number;
  connectTimeoutMs?: number;
  tlsTimeoutMs?: number;
}

export interface FetchResult {
  status: number;
  headers: { get(key: string): string | null };
  body: string;
}

// ---------- util ----------

function decodeHtmlEntities(s: string): string {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function absolutize(u: string, base: string): string {
  try {
    return new URL(decodeHtmlEntities(u), base).toString();
  } catch {
    return decodeHtmlEntities(u);
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const tryPart = (part: string): Record<string, unknown> | null => {
    try {
      const json = Buffer.from(
        String(part).replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8');
      const o = JSON.parse(json);
      if (o && typeof o === 'object' && (o.id || o.ti || o.exp)) return o;
    } catch {
      /* bukan JSON */
    }
    return null;
  };
  try {
    const parts = String(token).split('.');
    return tryPart(parts[0]) || tryPart(parts[1]) || null;
  } catch {
    return null;
  }
}

export function parseProxy(str?: string | null): URL | null {
  if (!str) return null;
  let s = String(str).trim();
  if (!s || s.startsWith('#')) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'http://' + s;
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

export function maskProxy(url: string): string {
  try {
    const u = new URL(url);
    const auth = u.username ? `${decodeURIComponent(u.username)}:***@` : '';
    return `${u.protocol}//${auth}${u.host}`;
  } catch {
    return String(url);
  }
}

// ---------- HTTP via proxy (CONNECT -> TLS -> HTTP/1.1 manual) ----------

function connectViaSocks5(
  target: URL,
  proxyUrl: URL,
  opts: FetchOpts = {},
): Promise<net.Socket> {
  const connectTimeoutMs = opts.connectTimeoutMs || 20000;
  return new Promise((resolve, reject) => {
    const sock = net.connect(parseInt(proxyUrl.port, 10) || 1080, proxyUrl.hostname);
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error(`Proxy SOCKS5 timeout (${Math.round(connectTimeoutMs / 1000)} dtk)`));
    }, connectTimeoutMs);
    const fail = (msg: string) => {
      clearTimeout(timer);
      sock.destroy();
      reject(new Error(msg));
    };
    const hasAuth = !!proxyUrl.username;
    const methods = hasAuth ? [0x00, 0x02] : [0x00];
    let step = 0;
    let buf = Buffer.alloc(0);
    const sendConnect = () => {
      const host = Buffer.from(target.hostname);
      const port = parseInt(target.port, 10) || 443;
      const req = Buffer.concat([
        Buffer.from([0x05, 0x01, 0x00, 0x03, host.length]),
        host,
        Buffer.from([(port >> 8) & 0xff, port & 0xff]),
      ]);
      sock.write(req);
    };
    sock.on('connect', () => {
      sock.write(Buffer.from([0x05, methods.length, ...methods]));
    });
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      try {
        if (step === 0) {
          if (buf.length < 2) return;
          if (buf[0] !== 0x05) return fail('Respons SOCKS5 tak valid');
          const method = buf[1];
          buf = buf.slice(2);
          if (method === 0x02) {
            const u = Buffer.from(decodeURIComponent(proxyUrl.username));
            const p = Buffer.from(decodeURIComponent(proxyUrl.password));
            if (u.length > 255 || p.length > 255) return fail('Kredensial SOCKS5 terlalu panjang');
            sock.write(Buffer.concat([Buffer.from([0x01, u.length]), u, Buffer.from([p.length]), p]));
            step = 1;
          } else if (method === 0x00) {
            step = 2;
            sendConnect();
          } else {
            return fail('Proxy SOCKS5 menolak metode auth');
          }
        } else if (step === 1) {
          if (buf.length < 2) return;
          if (buf[0] !== 0x01 || buf[1] !== 0x00) return fail('Auth SOCKS5 gagal');
          buf = buf.slice(2);
          step = 2;
          sendConnect();
        } else if (step === 2) {
          if (buf.length < 4) return;
          if (buf[0] !== 0x05 || buf[1] !== 0x00) return fail(`SOCKS5 CONNECT gagal (kode ${buf[1]})`);
          const atyp = buf[3];
          const addrLen = atyp === 0x01 ? 4 : atyp === 0x03 ? buf[4] : atyp === 0x04 ? 16 : 0;
          if (buf.length < 6 + addrLen) return;
          clearTimeout(timer);
          sock.removeAllListeners('data');
          resolve(sock);
        }
      } catch (e) {
        fail((e as Error).message);
      }
    });
    sock.on('error', (e) => fail('Koneksi ke proxy gagal: ' + e.message));
  });
}

function connectViaProxy(target: URL, proxyUrl: URL, opts: FetchOpts = {}): Promise<net.Socket> {
  const connectTimeoutMs = opts.connectTimeoutMs || 20000;
  return new Promise((resolve, reject) => {
    const sock = net.connect(parseInt(proxyUrl.port, 10) || 80, proxyUrl.hostname);
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error(`Proxy CONNECT timeout (${Math.round(connectTimeoutMs / 1000)} dtk)`));
    }, connectTimeoutMs);
    sock.on('connect', () => {
      const tHost = target.hostname + ':' + (target.port || 443);
      let head = `CONNECT ${tHost} HTTP/1.1\r\nHost: ${tHost}\r\n`;
      if (proxyUrl.username) {
        const auth = Buffer.from(
          decodeURIComponent(proxyUrl.username) + ':' + decodeURIComponent(proxyUrl.password),
        ).toString('base64');
        head += `Proxy-Authorization: Basic ${auth}\r\n`;
      }
      head += 'Proxy-Connection: Keep-Alive\r\n\r\n';
      sock.write(head);
    });
    let buf = '';
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('latin1');
      const idx = buf.indexOf('\r\n\r\n');
      if (idx === -1) return;
      const status = parseInt(buf.slice(0, buf.indexOf('\r\n')).split(' ')[1], 10);
      sock.removeListener('data', onData);
      clearTimeout(timer);
      if (status >= 200 && status < 300) resolve(sock);
      else {
        sock.destroy();
        reject(new Error(`Proxy menolak CONNECT (HTTP ${status})`));
      }
    };
    sock.on('data', onData);
    sock.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error('Koneksi ke proxy gagal: ' + e.message));
    });
  });
}

async function createTunnel(target: URL, proxyUrl: URL, opts: FetchOpts = {}): Promise<tls.TLSSocket> {
  const plainSock = proxyUrl.protocol.startsWith('socks')
    ? await connectViaSocks5(target, proxyUrl, opts)
    : await connectViaProxy(target, proxyUrl, opts);
  const tlsTimeoutMs = opts.tlsTimeoutMs || 20000;
  const tlsSock = await new Promise<tls.TLSSocket>((resolve, reject) => {
    const s = tls.connect({ socket: plainSock, servername: target.hostname }, () => resolve(s));
    s.on('error', (e) => reject(new Error('TLS handshake gagal: ' + e.message)));
    s.setTimeout(tlsTimeoutMs, () => {
      s.destroy();
      reject(new Error(`TLS handshake timeout (${Math.round(tlsTimeoutMs / 1000)} dtk)`));
    });
  });
  tlsSock.setTimeout(0);
  return tlsSock;
}

function dechunk(buf: Buffer): Buffer {
  const out: Buffer[] = [];
  let i = 0;
  for (;;) {
    const j = buf.indexOf('\r\n', i);
    if (j === -1) throw new Error('Respons chunked tak lengkap');
    const size = parseInt(buf.slice(i, j).toString('latin1').split(';')[0].trim(), 16);
    if (Number.isNaN(size)) throw new Error('Ukuran chunk tak valid');
    i = j + 2;
    if (size === 0) break;
    out.push(buf.slice(i, i + size));
    i += size + 2;
  }
  return Buffer.concat(out);
}

function makeDechunker(onData: (d: Buffer) => void) {
  let buf = Buffer.alloc(0);
  let state: 'size' | 'data' | 'crlf' = 'size';
  let need = 0;
  let done = false;
  return {
    push(chunk: Buffer) {
      if (done) return;
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (state === 'size') {
          const j = buf.indexOf('\r\n');
          if (j === -1) return;
          const size = parseInt(buf.slice(0, j).toString('latin1').split(';')[0].trim(), 16);
          if (Number.isNaN(size)) throw new Error('Chunk tak valid');
          buf = buf.slice(j + 2);
          if (size === 0) {
            done = true;
            return;
          }
          need = size;
          state = 'data';
        } else if (state === 'data') {
          if (buf.length < need) return;
          onData(buf.slice(0, need));
          buf = buf.slice(need);
          state = 'crlf';
        } else {
          if (buf.length < 2) return;
          buf = buf.slice(2);
          state = 'size';
        }
      }
    },
    end() {
      if (!done) throw new Error('Stream terpotong');
    },
  };
}

async function fetchTextViaProxy(
  url: string,
  headers: Record<string, string>,
  proxyUrl: URL,
  opts: FetchOpts = {},
): Promise<FetchResult> {
  const maxAttempts = opts.maxAttempts || 6;
  const target = new URL(url);
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let tlsSock: tls.TLSSocket | null = null;
    try {
      tlsSock = await createTunnel(target, proxyUrl, opts);
      return await httpOverTls(tlsSock, target, headers);
    } catch (e) {
      lastErr = e as Error;
      try {
        if (tlsSock) tlsSock.destroy();
      } catch {
        /* abaikan */
      }
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw lastErr ?? new Error('Proxy gagal');
}

function httpOverTls(
  tlsSock: tls.TLSSocket,
  target: URL,
  headers: Record<string, string>,
): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const path = target.pathname + target.search;
    let head = `GET ${path} HTTP/1.1\r\nHost: ${target.hostname}\r\n`;
    for (const [k, v] of Object.entries(headers)) head += `${k}: ${v}\r\n`;
    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'accept-encoding')) {
      head += 'Accept-Encoding: gzip, deflate\r\n';
    }
    head += 'Connection: close\r\n\r\n';

    const timer = setTimeout(() => {
      tlsSock.destroy();
      reject(new Error('Request timeout (30 dtk)'));
    }, 30000);
    const chunks: Buffer[] = [];
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        const raw = Buffer.concat(chunks);
        const hEnd = raw.indexOf('\r\n\r\n');
        if (hEnd === -1) throw new Error('Header respons tak lengkap');
        const hLines = raw.slice(0, hEnd).toString('latin1').split('\r\n');
        const status = parseInt(hLines[0].split(' ')[1], 10);
        const h: Record<string, string> = {};
        for (const ln of hLines.slice(1)) {
          const ci = ln.indexOf(':');
          if (ci > 0) h[ln.slice(0, ci).trim().toLowerCase()] = ln.slice(ci + 1).trim();
        }
        let body: Buffer = raw.slice(hEnd + 4);
        if ((h['transfer-encoding'] || '').toLowerCase().includes('chunked')) {
          body = dechunk(body);
        } else if (h['content-length'] && body.length < parseInt(h['content-length'], 10)) {
          throw new Error(`Body terpotong (${body.length}/${h['content-length']} bytes)`);
        }
        if (body.length === 0 && status === 200) throw new Error('Body kosong');
        const enc = (h['content-encoding'] || '').toLowerCase();
        try {
          if (enc.includes('gzip')) body = zlib.gunzipSync(body);
          else if (enc.includes('deflate')) body = zlib.inflateSync(body);
          else if (enc.includes('br')) body = zlib.brotliDecompressSync(body);
        } catch {
          /* pakai body mentah */
        }
        resolve({
          status,
          headers: { get: (k: string) => h[String(k).toLowerCase()] ?? null },
          body: body.toString('utf8'),
        });
      } catch (e) {
        reject(e);
      }
    };
    tlsSock.on('data', (c) => chunks.push(c));
    tlsSock.on('end', done);
    tlsSock.on('close', done);
    tlsSock.on('error', (e) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        reject(e);
      }
    });
    tlsSock.write(head);
  });
}

async function fetchTextDirect(url: string, headers: Record<string, string>): Promise<FetchResult> {
  const res = await fetch(url, { headers, redirect: 'manual' });
  return { status: res.status, headers: res.headers, body: await res.text() };
}

export async function fetchText(
  url: string,
  headers: Record<string, string> = {},
  proxyUrl?: string | null,
  opts: FetchOpts = {},
): Promise<FetchResult> {
  const merged = { ...BASE_HEADERS, ...headers };
  const pu = proxyUrl ? parseProxy(proxyUrl) : null;
  const r = pu
    ? await fetchTextViaProxy(url, merged, pu, opts)
    : await fetchTextDirect(url, merged);
  const srv = r.headers.get('server') || '?';
  if ([401, 403, 429].includes(r.status)) {
    const snippet = r.body
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    const e = new Error(`HTTP ${r.status} dari ${srv}: "${snippet}"`) as Error & { status?: number };
    e.status = r.status;
    throw e;
  }
  return r;
}

// ---------- ekstraksi utama ----------

function parseExpiresAt(videoUrl: string): string | null {
  const m = /\/(\d{10})(?:\/|$)/.exec(videoUrl);
  if (!m) return null;
  const d = new Date(parseInt(m[1], 10) * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export interface ExtractResult {
  videoId: string;
  title: string;
  videoUrl: string;
  expiresAt: string | null;
  thumb: string | null;
}

export async function extractVideoUrl(
  embedUrl: string,
  proxyUrl: string | null = null,
  opts: FetchOpts = {},
): Promise<ExtractResult> {
  const origin = new URL(embedUrl).origin;
  const videoId = new URL(embedUrl).pathname.split('/').filter(Boolean).pop() || '';

  let r = await fetchText(embedUrl, {}, proxyUrl, opts);
  if (r.status !== 200) throw new Error(`Halaman embed HTTP ${r.status}`);
  let m =
    r.body.match(/var\s+SRC\s*=\s*['"](\/ip129jk\?id=[^'"]+)['"]/) ||
    r.body.match(/['"](\/ip129jk\?id=[A-Za-z0-9]+&t=[A-Za-z0-9\-_.]+)['"]/) ||
    r.body.match(/(\/ip129jk\?[^'"<>\s]+)/);
  if (!m) throw new Error('Tidak menemukan URL /ip129jk (struktur halaman berubah?)');
  const innerUrl = absolutize(m[1], origin);

  r = await fetchText(innerUrl, { Referer: embedUrl }, proxyUrl, opts);
  if (r.status !== 200) throw new Error(`Inner player HTTP ${r.status}`);
  m =
    r.body.match(/<link[^>]+rel=["']prefetch["'][^>]+href=["']([^"']*stream\.php[^"']*)["']/i) ||
    r.body.match(/href=["']([^"']*stream\.php[^"']*)["']/i) ||
    r.body.match(
      /(?:playerPath|streamUrl|streamURL|videoUrl)\s*[:=]\s*["']([^"']*stream\.php[^"']*)["']/i,
    ) ||
    r.body.match(/(stream\.php\?[^'"<>\s]+)/);
  if (!m) throw new Error('Tidak menemukan URL stream.php (struktur halaman berubah?)');
  const streamUrl = absolutize(m[1], origin);
  const info = decodeJwtPayload(new URL(streamUrl).searchParams.get('t') || '');

  r = await fetchText(
    streamUrl,
    {
      Referer: innerUrl,
      'Sec-Fetch-Dest': 'iframe',
      'Sec-Fetch-Mode': 'nested-navigate',
      'Sec-Fetch-Site': 'same-origin',
    },
    proxyUrl,
    opts,
  );
  if (r.status >= 300 && r.status < 400) {
    throw new Error('stream.php me-redirect (token kedaluwarsa?)');
  }
  if (r.status !== 200) throw new Error(`stream.php HTTP ${r.status}`);
  const clean = r.body.replace(/\\"/g, '"').replace(/\\'/g, "'");

  const found: string[] = [];
  const pushAny = (u?: string) => {
    if (!u) return;
    const abs = absolutize(u.trim(), origin);
    if (/^https?:\/\//i.test(abs) && !found.includes(abs)) found.push(abs);
  };
  const pushExt = (u?: string) => {
    if (!u) return;
    const abs = absolutize(u.trim(), origin);
    if (/\.(mp4|m3u8|webm|mpd)(\?|#|$)/i.test(abs) && !found.includes(abs)) found.push(abs);
  };
  for (const src of [clean, r.body]) {
    for (const mm of src.matchAll(/<video[^>]+src=["']([^"']+)["']/gi)) pushAny(mm[1]);
    for (const mm of src.matchAll(/<source[^>]+src=["']([^"']+)["']/gi)) pushAny(mm[1]);
    for (const mm of src.matchAll(/data-(?:src|file|video)=["']([^"']+)["']/gi)) pushAny(mm[1]);
    for (const mm of src.matchAll(/["'](https?:[^"'\s<>]+\.(?:mp4|m3u8|webm|mpd)[^"'\s<>]*)["']/gi))
      pushExt(mm[1]);
    for (const mm of src.matchAll(
      /(?:file|src|source|videoUrl|streamUrl)\s*[:=]\s*["']([^"']+\.(?:mp4|m3u8|webm|mpd)[^"']*)["']/gi,
    ))
      pushExt(mm[1]);
  }
  if (!found.length) throw new Error('URL video tidak ditemukan di HTML player');

  const videoUrl = found[0];
  return {
    videoId,
    title: (info && (info.ti as string)) || videoId,
    videoUrl,
    expiresAt: parseExpiresAt(videoUrl),
    thumb: info && info.im ? `https://i.jwplyr.com/image/${info.im}` : null,
  };
}

// ---------- streaming video (untuk /api/download) ----------

export interface VideoStream {
  status: number;
  headers: Record<string, string | undefined>;
  stream: Readable;
}

function headersToRecord(h: Headers): Record<string, string | undefined> {
  return {
    'content-type': h.get('content-type') || 'video/mp4',
    'content-length': h.get('content-length') || undefined,
    'content-range': h.get('content-range') || undefined,
    'accept-ranges': h.get('accept-ranges') || 'bytes',
  };
}

export async function openVideoStream(
  videoUrl: string,
  { referer, range, proxyUrl }: { referer?: string; range?: string | null; proxyUrl?: string | null } = {},
): Promise<VideoStream> {
  const target = new URL(videoUrl);
  const reqHeaders: Record<string, string> = {
    'User-Agent': UA,
    Referer: referer || 'https://jwplyr.com/',
    'Accept-Encoding': 'identity',
    ...(range ? { Range: range } : {}),
  };
  const pu = proxyUrl ? parseProxy(proxyUrl) : null;

  if (!pu) {
    const res = await fetch(videoUrl, { headers: reqHeaders, redirect: 'follow' });
    if (res.status !== 200 && res.status !== 206) {
      const e = new Error(`Video HTTP ${res.status}`) as Error & { status?: number };
      e.status = res.status;
      throw e;
    }
    return {
      status: res.status,
      headers: headersToRecord(res.headers),
      stream: Readable.fromWeb(res.body as never),
    };
  }

  const tlsSock = await createTunnel(target, pu);
  return await new Promise<VideoStream>((resolve, reject) => {
    let head = `GET ${target.pathname + target.search} HTTP/1.1\r\nHost: ${target.hostname}\r\n`;
    for (const [k, v] of Object.entries(reqHeaders)) head += `${k}: ${v}\r\n`;
    head += 'Connection: close\r\n\r\n';

    const timer = setTimeout(() => {
      tlsSock.destroy();
      reject(new Error('Timeout buka stream video'));
    }, 30000);
    const out = new PassThrough();
    let headerBuf: Buffer | null = Buffer.alloc(0);
    let headerDone = false;
    let dechunker: ReturnType<typeof makeDechunker> | null = null;
    let settled = false;
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    tlsSock.on('data', (chunk) => {
      try {
        let c = chunk;
        if (!headerDone) {
          headerBuf = Buffer.concat([headerBuf as Buffer, c]);
          const hEnd = headerBuf.indexOf('\r\n\r\n');
          if (hEnd === -1) return;
          headerDone = true;
          clearTimeout(timer);
          const hLines = headerBuf.slice(0, hEnd).toString('latin1').split('\r\n');
          const status = parseInt(hLines[0].split(' ')[1], 10);
          const rh: Record<string, string> = {};
          for (const ln of hLines.slice(1)) {
            const ci = ln.indexOf(':');
            if (ci > 0) rh[ln.slice(0, ci).trim().toLowerCase()] = ln.slice(ci + 1).trim();
          }
          if (status !== 200 && status !== 206) {
            const e = new Error(`Video HTTP ${status}`) as Error & { status?: number };
            e.status = status;
            tlsSock.destroy();
            reject(e);
            return;
          }
          if ((rh['transfer-encoding'] || '').toLowerCase().includes('chunked')) {
            dechunker = makeDechunker((d) => out.write(d));
          }
          settle(() =>
            resolve({
              status,
              headers: {
                'content-type': rh['content-type'] || 'video/mp4',
                'content-length': rh['content-length'],
                'content-range': rh['content-range'],
                'accept-ranges': rh['accept-ranges'] || 'bytes',
              },
              stream: out,
            }),
          );
          c = headerBuf.slice(hEnd + 4);
          headerBuf = null;
          if (c.length === 0) return;
        }
        if (dechunker) dechunker.push(c);
        else out.write(c);
      } catch (e) {
        out.destroy(e as Error);
      }
    });
    const endOut = () => {
      try {
        if (dechunker) dechunker.end();
      } catch {
        /* abaikan */
      }
      out.end();
    };
    tlsSock.on('end', endOut);
    tlsSock.on('close', endOut);
    tlsSock.on('error', (e) => out.destroy(e));
    tlsSock.write(head);
  });
}
