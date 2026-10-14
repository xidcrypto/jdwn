// extractor.js — Inti logika ekstraksi URL video jwplyr.com (tanpa iklan).
// Dipakai oleh server.js. Murni Node.js, tanpa dependensi npm.
//
// Cara kerja:
//   1. GET /e/<id> -> baca var JS  SRC = '/ip129jk?id=...&t=<JWT>'
//      (cek "Turn off VPN" 100% client-side, diabaikan)
//   2. GET /ip129jk?... -> baca URL stream.php dari <link rel="prefetch">
//   3. GET stream.php dengan header iframe -> parse <source src="...">
//   4. URL video wajib diakses dengan header Referer: https://jwplyr.com/
//
// Semua request bisa lewat proxy opsional (string URL proxy atau null).

const net = require('net');
const tls = require('tls');
const zlib = require('zlib');
const { Readable, PassThrough } = require('stream');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const BASE_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
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

// ---------- util ----------

function decodeHtmlEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function absolutize(u, base) {
  try {
    return new URL(decodeHtmlEntities(u), base).toString();
  } catch {
    return decodeHtmlEntities(u);
  }
}

function decodeJwtPayload(token) {
  // Token jwplyr: base64url(payload).hexsignature  (bukan JWT standar!)
  // -> payload ada di segmen [0]. Fallback ke [1] untuk kompatibilitas.
  const tryPart = (part) => {
    try {
      const json = Buffer.from(
        String(part).replace(/-/g, '+').replace(/_/g, '/'), 'base64'
      ).toString('utf8');
      const o = JSON.parse(json);
      if (o && typeof o === 'object' && (o.id || o.ti || o.exp)) return o;
    } catch { /* bukan JSON */ }
    return null;
  };
  try {
    const parts = String(token).split('.');
    return tryPart(parts[0]) || tryPart(parts[1]) || null;
  } catch {
    return null;
  }
}

// Normalisasi string proxy -> URL. Tanpa skema dianggap http. null bila kosong.
function parseProxy(str) {
  if (!str) return null;
  let s = String(str).trim();
  if (!s || s.startsWith('#')) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'http://' + s;
  return new URL(s);
}

// Samarkan kredensial untuk ditampilkan: http://user:***@host:port
function maskProxy(url) {
  try {
    const u = new URL(url);
    const auth = u.username ? `${decodeURIComponent(u.username)}:***@` : '';
    return `${u.protocol}//${auth}${u.host}`;
  } catch {
    return String(url);
  }
}

// ---------- HTTP via proxy (CONNECT -> TLS -> HTTP/1.1 manual) ----------

// Handshake SOCKS5 (dengan auth username/password bila ada).
function connectViaSocks5(target, proxyUrl, opts = {}) {
  const connectTimeoutMs = opts.connectTimeoutMs || 20000;
  return new Promise((resolve, reject) => {
    const sock = net.connect(parseInt(proxyUrl.port, 10) || 1080, proxyUrl.hostname);
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error(`Proxy SOCKS5 timeout (${Math.round(connectTimeoutMs / 1000)} dtk)`));
    }, connectTimeoutMs);
    const fail = (msg) => {
      clearTimeout(timer);
      sock.destroy();
      reject(new Error(msg));
    };
    const hasAuth = !!proxyUrl.username;
    // 1. tawarkan metode auth: tanpa auth (0x00) dan user/pass (0x02)
    const methods = hasAuth ? [0x00, 0x02] : [0x00];
    sock.on('connect', () => {
      sock.write(Buffer.from([0x05, methods.length, ...methods]));
    });
    let step = 0;
    let buf = Buffer.alloc(0);
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
          // hitung panjang alamat balasan
          const atyp = buf[3];
          const addrLen = atyp === 0x01 ? 4 : atyp === 0x03 ? buf[4] : atyp === 0x04 ? 16 : 0;
          if (buf.length < 6 + addrLen) return;
          clearTimeout(timer);
          sock.removeAllListeners('data');
          resolve(sock);
        }
      } catch (e) { fail(e.message); }
    });
    sock.on('error', (e) => fail('Koneksi ke proxy gagal: ' + e.message));
    function sendConnect() {
      const host = Buffer.from(target.hostname);
      const port = target.port || 443;
      const req = Buffer.concat([
        Buffer.from([0x05, 0x01, 0x00, 0x03, host.length]),
        host,
        Buffer.from([(port >> 8) & 0xff, port & 0xff]),
      ]);
      sock.write(req);
    }
  });
}

function connectViaProxy(target, proxyUrl, opts = {}) {
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
          decodeURIComponent(proxyUrl.username) + ':' + decodeURIComponent(proxyUrl.password)
        ).toString('base64');
        head += `Proxy-Authorization: Basic ${auth}\r\n`;
      }
      head += 'Proxy-Connection: Keep-Alive\r\n\r\n';
      sock.write(head);
    });
    let buf = '';
    const onData = (chunk) => {
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

async function createTunnel(target, proxyUrl, opts = {}) {
  const t = typeof target === 'string' ? new URL(target) : target;
  const plainSock = proxyUrl.protocol.startsWith('socks')
    ? await connectViaSocks5(t, proxyUrl, opts)
    : await connectViaProxy(t, proxyUrl, opts);
  const tlsTimeoutMs = opts.tlsTimeoutMs || 20000;
  const tlsSock = await new Promise((resolve, reject) => {
    const s = tls.connect({ socket: plainSock, servername: t.hostname }, () => resolve(s));
    s.on('error', (e) => reject(new Error('TLS handshake gagal: ' + e.message)));
    s.setTimeout(tlsTimeoutMs, () => {
      s.destroy();
      reject(new Error(`TLS handshake timeout (${Math.round(tlsTimeoutMs / 1000)} dtk)`));
    });
  });
  tlsSock.setTimeout(0);
  return tlsSock;
}

function dechunk(buf) {
  const out = [];
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

// dechunker streaming
function makeDechunker(onData) {
  let buf = Buffer.alloc(0);
  let state = 'size';
  let need = 0;
  let done = false;
  return {
    push(chunk) {
      if (done) return;
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (state === 'size') {
          const j = buf.indexOf('\r\n');
          if (j === -1) return;
          const size = parseInt(buf.slice(0, j).toString('latin1').split(';')[0].trim(), 16);
          if (Number.isNaN(size)) throw new Error('Chunk tak valid');
          buf = buf.slice(j + 2);
          if (size === 0) { done = true; return; }
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

// GET teks via proxy (me-return {status, headers:{get}, body}). Dengan retry.
async function fetchTextViaProxy(url, headers, proxyUrl, opts = {}) {
  const maxAttempts = opts.maxAttempts || 6;
  const target = new URL(url);
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let tlsSock = null;
    try {
      tlsSock = await createTunnel(target, proxyUrl, opts);
      return await httpOverTls(tlsSock, target, headers);
    } catch (e) {
      lastErr = e;
      try { if (tlsSock) tlsSock.destroy(); } catch { /* abaikan */ }
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw lastErr;
}

function httpOverTls(tlsSock, target, headers) {
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
    const chunks = [];
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
        const h = {};
        for (const ln of hLines.slice(1)) {
          const ci = ln.indexOf(':');
          if (ci > 0) h[ln.slice(0, ci).trim().toLowerCase()] = ln.slice(ci + 1).trim();
        }
        let body = raw.slice(hEnd + 4);
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
        } catch { /* pakai body mentah */ }
        resolve({
          status,
          headers: { get: (k) => (h[String(k).toLowerCase()] ?? null) },
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

// ---------- fetchText publik: pilih jalur proxy / langsung ----------

async function fetchTextDirect(url, headers) {
  const res = await fetch(url, { headers, redirect: 'manual' });
  return { status: res.status, headers: res.headers, body: await res.text() };
}

// proxyUrl: string URL proxy atau null/undefined (langsung).
// opts: { maxAttempts, connectTimeoutMs, tlsTimeoutMs } — untuk proxy.
async function fetchText(url, headers = {}, proxyUrl = null, opts = {}) {
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
    const e = new Error(`HTTP ${r.status} dari ${srv}: "${snippet}"`);
    e.status = r.status;
    throw e;
  }
  return r;
}

// ---------- ekstraksi utama ----------

function parseExpiresAt(videoUrl) {
  const m = /\/(\d{10})(?:\/|$)/.exec(videoUrl);
  if (!m) return null;
  const d = new Date(parseInt(m[1], 10) * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function extractVideoUrl(embedUrl, proxyUrl = null, opts = {}) {
  const origin = new URL(embedUrl).origin;
  const videoId = new URL(embedUrl).pathname.split('/').filter(Boolean).pop();

  // 1. halaman embed -> /ip129jk
  let r = await fetchText(embedUrl, {}, proxyUrl, opts);
  if (r.status !== 200) throw new Error(`Halaman embed HTTP ${r.status}`);
  let m =
    r.body.match(/var\s+SRC\s*=\s*['"](\/ip129jk\?id=[^'"]+)['"]/) ||
    r.body.match(/['"](\/ip129jk\?id=[A-Za-z0-9]+&t=[A-Za-z0-9\-_.]+)['"]/) ||
    r.body.match(/(\/ip129jk\?[^'"<>\s]+)/);
  if (!m) throw new Error('Tidak menemukan URL /ip129jk (struktur halaman berubah?)');
  const innerUrl = absolutize(m[1], origin);

  // 2. inner player -> stream.php
  r = await fetchText(innerUrl, { Referer: embedUrl }, proxyUrl, opts);
  if (r.status !== 200) throw new Error(`Inner player HTTP ${r.status}`);
  m =
    r.body.match(/<link[^>]+rel=["']prefetch["'][^>]+href=["']([^"']*stream\.php[^"']*)["']/i) ||
    r.body.match(/href=["']([^"']*stream\.php[^"']*)["']/i) ||
    r.body.match(/(?:playerPath|streamUrl|streamURL|videoUrl)\s*[:=]\s*["']([^"']*stream\.php[^"']*)["']/i) ||
    r.body.match(/(stream\.php\?[^'"<>\s]+)/);
  if (!m) throw new Error('Tidak menemukan URL stream.php (struktur halaman berubah?)');
  const streamUrl = absolutize(m[1], origin);
  const info = decodeJwtPayload(new URL(streamUrl).searchParams.get('t'));

  // 3. stream.php mode iframe -> <source src>
  r = await fetchText(streamUrl, {
    Referer: innerUrl,
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'nested-navigate',
    'Sec-Fetch-Site': 'same-origin',
  }, proxyUrl, opts);
  if (r.status >= 300 && r.status < 400) {
    throw new Error('stream.php me-redirect (token kedaluwarsa?)');
  }
  if (r.status !== 200) throw new Error(`stream.php HTTP ${r.status}`);
  const clean = r.body.replace(/\\"/g, '"').replace(/\\'/g, "'");

  const found = [];
  const pushAny = (u) => {
    if (!u) return;
    const abs = absolutize(u.trim(), origin);
    if (/^https?:\/\//i.test(abs) && !found.includes(abs)) found.push(abs);
  };
  const pushExt = (u) => {
    if (!u) return;
    const abs = absolutize(u.trim(), origin);
    if (/\.(mp4|m3u8|webm|mpd)(\?|#|$)/i.test(abs) && !found.includes(abs)) found.push(abs);
  };
  for (const src of [clean, r.body]) {
    for (const mm of src.matchAll(/<video[^>]+src=["']([^"']+)["']/gi)) pushAny(mm[1]);
    for (const mm of src.matchAll(/<source[^>]+src=["']([^"']+)["']/gi)) pushAny(mm[1]);
    for (const mm of src.matchAll(/data-(?:src|file|video)=["']([^"']+)["']/gi)) pushAny(mm[1]);
    for (const mm of src.matchAll(/["'](https?:[^"'\s<>]+\.(?:mp4|m3u8|webm|mpd)[^"'\s<>]*)["']/gi)) pushExt(mm[1]);
    for (const mm of src.matchAll(/(?:file|src|source|videoUrl|streamUrl)\s*[:=]\s*["']([^"']+\.(?:mp4|m3u8|webm|mpd)[^"']*)["']/gi)) pushExt(mm[1]);
  }
  if (!found.length) throw new Error('URL video tidak ditemukan di HTML player');

  const videoUrl = found[0];
  return {
    videoId,
    title: (info && info.ti) || videoId,
    videoUrl,
    expiresAt: parseExpiresAt(videoUrl),
    thumb: info && info.im ? `https://i.jwplyr.com/image/${info.im}` : null,
  };
}

// ---------- streaming video (untuk /api/download) ----------
// Me-return { status, headers, stream } — stream: Node Readable.
// Server video mewajibkan Referer dari jwplyr.com.

async function openVideoStream(videoUrl, { referer, range, proxyUrl } = {}) {
  const target = new URL(videoUrl);
  const reqHeaders = {
    'User-Agent': UA,
    'Referer': referer || 'https://jwplyr.com/',
    'Accept-Encoding': 'identity',
    ...(range ? { 'Range': range } : {}),
  };
  const pu = proxyUrl ? parseProxy(proxyUrl) : null;

  if (!pu) {
    const res = await fetch(videoUrl, { headers: reqHeaders, redirect: 'follow' });
    if (res.status !== 200 && res.status !== 206) {
      const e = new Error(`Video HTTP ${res.status}`);
      e.status = res.status;
      throw e;
    }
    return {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'video/mp4',
        'content-length': res.headers.get('content-length'),
        'content-range': res.headers.get('content-range'),
        'accept-ranges': res.headers.get('accept-ranges') || 'bytes',
      },
      stream: Readable.fromWeb(res.body),
    };
  }

  const tlsSock = await createTunnel(target, pu);
  return await new Promise((resolve, reject) => {
    let head = `GET ${target.pathname + target.search} HTTP/1.1\r\nHost: ${target.hostname}\r\n`;
    for (const [k, v] of Object.entries(reqHeaders)) head += `${k}: ${v}\r\n`;
    head += 'Connection: close\r\n\r\n';

    const timer = setTimeout(() => {
      tlsSock.destroy();
      reject(new Error('Timeout buka stream video'));
    }, 30000);
    const out = new PassThrough();
    let headerBuf = Buffer.alloc(0);
    let headerDone = false;
    let dechunker = null;
    let settled = false;
    const settle = (fn) => { if (!settled) { settled = true; fn(); } };

    tlsSock.on('data', (c) => {
      try {
        if (!headerDone) {
          headerBuf = Buffer.concat([headerBuf, c]);
          const hEnd = headerBuf.indexOf('\r\n\r\n');
          if (hEnd === -1) return;
          headerDone = true;
          clearTimeout(timer);
          const hLines = headerBuf.slice(0, hEnd).toString('latin1').split('\r\n');
          const status = parseInt(hLines[0].split(' ')[1], 10);
          const rh = {};
          for (const ln of hLines.slice(1)) {
            const ci = ln.indexOf(':');
            if (ci > 0) rh[ln.slice(0, ci).trim().toLowerCase()] = ln.slice(ci + 1).trim();
          }
          if (status !== 200 && status !== 206) {
            const e = new Error(`Video HTTP ${status}`);
            e.status = status;
            tlsSock.destroy();
            reject(e);
            return;
          }
          if ((rh['transfer-encoding'] || '').toLowerCase().includes('chunked')) {
            dechunker = makeDechunker((d) => out.write(d));
          }
          settle(() => resolve({
            status,
            headers: {
              'content-type': rh['content-type'] || 'video/mp4',
              'content-length': rh['content-length'],
              'content-range': rh['content-range'],
              'accept-ranges': rh['accept-ranges'] || 'bytes',
            },
            stream: out,
          }));
          c = headerBuf.slice(hEnd + 4);
          headerBuf = null;
          if (c.length === 0) return;
        }
        if (dechunker) dechunker.push(c);
        else out.write(c);
      } catch (e) { out.destroy(e); }
    });
    const endOut = () => { try { if (dechunker) dechunker.end(); } catch { /* abaikan */ } out.end(); };
    tlsSock.on('end', endOut);
    tlsSock.on('close', endOut);
    tlsSock.on('error', (e) => out.destroy(e));
    tlsSock.write(head);
  });
}

module.exports = {
  extractVideoUrl,
  openVideoStream,
  fetchText,
  parseProxy,
  maskProxy,
  UA,
};
