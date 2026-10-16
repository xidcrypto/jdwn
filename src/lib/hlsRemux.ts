import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const CACHE_DIR = process.env.REMUX_CACHE_DIR || path.join(os.tmpdir(), 'jwplyr-remux');
const FILE_TTL_MS = 60 * 60 * 1000; // samakan dengan masa berlaku token

/** Sumber HLS (playlist .m3u8) tidak bisa diputar <video> / diunduh mentah. */
export function isHls(videoUrl: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(videoUrl);
}

function keyFor(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 40);
}

/** Hapus file cache yang sudah kedaluwarsa (best-effort). */
function cleanup(): void {
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(CACHE_DIR)) {
      if (!f.endsWith('.mp4')) continue;
      const p = path.join(CACHE_DIR, f);
      try {
        if (now - fs.statSync(p).mtimeMs > FILE_TTL_MS) fs.unlinkSync(p);
      } catch {
        /* abaikan */
      }
    }
  } catch {
    /* direktori belum ada */
  }
}

function runFfmpeg(
  videoUrl: string,
  referer: string | null | undefined,
  outFile: string,
  codecArgs: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-user_agent',
      UA,
      '-headers',
      `Referer: ${referer || 'https://jwplyr.com/'}\r\n`,
      '-reconnect',
      '1',
      '-reconnect_streamed',
      '1',
      '-reconnect_delay_max',
      '5',
      '-i',
      videoUrl,
      ...codecArgs,
      '-movflags',
      '+faststart',
      '-f',
      'mp4',
      outFile,
    ];
    let stderr = '';
    const child = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* abaikan */
      }
      reject(new Error('Remux HLS timeout (10 menit)'));
    }, 10 * 60 * 1000);
    child.stderr.on('data', (d) => {
      stderr = (stderr + d.toString()).slice(-2000);
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg tidak dapat dijalankan: ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg gagal (kode ${code}): ${stderr.trim().slice(-300)}`));
    });
  });
}

const inflight = new Map<string, Promise<string>>();

/**
 * Unduh sumber HLS lalu remux (tanpa re-encode bila memungkinkan) menjadi
 * satu file MP4 di direktori cache. Hasil di-cache per URL + dideduplikasi
 * agar pratinjau & unduhan tidak menjalankan ffmpeg berkali-kali.
 */
export async function remuxHlsToFile(
  videoUrl: string,
  referer?: string | null,
): Promise<string> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  cleanup();

  const out = path.join(CACHE_DIR, keyFor(videoUrl) + '.mp4');
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return out;

  const running = inflight.get(out);
  if (running) return running;

  const task = (async () => {
    const tmp = out + '.part';
    try {
      // Coba salin tanpa re-encode (cepat, tanpa kehilangan kualitas).
      await runFfmpeg(videoUrl, referer, tmp, ['-c', 'copy', '-bsf:a', 'aac_adtstoasc']);
    } catch {
      // Fallback: re-encode bila codec sumber tidak kompatibel dengan MP4.
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* abaikan */
      }
      await runFfmpeg(videoUrl, referer, tmp, [
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
      ]);
    }
    fs.renameSync(tmp, out);
    return out;
  })().finally(() => inflight.delete(out));

  inflight.set(out, task);
  return task;
}
