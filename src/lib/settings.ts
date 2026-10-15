import { prisma } from './prisma';

/** Kunci platform untuk cookies terpisah (yt-dlp memakai yang cocok domain). */
export const COOKIE_PLATFORMS = ['youtube', 'instagram', 'tiktok', 'twitter', 'facebook', 'other'] as const;
export type CookiePlatform = (typeof COOKIE_PLATFORMS)[number];
/** Isi cookies (format Netscape) per platform. */
export type CookieProfiles = Partial<Record<CookiePlatform, string>>;

export interface AppSettings {
  siteName: string;
  allowedDomains: string[];
  allowedLinks: string[];
  allowAllDomains: boolean;
  publicEnabled: boolean;
  adsEnabled: boolean;
  adDownloadCode: string;
  adPlayerCode: string;
  smartlinkEnabled: boolean;
  smartlinkUrl: string;
  smartlinkDownload: boolean;
  smartlinkPlayer: boolean;
  vpnBlockEnabled: boolean;
  devGuardEnabled: boolean;
  ytdlpEnabled: boolean;
  ytdlpCookies: CookieProfiles;
  ytdlpMaxHeight: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  siteName: 'Video Downloader',
  allowedDomains: ['jwplyr.com'],
  allowedLinks: [],
  allowAllDomains: false,
  publicEnabled: true,
  adsEnabled: false,
  adDownloadCode: '',
  adPlayerCode: '',
  smartlinkEnabled: false,
  smartlinkUrl: '',
  smartlinkDownload: true,
  smartlinkPlayer: false,
  vpnBlockEnabled: true,
  devGuardEnabled: true,
  ytdlpEnabled: true,
  ytdlpCookies: {},
  ytdlpMaxHeight: 1080,
};

function parseBool(v: string | undefined, def: boolean): boolean {
  if (v === undefined) return def;
  return v === '1' || v === 'true' || v === 'on';
}

const MAX_COOKIE_CHARS = 50000;

/** Normalisasi cookies: hanya platform yang dikenal, string non-kosong. */
export function normalizeCookies(raw: unknown): CookieProfiles {
  const out: CookieProfiles = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    for (const p of COOKIE_PLATFORMS) {
      const v = obj[p];
      if (typeof v === 'string' && v.trim()) out[p] = v.slice(0, MAX_COOKIE_CHARS);
    }
  } else if (typeof raw === 'string' && raw.trim()) {
    out.other = raw.slice(0, MAX_COOKIE_CHARS);
  }
  return out;
}

function parseCookieStore(raw?: string): CookieProfiles {
  if (!raw) return {};
  try {
    return normalizeCookies(JSON.parse(raw));
  } catch {
    return normalizeCookies(raw);
  }
}

/** Bersihkan input domain: buang skema, path, port, spasi; lowercase. */
export function normalizeDomain(raw: string): string {
  let d = String(raw || '').trim().toLowerCase();
  if (!d) return '';
  d = d.replace(/^[a-z]+:\/\//, '');
  d = d.replace(/^\/\//, '');
  d = d.split('/')[0].split('?')[0].split('#')[0];
  d = d.split('@').pop() || d;
  d = d.replace(/:\d+$/, '');
  d = d.replace(/^\*\./, '').replace(/^\./, '');
  if (!/^[a-z0-9.-]+$/.test(d) || !d.includes('.')) return '';
  return d;
}

export function normalizeDomains(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    const d = normalizeDomain(String(item));
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

/** Bersihkan input link: tambahkan https:// bila perlu, buang spasi & trailing slash. */
export function normalizeLink(raw: string): string {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!u.hostname.includes('.')) return '';
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return '';
  }
}

export function normalizeLinks(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    const l = normalizeLink(String(item));
    if (l && !out.includes(l)) out.push(l);
  }
  return out;
}

function linkMatches(url: string, link: string): boolean {
  if (!url.startsWith(link)) return false;
  const rest = url.slice(link.length);
  return rest === '' || rest[0] === '/' || rest[0] === '?' || rest[0] === '#';
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  let domains = DEFAULT_SETTINGS.allowedDomains;
  if (map.allowedDomains) {
    try {
      const parsed = JSON.parse(map.allowedDomains);
      domains = normalizeDomains(parsed);
    } catch {
      domains = DEFAULT_SETTINGS.allowedDomains;
    }
  }

  let links = DEFAULT_SETTINGS.allowedLinks;
  if (map.allowedLinks) {
    try {
      links = normalizeLinks(JSON.parse(map.allowedLinks));
    } catch {
      links = DEFAULT_SETTINGS.allowedLinks;
    }
  }

  return {
    siteName: map.siteName?.trim() || DEFAULT_SETTINGS.siteName,
    allowedDomains: domains,
    allowedLinks: links,
    allowAllDomains: parseBool(map.allowAllDomains, DEFAULT_SETTINGS.allowAllDomains),
    publicEnabled: parseBool(map.publicEnabled, DEFAULT_SETTINGS.publicEnabled),
    adsEnabled: parseBool(map.adsEnabled, DEFAULT_SETTINGS.adsEnabled),
    adDownloadCode: map.adDownloadCode ?? DEFAULT_SETTINGS.adDownloadCode,
    adPlayerCode: map.adPlayerCode ?? DEFAULT_SETTINGS.adPlayerCode,
    smartlinkEnabled: parseBool(map.smartlinkEnabled, DEFAULT_SETTINGS.smartlinkEnabled),
    smartlinkUrl: map.smartlinkUrl ?? DEFAULT_SETTINGS.smartlinkUrl,
    smartlinkDownload: parseBool(map.smartlinkDownload, DEFAULT_SETTINGS.smartlinkDownload),
    smartlinkPlayer: parseBool(map.smartlinkPlayer, DEFAULT_SETTINGS.smartlinkPlayer),
    vpnBlockEnabled: parseBool(map.vpnBlockEnabled, DEFAULT_SETTINGS.vpnBlockEnabled),
    devGuardEnabled: parseBool(map.devGuardEnabled, DEFAULT_SETTINGS.devGuardEnabled),
    ytdlpEnabled: parseBool(map.ytdlpEnabled, DEFAULT_SETTINGS.ytdlpEnabled),
    ytdlpCookies: parseCookieStore(map.ytdlpCookies),
    ytdlpMaxHeight: clampMaxHeight(map.ytdlpMaxHeight),
  };
}

const ALLOWED_HEIGHTS = [480, 720, 1080, 1440, 2160];
function clampMaxHeight(v: string | undefined): number {
  const n = parseInt(String(v ?? ''), 10);
  if (!ALLOWED_HEIGHTS.includes(n)) return DEFAULT_SETTINGS.ytdlpMaxHeight;
  return n;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const entries: Array<[string, string]> = [];
  if (patch.siteName !== undefined) {
    entries.push(['siteName', String(patch.siteName).trim().slice(0, 60) || DEFAULT_SETTINGS.siteName]);
  }
  if (patch.allowedDomains !== undefined) {
    entries.push(['allowedDomains', JSON.stringify(normalizeDomains(patch.allowedDomains))]);
  }
  if (patch.allowedLinks !== undefined) {
    entries.push(['allowedLinks', JSON.stringify(normalizeLinks(patch.allowedLinks))]);
  }
  if (patch.allowAllDomains !== undefined) {
    entries.push(['allowAllDomains', patch.allowAllDomains ? '1' : '0']);
  }
  if (patch.publicEnabled !== undefined) {
    entries.push(['publicEnabled', patch.publicEnabled ? '1' : '0']);
  }
  if (patch.adsEnabled !== undefined) {
    entries.push(['adsEnabled', patch.adsEnabled ? '1' : '0']);
  }
  if (patch.adDownloadCode !== undefined) {
    entries.push(['adDownloadCode', String(patch.adDownloadCode).slice(0, 20000)]);
  }
  if (patch.adPlayerCode !== undefined) {
    entries.push(['adPlayerCode', String(patch.adPlayerCode).slice(0, 20000)]);
  }
  if (patch.smartlinkEnabled !== undefined) {
    entries.push(['smartlinkEnabled', patch.smartlinkEnabled ? '1' : '0']);
  }
  if (patch.smartlinkUrl !== undefined) {
    entries.push(['smartlinkUrl', normalizeLink(String(patch.smartlinkUrl))]);
  }
  if (patch.smartlinkDownload !== undefined) {
    entries.push(['smartlinkDownload', patch.smartlinkDownload ? '1' : '0']);
  }
  if (patch.smartlinkPlayer !== undefined) {
    entries.push(['smartlinkPlayer', patch.smartlinkPlayer ? '1' : '0']);
  }
  if (patch.vpnBlockEnabled !== undefined) {
    entries.push(['vpnBlockEnabled', patch.vpnBlockEnabled ? '1' : '0']);
  }
  if (patch.devGuardEnabled !== undefined) {
    entries.push(['devGuardEnabled', patch.devGuardEnabled ? '1' : '0']);
  }
  if (patch.ytdlpEnabled !== undefined) {
    entries.push(['ytdlpEnabled', patch.ytdlpEnabled ? '1' : '0']);
  }
  if (patch.ytdlpCookies !== undefined) {
    entries.push(['ytdlpCookies', JSON.stringify(normalizeCookies(patch.ytdlpCookies))]);
  }
  if (patch.ytdlpMaxHeight !== undefined) {
    entries.push(['ytdlpMaxHeight', String(clampMaxHeight(String(patch.ytdlpMaxHeight)))]);
  }

  await Promise.all(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  );

  return getSettings();
}

export function isUrlAllowed(url: string, settings: AppSettings): boolean {
  const clean = url.trim();
  if (settings.allowAllDomains) {
    try {
      new URL(clean);
      return true;
    } catch {
      return false;
    }
  }
  if (settings.allowedLinks.some((l) => linkMatches(clean, l))) return true;

  let host = '';
  try {
    host = new URL(clean).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host) return false;
  return settings.allowedDomains.some((d) => host === d || host.endsWith('.' + d));
}
