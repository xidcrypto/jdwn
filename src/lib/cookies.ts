/**
 * Validasi ketat cookies.txt format Netscape untuk yt-dlp.
 *
 * Murni (tanpa I/O, tanpa Prisma) sehingga aman dipakai di server
 * maupun di browser. TIDAK PERNAH mengembalikan isi cookies — hanya
 * status, statistik hitungan, dan pesan kesalahan.
 */

export const MAX_COOKIE_CHARS = 50000;

/** Domain yang diharapkan per slot platform di UI admin. */
export const PLATFORM_COOKIE_DOMAINS: Record<string, string[]> = {
  youtube: ['youtube.com', 'youtu.be'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  twitter: ['twitter.com', 'x.com'],
  facebook: ['facebook.com'],
  other: [],
};

export interface CookieStats {
  chars: number;
  lines: number;
  dataRows: number;
  expiredRows: number;
  matchedDomainRows: number;
}

export interface CookieValidation {
  valid: boolean;
  empty: boolean;
  errors: string[];
  warnings: string[];
  stats: CookieStats;
}

const HEADER_RE = /^#\s*(Netscape\s+)?HTTP Cookie File/i;
const HTTPONLY_PREFIX = '#HttpOnly_';

/**
 * Perbaiki inkonsistensi format Netscape yang umum dihasilkan exporter:
 * domain berawalan titik harus berpasangan dengan kolom subdomain TRUE,
 * domain tanpa titik dengan FALSE. Python http.cookiejar menolak seluruh
 * file bila keduanya tidak konsisten (assert domain_specified == initial_dot),
 * sehingga tanpa perbaikan ini yt-dlp gagal total dengan
 * "invalid Netscape format cookies file".
 */
export function repairCookieText(raw: string): string {
  const out: string[] = [];
  for (const line of String(raw || '').split(/\r?\n/)) {
    if (!line.trim()) {
      out.push(line);
      continue;
    }
    let prefix = '';
    let row = line;
    if (row.startsWith(HTTPONLY_PREFIX)) {
      prefix = HTTPONLY_PREFIX;
      row = row.slice(HTTPONLY_PREFIX.length);
    }
    const trimmed = row.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('$')) {
      out.push(line);
      continue;
    }
    const fields = row.split('\t');
    if (fields.length >= 7) {
      fields[1] = fields[0].trim().startsWith('.') ? 'TRUE' : 'FALSE';
      out.push(prefix + fields.join('\t'));
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

function emptyStats(chars: number): CookieStats {
  return { chars, lines: 0, dataRows: 0, expiredRows: 0, matchedDomainRows: 0 };
}

/**
 * Validasi satu teks cookies untuk satu platform.
 * String kosong dianggap valid dan berarti "hapus/kosongkan".
 */
export function validateCookieText(platform: string, raw: unknown): CookieValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim())) {
    return { valid: true, empty: true, errors, warnings, stats: emptyStats(0) };
  }
  if (typeof raw !== 'string') {
    return {
      valid: false,
      empty: false,
      errors: ['Isi cookies harus berupa teks cookies.txt, bukan objek lain.'],
      warnings,
      stats: emptyStats(0),
    };
  }

  const text = raw;
  const stats = emptyStats(text.length);

  if (text.length > MAX_COOKIE_CHARS) {
    errors.push(
      `Ukuran ${text.length.toLocaleString('id-ID')} karakter melebihi batas ${MAX_COOKIE_CHARS.toLocaleString('id-ID')}. Ekspor ulang hanya untuk domain situs target agar tidak terpotong.`,
    );
    return { valid: false, empty: false, errors, warnings, stats };
  }

  const lines = text.split(/\r?\n/);
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  stats.lines = nonEmpty.length;

  const first = nonEmpty[0] || '';
  if (!HEADER_RE.test(first.trim())) {
    errors.push(
      'Baris pertama harus header Netscape (“# Netscape HTTP Cookie File”). Tempel SELURUH isi file cookies.txt hasil ekspor, bukan potongan atau format lain seperti JSON.',
    );
  }

  const expected = PLATFORM_COOKIE_DOMAINS[platform] ?? [];
  const now = Math.floor(Date.now() / 1000);
  let foreignRows = 0;
  const rowErrors: string[] = [];

  nonEmpty.forEach((line, idx) => {
    let row = line;
    if (row.startsWith(HTTPONLY_PREFIX)) row = row.slice(HTTPONLY_PREFIX.length);
    const trimmed = row.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('$')) return; // komentar
    if (idx === 0) return; // baris header sudah divalidasi di atas

    const fields = row.split('\t');
    if (fields.length < 7) {
      if (rowErrors.length < 5) {
        rowErrors.push(
          `Baris ${idx + 1}: harus 7 kolom dipisah TAB (domain, subdomain, path, secure, expiry, nama, isi). Jangan ubah TAB menjadi spasi.`,
        );
      }
      return;
    }

    const [domainRaw, subRaw, pathRaw, secureRaw, expRaw, nameRaw] = fields;
    const domain = domainRaw.trim().replace(/^\./, '').toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(domain) || !domain.includes('.')) {
      if (rowErrors.length < 5) rowErrors.push(`Baris ${idx + 1}: domain tidak valid (“${domainRaw.trim().slice(0, 40)}”).`);
      return;
    }
    if (!/^(TRUE|FALSE)$/i.test((subRaw || '').trim()) || !/^(TRUE|FALSE)$/i.test((secureRaw || '').trim())) {
      if (rowErrors.length < 5) rowErrors.push(`Baris ${idx + 1}: kolom subdomain/secure harus TRUE atau FALSE.`);
      return;
    }
    if (!(pathRaw || '').startsWith('/')) {
      if (rowErrors.length < 5) rowErrors.push(`Baris ${idx + 1}: kolom path harus diawali “/”.`);
      return;
    }
    const exp = parseInt((expRaw || '').trim(), 10);
    if (!Number.isFinite(exp) || exp < 0) {
      if (rowErrors.length < 5) rowErrors.push(`Baris ${idx + 1}: kolom expiry harus angka (0 = sesi).`);
      return;
    }
    if (!(nameRaw || '').trim()) {
      if (rowErrors.length < 5) rowErrors.push(`Baris ${idx + 1}: nama cookie kosong.`);
      return;
    }

    stats.dataRows += 1;
    if (exp !== 0 && exp <= now) stats.expiredRows += 1;
    const matched = expected.some((d) => domain === d || domain.endsWith('.' + d));
    if (matched) stats.matchedDomainRows += 1;
    else foreignRows += 1;
  });

  errors.push(...rowErrors);

  if (!errors.length && stats.dataRows === 0) {
    errors.push('Tidak ada baris cookies yang terbaca. Pastikan file berisi baris data selain komentar/header.');
  }
  if (!errors.length && expected.length > 0 && stats.matchedDomainRows === 0) {
    errors.push(
      `Tidak ada baris cookies untuk domain ${expected.join(' / ')}. Ekspor ulang cookies saat sudah login di situs tersebut.`,
    );
  }
  if (!errors.length && stats.dataRows > 0 && stats.expiredRows === stats.dataRows) {
    errors.push('Semua baris cookies sudah kedaluwarsa. Login ulang lalu ekspor ulang cookies.txt yang segar.');
  }
  if (stats.dataRows > 0 && stats.expiredRows > 0 && stats.expiredRows < stats.dataRows) {
    warnings.push(`${stats.expiredRows} dari ${stats.dataRows} baris sudah kedaluwarsa dan akan diabaikan.`);
  }
  if (foreignRows > 0 && expected.length > 0) {
    warnings.push(
      `${foreignRows} baris berasal dari domain lain; tetap dipakai karena semua profil digabung, tapi pastikan cookies situs target ikut tersalin.`,
    );
  }
  const normEndings = (s: string) => s.replace(/\r\n/g, '\n');
  if (normEndings(repairCookieText(text)) !== normEndings(text)) {
    warnings.push(
      'Kolom subdomain yang tidak konsisten (domain bertitik harus TRUE) diperbaiki otomatis saat disimpan/diuji.',
    );
  }

  return { valid: errors.length === 0, empty: false, errors, warnings, stats };
}

export interface CookieProfilesValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  perPlatform: Record<string, CookieValidation>;
}

/**
 * Validasi sekumpulan profil cookies (bentuk yang sama dengan
 * `ytdlpCookies`). Objek kosong berarti "tidak ada cookies" dan valid.
 * String tunggal diperlakukan sebagai profil `other` (seperti normalisasi).
 */
export function validateCookieProfiles(raw: unknown): CookieProfilesValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const perPlatform: Record<string, CookieValidation> = {};

  let obj: Record<string, unknown>;
  if (typeof raw === 'string') {
    obj = { other: raw };
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else if (raw === undefined || raw === null) {
    return { valid: true, errors, warnings, perPlatform };
  } else {
    return { valid: false, errors: ['Format cookies tidak dikenali.'], warnings, perPlatform };
  }

  for (const [key, value] of Object.entries(obj)) {
    if (!(key in PLATFORM_COOKIE_DOMAINS)) {
      warnings.push(`Slot “${key}” tidak dikenal dan akan diabaikan.`);
      continue;
    }
    const v = validateCookieText(key, value);
    perPlatform[key] = v;
    for (const e of v.errors) errors.push(`${key}: ${e}`);
    for (const w of v.warnings) warnings.push(`${key}: ${w}`);
  }

  return { valid: errors.length === 0, errors, warnings, perPlatform };
}
