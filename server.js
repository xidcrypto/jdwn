// server.js — Backend jwplyr extractor: SQLite + 1 akun admin + manajemen proxy.
// Murni Node.js, tanpa dependensi npm. Butuh Node.js 22.5+ (untuk node:sqlite).
//
//   node server.js              -> jalan di port 3000 (atau $PORT)
//   DB: ./data.db (atau $DB_PATH)
//   Admin pertama dibuat otomatis saat pertama jalan:
//     - dari $ADMIN_USER / $ADMIN_PASS, atau
//     - username "admin" + password acak yang dicetak ke console.
//
// API (semua butuh Authorization: Bearer <token>, kecuali /api/login):
//   POST /api/login                  {username, password} -> {token, expiresAt}
//   POST /api/logout
//   GET  /api/me
//   POST /api/change-password        {oldPassword, newPassword}
//   GET  /api/proxies                -> [{id, proxy(mask), enabled, failCount, source, ...}]
//   POST /api/proxies                {proxy} -> tambah satu
//   POST /api/proxies/bulk           {proxies:[...]} atau {text:"..."} -> tambah banyak
//   POST /api/proxies/scrape         {sources?} -> scrape proxy gratis -> tambah ke DB
//   POST /api/proxies/test-all       {limit?, concurrency?, disableFailed?} -> uji massal
//   POST /api/proxies/prune          {minFail?, onlyScraped?} -> hapus proxy yg sering gagal
//   PATCH /api/proxies/:id           {enabled} -> aktif/nonaktif
//   DELETE /api/proxies/:id
//   POST /api/proxies/:id/test       -> uji proxy {ok, ms} / {ok:false, error}
//   POST /api/extract                {url} -> {videoId, title, videoUrl, expiresAt, ...}
//   GET  /api/download?url=..&token=..[&name=..] -> stream MP4 (bisa diputar langsung)
// UI admin: buka http://localhost:3000/ di browser.

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db, DB_PATH } = require('./db');
const { extractVideoUrl, openVideoStream, fetchText, parseProxy, maskProxy } = require('./extractor');
const { scrapeProxies, getSources } = require('./proxyScraper');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const SESSION_DAYS = 7;

// ---------- auth ----------

function hashPassword(pw, salt) {
  return crypto.scryptSync(String(pw), salt, 64).toString('hex');
}

function ensureAdmin() {
  const row = db.prepare('SELECT id FROM admin WHERE id = 1').get();
  if (row) return;
  const username = process.env.ADMIN_USER || 'admin';
  let password = process.env.ADMIN_PASS;
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(12).toString('base64url');
    generated = true;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO admin (id, username, password_hash, salt) VALUES (1, ?, ?, ?)')
    .run(username, hashPassword(password, salt), salt);
  console.log('');
  console.log('=== AKUN ADMIN DIBUAT ===');
  console.log('  Username : ' + username);
  console.log('  Password : ' + password);
  if (generated) console.log('  (password acak — simpan baik-baik, bisa diganti di menu Pengaturan)');
  console.log('=========================');
  console.log('');
}

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  db.prepare('INSERT INTO sessions (token, expires_at) VALUES (?, ?)').run(token, expires);
  return { token, expiresAt: expires };
}

function getSession(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(m[1].trim());
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(row.token);
    return null;
  }
  return row;
}

// ---------- helpers ----------

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  });
  res.end(body);
}

function readBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error('Body terlalu besar'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const text = await readBody(req);
  if (!text) return {};
  return JSON.parse(text);
}

function serveAdminHtml(res) {
  const file = path.join(__dirname, 'admin.html');
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('admin.html tidak ditemukan');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}

// ---------- proxy ----------

function normalizeProxy(str) {
  const u = parseProxy(str); // null bila kosong/komentar
  if (!u) return null;
  return u.toString();
}

// Insert banyak proxy dalam satu transaksi (jauh lebih cepat utk ribuan baris).
function bulkInsertProxies(list, source) {
  db.exec('BEGIN');
  try {
    let added = 0, skipped = 0;
    const ins = db.prepare('INSERT INTO proxies (url, source) VALUES (?, ?)');
    for (const raw of list) {
      const norm = source === 'scrape' ? raw : normalizeProxy(raw);
      if (!norm) { skipped++; continue; }
      try { ins.run(norm, source); added++; }
      catch { skipped++; } // duplikat (UNIQUE)
    }
    db.exec('COMMIT');
    return { added, skipped };
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* abaikan */ }
    throw e;
  }
}

function pickProxy() {
  // Proxy yang sering gagal tenggelam ke bawah (fail_count ASC), lalu round-robin.
  const row = db.prepare(`
    SELECT * FROM proxies WHERE enabled = 1
    ORDER BY fail_count ASC, COALESCE(last_used_at, '1970-01-01') ASC, id ASC LIMIT 1
  `).get();
  if (!row) return null;
  db.prepare(`UPDATE proxies SET last_used_at = datetime('now') WHERE id = ?`).run(row.id);
  return row;
}

// Ekstraksi dengan failover: coba tiap proxy aktif (yang sehat dulu), terakhir direct.
// Dibatasi MAX_PROXY_TRIES agar tidak terlalu lama bila pool berisi banyak proxy mati.
const MAX_PROXY_TRIES = Math.max(parseInt(process.env.PROXY_MAX_TRIES || '8', 10) || 8, 1);
async function extractWithFailover(embedUrl) {
  const proxies = db.prepare(
    'SELECT * FROM proxies WHERE enabled = 1 ORDER BY fail_count ASC, id LIMIT ?'
  ).all(MAX_PROXY_TRIES);
  let lastErr = null;
  const tried = [];
  for (const p of [...proxies, null]) {
    try {
      const result = await extractVideoUrl(embedUrl, p ? p.url : null);
      if (p) {
        db.prepare('UPDATE proxies SET fail_count = 0, last_used_at = datetime(\'now\') WHERE id = ?').run(p.id);
        return { ...result, proxyId: p.id, proxy: maskProxy(p.url) };
      }
      return { ...result, proxyId: null, proxy: 'langsung (tanpa proxy)' };
    } catch (e) {
      lastErr = e;
      if (p) {
        db.prepare('UPDATE proxies SET fail_count = fail_count + 1 WHERE id = ?').run(p.id);
        tried.push({ id: p.id, proxy: maskProxy(p.url), error: e.message });
      }
    }
  }
  const err = new Error(
    'Semua jalur gagal' + (tried.length ? ' (proxy: ' + tried.map((t) => t.error).join(' | ') + ')' : '') +
    (lastErr ? ' -> ' + lastErr.message : '')
  );
  err.tried = tried;
  throw err;
}

// ---------- routes ----------

async function handleLogin(req, res) {
  const { username, password } = await readJson(req);
  const admin = db.prepare('SELECT * FROM admin WHERE username = ?').get(String(username || ''));
  const ok = admin && crypto.timingSafeEqual(
    Buffer.from(hashPassword(password || '', admin.salt), 'hex'),
    Buffer.from(admin.password_hash, 'hex')
  );
  if (!ok) return sendJson(res, 401, { error: 'Username atau password salah' });
  const s = createSession();
  sendJson(res, 200, { token: s.token, expiresAt: s.expiresAt, username: admin.username });
}

async function handleExtract(req, res) {
  const { url } = await readJson(req);
  if (!url || !/^https?:\/\//i.test(String(url))) {
    return sendJson(res, 400, { error: 'Field "url" wajib diisi dengan URL embed jwplyr' });
  }
  try {
    const r = await extractWithFailover(String(url).trim());
    sendJson(res, 200, {
      videoId: r.videoId,
      title: r.title,
      videoUrl: r.videoUrl,
      thumb: r.thumb,
      expiresAt: r.expiresAt,
      proxyId: r.proxyId,
      proxy: r.proxy,
    });
  } catch (e) {
    sendJson(res, 502, { error: e.message, tried: e.tried || [] });
  }
}

async function handleDownload(req, res, query) {
  const embedUrl = query.get('url');
  if (!embedUrl) return sendJson(res, 400, { error: 'Parameter "url" wajib diisi' });
  let info;
  try {
    info = await extractWithFailover(embedUrl);
  } catch (e) {
    return sendJson(res, 502, { error: 'Ekstraksi gagal: ' + e.message });
  }
  // proxy yang dipakai saat ekstraksi dipakai juga untuk stream video
  const proxyRow = info.proxyId
    ? db.prepare('SELECT url FROM proxies WHERE id = ?').get(info.proxyId)
    : null;
  const proxyUrl = proxyRow ? proxyRow.url : null;
  try {
    const { status, headers, stream } = await openVideoStream(info.videoUrl, {
      referer: 'https://jwplyr.com/',
      range: req.headers['range'],
      proxyUrl,
    });
    const out = {
      'Content-Type': headers['content-type'] || 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    };
    if (headers['content-length']) out['Content-Length'] = headers['content-length'];
    if (status === 206 && headers['content-range']) out['Content-Range'] = headers['content-range'];
    const dlName = query.get('name');
    if (query.get('download') === '1') {
      const safe = String(dlName || (info.title || info.videoId)).replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
      out['Content-Disposition'] = `attachment; filename="${/\.mp4$/i.test(safe) ? safe : safe + '.mp4'}"`;
    }
    res.writeHead(status, out);
    if (req.method === 'HEAD') {
      // HEAD: header saja, tanpa body
      try { stream.destroy(); } catch { /* abaikan */ }
      res.end();
      return;
    }
    stream.on('error', () => { try { res.end(); } catch { /* abaikan */ } });
    stream.pipe(res);
  } catch (e) {
    if (!res.headersSent) sendJson(res, e.status === 403 || e.status === 404 ? e.status : 502, { error: e.message });
    else try { res.end(); } catch { /* abaikan */ }
  }
}

async function handleProxyTest(req, res, id) {
  const row = db.prepare('SELECT * FROM proxies WHERE id = ?').get(id);
  if (!row) return sendJson(res, 404, { error: 'Proxy tidak ditemukan' });
  const t0 = Date.now();
  try {
    const r = await fetchText('https://jwplyr.com/', {}, row.url);
    const ms = Date.now() - t0;
    const ok = r.status === 200;
    db.prepare('UPDATE proxies SET last_test_ok = ?, last_test_at = datetime(\'now\') WHERE id = ?')
      .run(ok ? 1 : 0, id);
    sendJson(res, 200, { ok, ms, status: r.status });
  } catch (e) {
    db.prepare('UPDATE proxies SET last_test_ok = 0, last_test_at = datetime(\'now\') WHERE id = ?').run(id);
    sendJson(res, 200, { ok: false, error: e.message });
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    });
    res.end();
    return;
  }

  try {
    // halaman admin
    if ((p === '/' || p === '/admin') && req.method === 'GET') return serveAdminHtml(res);

    // login (publik)
    if (p === '/api/login' && req.method === 'POST') return await handleLogin(req, res);

    // download: token via query (untuk <video> / browser langsung)
    if (p === '/api/download' && (req.method === 'GET' || req.method === 'HEAD')) {
      const tok = u.searchParams.get('token');
      if (tok) {
        const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(tok);
        if (s && new Date(s.expires_at).getTime() > Date.now()) {
          return await handleDownload(req, res, u.searchParams);
        }
      }
      return sendJson(res, 401, { error: 'Token tidak valid (parameter ?token=)' });
    }

    // sisanya butuh Bearer token
    const sess = getSession(req);
    if (!sess) return sendJson(res, 401, { error: 'Unauthorized: login dulu' });

    if (p === '/api/logout' && req.method === 'POST') {
      const m = /^Bearer\s+(.+)$/i.exec(req.headers['authorization'] || '');
      if (m) db.prepare('DELETE FROM sessions WHERE token = ?').run(m[1].trim());
      return sendJson(res, 200, { ok: true });
    }
    if (p === '/api/me' && req.method === 'GET') {
      const admin = db.prepare('SELECT username, created_at FROM admin WHERE id = 1').get();
      const pc = db.prepare('SELECT COUNT(*) c FROM proxies').get().c;
      const pe = db.prepare('SELECT COUNT(*) c FROM proxies WHERE enabled = 1').get().c;
      return sendJson(res, 200, { username: admin.username, createdAt: admin.created_at, proxyTotal: pc, proxyEnabled: pe });
    }
    if (p === '/api/change-password' && req.method === 'POST') {
      const { oldPassword, newPassword } = await readJson(req);
      const admin = db.prepare('SELECT * FROM admin WHERE id = 1').get();
      const ok = crypto.timingSafeEqual(
        Buffer.from(hashPassword(oldPassword || '', admin.salt), 'hex'),
        Buffer.from(admin.password_hash, 'hex')
      );
      if (!ok) return sendJson(res, 400, { error: 'Password lama salah' });
      if (!newPassword || String(newPassword).length < 6) {
        return sendJson(res, 400, { error: 'Password baru minimal 6 karakter' });
      }
      const salt = crypto.randomBytes(16).toString('hex');
      db.prepare('UPDATE admin SET password_hash = ?, salt = ? WHERE id = 1')
        .run(hashPassword(newPassword, salt), salt);
      db.prepare('DELETE FROM sessions').run(); // paksa login ulang di semua perangkat
      return sendJson(res, 200, { ok: true });
    }

    // ---- proxies ----
    if (p === '/api/proxies' && req.method === 'GET') {
      const rows = db.prepare('SELECT * FROM proxies ORDER BY id').all();
      return sendJson(res, 200, rows.map((r) => ({
        id: r.id,
        proxy: maskProxy(r.url),
        enabled: !!r.enabled,
        failCount: r.fail_count,
        source: r.source || 'manual',
        lastUsedAt: r.last_used_at,
        lastTestOk: r.last_test_ok === null ? null : !!r.last_test_ok,
        lastTestAt: r.last_test_at,
        createdAt: r.created_at,
      })));
    }
    if (p === '/api/proxies' && req.method === 'POST') {
      const { proxy } = await readJson(req);
      const norm = normalizeProxy(proxy);
      if (!norm) return sendJson(res, 400, { error: 'Proxy tidak valid' });
      try {
        const r = db.prepare('INSERT INTO proxies (url) VALUES (?)').run(norm);
        return sendJson(res, 200, { ok: true, id: Number(r.lastInsertRowid) });
      } catch {
        return sendJson(res, 409, { error: 'Proxy sudah ada' });
      }
    }
    if (p === '/api/proxies/bulk' && req.method === 'POST') {
      const body = await readJson(req);
      let list = [];
      if (Array.isArray(body.proxies)) list = body.proxies;
      else if (typeof body.text === 'string') list = body.text.split('\n');
      else return sendJson(res, 400, { error: 'Kirim {proxies:[...]} atau {text:"..."}' });
      const { added, skipped } = bulkInsertProxies(list, 'manual');
      return sendJson(res, 200, { added, skipped, total: list.length });
    }
    // Scrape proxy gratis dari sumber publik -> masuk DB (dedupe otomatis).
    if (p === '/api/proxies/scrape' && req.method === 'POST') {
      const body = await readJson(req).catch(() => ({}));
      const { proxies, perSource } = await scrapeProxies(body.sources);
      const { added, skipped } = bulkInsertProxies(proxies, 'scrape');
      return sendJson(res, 200, { added, skipped, total: proxies.length, perSource });
    }
    // Uji massal proxy yang aktif (konkuren), yang gagal -> nonaktif.
    if (p === '/api/proxies/test-all' && req.method === 'POST') {
      const body = await readJson(req).catch(() => ({}));
      const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 2000);
      const concurrency = Math.min(Math.max(Number(body.concurrency) || 10, 1), 30);
      const rows = db.prepare('SELECT * FROM proxies WHERE enabled = 1 ORDER BY id LIMIT ?').all(limit);
      const FAST = { maxAttempts: 1, connectTimeoutMs: 8000, tlsTimeoutMs: 8000 };
      let okCount = 0, failCount = 0;
      const details = [];
      const upd = db.prepare(`UPDATE proxies SET last_test_ok = ?, last_test_at = datetime('now'), enabled = CASE WHEN ? THEN 0 ELSE enabled END, fail_count = CASE WHEN ? THEN fail_count + 1 ELSE 0 END WHERE id = ?`);
      let idx = 0;
      async function worker() {
        while (idx < rows.length) {
          const row = rows[idx++];
          const t0 = Date.now();
          try {
            const r = await Promise.race([
              fetchText('https://jwplyr.com/', {}, row.url, FAST),
              new Promise((_, rej) => setTimeout(() => rej(new Error('timeout uji 15 dtk')), 15000)),
            ]);
            const ok = r.status === 200;
            ok ? okCount++ : failCount++;
            // nonaktifkan yang gagal hanya bila diminta (default ya untuk hasil scrape)
            const disable = body.disableFailed !== false && !ok;
            upd.run(ok ? 1 : 0, disable ? 1 : 0, ok ? 0 : 1, row.id);
            details.push({ id: row.id, proxy: maskProxy(row.url), ok, ms: Date.now() - t0, disabled: !!disable });
          } catch (e) {
            failCount++;
            const disable = body.disableFailed !== false;
            upd.run(0, disable ? 1 : 0, 1, row.id);
            details.push({ id: row.id, proxy: maskProxy(row.url), ok: false, error: e.message, disabled: !!disable });
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));
      return sendJson(res, 200, { tested: rows.length, ok: okCount, failed: failCount, details });
    }
    // Hapus proxy yang sering gagal.
    if (p === '/api/proxies/prune' && req.method === 'POST') {
      const body = await readJson(req).catch(() => ({}));
      const minFail = Math.max(Number(body.minFail) || 5, 1);
      const onlyScraped = body.onlyScraped !== false;
      const r = db.prepare(
        `DELETE FROM proxies WHERE fail_count >= ?` + (onlyScraped ? ` AND source = 'scrape'` : '')
      ).run(minFail);
      return sendJson(res, 200, { ok: true, deleted: r.changes, minFail, onlyScraped });
    }
    let m = /^\/api\/proxies\/(\d+)$/.exec(p);
    if (m) {
      const id = Number(m[1]);
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM proxies WHERE id = ?').run(id);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'PATCH') {
        const { enabled } = await readJson(req);
        db.prepare('UPDATE proxies SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
        return sendJson(res, 200, { ok: true });
      }
    }
    m = /^\/api\/proxies\/(\d+)\/test$/.exec(p);
    if (m && req.method === 'POST') {
      return await handleProxyTest(req, res, Number(m[1]));
    }

    // ---- extract ----
    if (p === '/api/extract' && req.method === 'POST') {
      return await handleExtract(req, res);
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
});

ensureAdmin();
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} sudah dipakai aplikasi lain.`);
    console.error(`Jalankan dengan port lain, contoh: PORT=3100 node server.js\n`);
    process.exit(1);
  }
  throw e;
});

// Auto-scrape proxy gratis berkala (opsional).
// Aktifkan dengan: PROXY_SCRAPE_INTERVAL_HOURS=6 node server.js
async function autoScrapeOnce() {
  try {
    const { proxies } = await scrapeProxies();
    const { added } = bulkInsertProxies(proxies, 'scrape');
    console.log(`[auto-scrape] ${proxies.length} ditemukan, ${added} baru ditambahkan`);
  } catch (e) {
    console.log('[auto-scrape] gagal:', e.message);
  }
}
const scrapeHours = parseFloat(process.env.PROXY_SCRAPE_INTERVAL_HOURS || '0');
if (scrapeHours > 0) {
  console.log(`Auto-scrape proxy gratis aktif: tiap ${scrapeHours} jam`);
  setInterval(autoScrapeOnce, scrapeHours * 3600000).unref();
}
server.listen(PORT, () => {
  console.log('');
  console.log('Backend jwplyr extractor jalan di http://localhost:' + PORT);
  console.log('UI admin: http://localhost:' + PORT + '/');
  console.log('Database: ' + DB_PATH);
  console.log('');
});
