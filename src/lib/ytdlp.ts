import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { prisma } from './prisma';
import type { CookieProfiles } from './settings';

/**
 * Integrasi yt-dlp: mendukung YouTube, TikTok, Instagram, X/Twitter,
 * Facebook, dan ribuan situs lain yang didukung yt-dlp.
 *
 * - Format progresif (1 file: audio+video) -> di-stream langsung.
 * - Format adaptif (mis. YouTube) -> diunduh + di-merge ke file sementara,
 *   lalu disajikan dengan dukungan HTTP Range, lalu dibersihkan otomatis.
 */

const BIN = process.env.YTDLP_PATH || 'yt-dlp';
const CACHE_DIR = process.env.YTDLP_CACHE_DIR || path.join(os.tmpdir(), 'jwplyr-ytdlp');
const COOKIES_ENV = process.env.YTDLP_COOKIES || '';
const PROXY = process.env.YTDLP_PROXY || '';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 jam
const PROBE_TIMEOUT_MS = 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
// Batas percobaan via proxy (env YTDLP_PROXY + pool DB) saat jalur langsung gagal.
const PROXY_TRIES = Math.max(parseInt(process.env.YTDLP_PROXY_TRIES || '3', 10) || 3, 0);
const PROXY_PROBE_TIMEOUT_MS = 35 * 1000;

const COMMON_ARGS = ['--no-playlist', '--no-warnings', '--no-progress', '--no-color'];
const NET_ARGS = ['--socket-timeout', '20', '--retries', '3', '--fragment-retries', '5'];

export interface YtdlpProbe {
  id: string;
  title: string;
  thumb: string | null;
  duration: number | null;
  extractor: string;
  webpageUrl: string;
  height: number | null;
  mode: 'direct' | 'merge';
  direct?: { url: string; headers: Record<string, string>; ext: string };
}

interface RunOpts {
  timeoutMs?: number;
}

function run(args: string[], opts: RunOpts = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      reject(new Error('yt-dlp tidak dapat dijalankan: ' + (e as Error).message));
      return;
    }
    let stdout = '';
    let stderr = '';
    let done = false;
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* abaikan */
      }
      reject(new Error('yt-dlp timeout'));
    }, opts.timeoutMs || PROBE_TIMEOUT_MS);

    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
      if (stdout.length > 40 * 1024 * 1024) {
        try {
          child.kill('SIGKILL');
        } catch {
          /* abaikan */
        }
      }
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
      if (stderr.length > 64 * 1024) stderr = stderr.slice(-64 * 1024);
    });
    child.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      reject(
        new Error(
          /ENOENT/.test(e.message)
            ? 'yt-dlp tidak terpasang di server (set YTDLP_PATH).'
            : e.message,
        ),
      );
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/** Ambil baris error pertama yang berguna dari stderr yt-dlp. */
export function ytdlpError(stderr: string): string {
  const lines = stderr
    .split('\n')
    .map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').trim())
    .filter(Boolean);
  const err = lines.find((l) => /^ERROR:/i.test(l)) || lines[lines.length - 1] || '';
  let msg = err.replace(/^ERROR:\s*/i, '');
  if (/Sign in to confirm|bot/i.test(msg)) {
    return 'Situs meminta verifikasi login. Tambahkan cookies di Pengaturan admin.';
  }
  if (/cookies/i.test(msg)) {
    return 'Situs butuh cookies login. Tambahkan cookies di Pengaturan admin.';
  }
  if (/Unsupported URL|is not a valid URL/i.test(msg)) {
    return 'URL tidak dikenali / tidak didukung.';
  }
  return msg ? msg.slice(0, 300) : 'yt-dlp gagal memproses URL ini.';
}

// ---------- SSRF guard ----------

function isPrivateIpv4(ip: string): boolean {
  const p = ip.split('.').map((n) => parseInt(n, 10));
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

export function isPublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return false;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPrivateIpv4(host)) return false;
  if (host.includes(':') && /^(::1|fc|fd|fe80)/i.test(host)) return false; // IPv6 privat/loopback kasar
  return true;
}

// ---------- cookies & cache ----------

function ensureCacheDir(): string {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
  } catch {
    /* abaikan */
  }
  return CACHE_DIR;
}

/** Gabungkan cookies semua platform menjadi satu isi (format Netscape). */
function combineCookies(profiles: CookieProfiles | undefined): string {
  if (!profiles) return '';
  return Object.values(profiles)
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join('\n');
}

function cookieArgs(profiles: CookieProfiles | undefined): string[] {
  let content = combineCookies(profiles);
  if (!content && COOKIES_ENV) {
    try {
      if (fs.existsSync(COOKIES_ENV)) return ['--cookies', COOKIES_ENV];
      content = COOKIES_ENV;
    } catch {
      /* abaikan */
    }
  }
  if (!content) return [];
  const dir = ensureCacheDir();
  const file = path.join(dir, 'cookies-' + crypto.createHash('sha1').update(content).digest('hex').slice(0, 12) + '.txt');
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, content, { mode: 0o600 });
    return ['--cookies', file];
  } catch {
    return [];
  }
}

/** Kandidat proxy untuk yt-dlp: env YTDLP_PROXY dulu, lalu pool DB yang aktif. */
async function ytdlpProxyCandidates(): Promise<string[]> {
  const out: string[] = [];
  if (PROXY) out.push(PROXY);
  if (PROXY_TRIES <= 0) return out.slice(0, 1);
  try {
    const rows = await prisma.proxy.findMany({
      where: { enabled: true },
      orderBy: [{ failCount: 'asc' }, { id: 'asc' }],
      take: Math.max(PROXY_TRIES, 1),
      select: { url: true },
    });
    for (const r of rows) {
      if (r.url && !out.includes(r.url)) out.push(r.url);
      if (out.length >= Math.max(PROXY_TRIES, 1)) break;
    }
  } catch {
    /* abaikan */
  }
  return out.slice(0, Math.max(PROXY_TRIES, 1));
}

/** Bersihkan kredensial proxy dari pesan error agar tidak bocor ke UI/log. */
function scrubProxySecrets(msg: string, proxies: string[]): string {
  let out = msg;
  for (const px of proxies) {
    if (!px) continue;
    out = out.split(px).join('[proxy]');
    try {
      const u = new URL(px);
      if (u.username) {
        out = out.split(`${u.username}:${u.password}`).join('***:***');
        out = out.split(u.username).join('***');
        if (u.password) out = out.split(u.password).join('***');
      }
    } catch {
      /* bukan URL valid */
    }
  }
  return out;
}

let lastCleanup = 0;
export function cleanupCache(force = false): void {
  const now = Date.now();
  if (!force && now - lastCleanup < 10 * 60 * 1000) return;
  lastCleanup = now;
  try {
    const dir = ensureCacheDir();
    for (const name of fs.readdirSync(dir)) {
      const f = path.join(dir, name);
      try {
        const st = fs.statSync(f);
        if (now - st.mtimeMs > CACHE_TTL_MS) fs.unlinkSync(f);
      } catch {
        /* abaikan */
      }
    }
  } catch {
    /* abaikan */
  }
}

// ---------- probe ----------

interface RawFormat {
  url?: string;
  ext?: string;
  vcodec?: string;
  acodec?: string;
  height?: number;
  protocol?: string;
  format_note?: string;
  http_headers?: Record<string, string>;
}

function pickDirect(formats: RawFormat[]): YtdlpProbe['direct'] | undefined {
  const hasVideo = (f: RawFormat) => f.vcodec !== 'none';
  const hasAudio = (f: RawFormat) => f.acodec !== 'none';
  const progressive = formats.filter(
    (f) =>
      f.url &&
      hasVideo(f) &&
      hasAudio(f) &&
      (f.protocol || 'http').startsWith('http') &&
      !/m3u8|dash/i.test(f.protocol || ''),
  );
  if (!progressive.length) return undefined;
  progressive.sort((a, b) => (b.height || 0) - (a.height || 0));
  const best = progressive[0];
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(best.http_headers || {})) {
    if (/^cookie$/i.test(k)) continue;
    headers[k] = String(v);
  }
  return { url: best.url as string, headers, ext: best.ext || 'mp4' };
}

export interface ProbeReport {
  probe: YtdlpProbe;
  proxyUsed: boolean;
  attempts: number;
}

/**
 * Probe metadata: coba jalur langsung dulu, lalu fallback via proxy
 * (env YTDLP_PROXY + pool DB) bila jalur langsung gagal. Proxy hanya untuk
 * metadata yang ringan — download file tidak pernah lewat proxy.
 */
export async function probeWithReport(
  url: string,
  cookies: CookieProfiles = {},
): Promise<ProbeReport> {
  cleanupCache();
  const base = [...COMMON_ARGS, ...NET_ARGS, '-J', ...cookieArgs(cookies)];
  const proxies = await ytdlpProxyCandidates();
  const chain: (string | null)[] = [null, ...proxies];
  let lastErr: Error | null = null;
  let attempts = 0;

  for (const px of chain) {
    attempts++;
    const args = [...base, ...(px ? ['--proxy', px] : []), url];
    try {
      const { code, stdout, stderr } = await run(args, {
        timeoutMs: px ? PROXY_PROBE_TIMEOUT_MS : PROBE_TIMEOUT_MS,
      });
      if (code !== 0 || !stdout.trim()) {
        throw new Error(ytdlpError(scrubProxySecrets(stderr, proxies)));
      }

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(stdout);
      } catch {
        throw new Error('Gagal membaca metadata dari yt-dlp.');
      }

      const formats = (Array.isArray(data.formats) ? data.formats : []) as RawFormat[];
      const direct = pickDirect(formats);

      let height: number | null = null;
      if (direct) {
        const p = formats
          .filter((f) => f.vcodec !== 'none' && f.acodec !== 'none')
          .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
        height = p?.height ?? null;
      } else {
        const h = formats
          .filter((f) => f.vcodec !== 'none')
          .map((f) => f.height || 0)
          .filter(Boolean);
        height = h.length ? Math.max(...h) : null;
      }

      const thumbRaw = (data.thumbnail as string) || null;
      return {
        probe: {
          id: String(data.id || ''),
          title: String(data.title || data.id || 'video'),
          thumb: thumbRaw,
          duration: typeof data.duration === 'number' ? data.duration : null,
          extractor: String(data.extractor_key || data.extractor || ''),
          webpageUrl: String(data.webpage_url || url),
          height,
          mode: direct ? 'direct' : 'merge',
          direct,
        },
        proxyUsed: px !== null,
        attempts,
      };
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr ?? new Error('yt-dlp gagal memproses URL ini.');
}

export async function probe(url: string, cookies: CookieProfiles = {}): Promise<YtdlpProbe> {
  return (await probeWithReport(url, cookies)).probe;
}

// ---------- merge download ----------

const inflight = new Map<string, Promise<string>>();

function findOutput(dir: string, key: string): string | null {
  try {
    const hit = fs
      .readdirSync(dir)
      .filter((n) => n.startsWith(key + '.') && !/\.(part|ytdl)$/.test(n))
      .map((n) => path.join(dir, n));
    if (!hit.length) return null;
    hit.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return hit[0];
  } catch {
    return null;
  }
}

export function cacheKeyFor(url: string): string {
  return 'v-' + crypto.createHash('sha1').update(url).digest('hex').slice(0, 20);
}

/**
 * Unduh (dan merge bila perlu) video ke file lokal, lalu kembalikan path-nya.
 * Hasil di-cache sementara agar pemutaran ulang tidak mengunduh berkali-kali.
 *
 * SELALU jalur langsung, tanpa proxy: file video besar dan proxy yang
 * tersedia lambat, sehingga mengunduh via proxy hanya memperlambat semuanya.
 * Proxy hanya dipakai untuk probe metadata yang ringan.
 */
export async function downloadToFile(
  url: string,
  maxHeight: number,
  cookies: CookieProfiles = {},
): Promise<string> {
  cleanupCache();
  const dir = ensureCacheDir();
  const key = cacheKeyFor(url);
  const existing = findOutput(dir, key);
  if (existing && Date.now() - fs.statSync(existing).mtimeMs < CACHE_TTL_MS) {
    return existing;
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const fmt =
    `bv*[height<=${maxHeight}][ext=mp4]+ba[ext=m4a]/` +
    `bv*[height<=${maxHeight}]+ba/` +
    `b[height<=${maxHeight}]/b`;

  const args = [
    ...COMMON_ARGS,
    ...NET_ARGS,
    '--no-part',
    '-f',
    fmt,
    '--merge-output-format',
    'mp4',
    '-o',
    path.join(dir, key + '.%(ext)s'),
    ...cookieArgs(cookies),
    url,
  ];

  const job = (async () => {
    const { code, stderr } = await run(args, { timeoutMs: DOWNLOAD_TIMEOUT_MS });
    const out = findOutput(dir, key);
    if (code !== 0 || !out) throw new Error(ytdlpError(stderr));
    return out;
  })();

  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

export function contentTypeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mkv') return 'video/x-matroska';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.mp3') return 'audio/mpeg';
  return 'video/mp4';
}

let cachedVersion: string | null = null;
export async function ytdlpVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  const { code, stdout } = await run(['--version'], { timeoutMs: 15000 });
  cachedVersion = code === 0 ? stdout.trim() : '';
  return cachedVersion;
}
