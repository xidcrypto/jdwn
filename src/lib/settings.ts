import { prisma } from './prisma';

export interface AppSettings {
  siteName: string;
  allowedDomains: string[];
  allowAllDomains: boolean;
  publicEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  siteName: 'jwplyr Extractor',
  allowedDomains: ['jwplyr.com'],
  allowAllDomains: false,
  publicEnabled: true,
};

function parseBool(v: string | undefined, def: boolean): boolean {
  if (v === undefined) return def;
  return v === '1' || v === 'true' || v === 'on';
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

  return {
    siteName: map.siteName?.trim() || DEFAULT_SETTINGS.siteName,
    allowedDomains: domains,
    allowAllDomains: parseBool(map.allowAllDomains, DEFAULT_SETTINGS.allowAllDomains),
    publicEnabled: parseBool(map.publicEnabled, DEFAULT_SETTINGS.publicEnabled),
  };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const entries: Array<[string, string]> = [];
  if (patch.siteName !== undefined) {
    entries.push(['siteName', String(patch.siteName).trim().slice(0, 60) || DEFAULT_SETTINGS.siteName]);
  }
  if (patch.allowedDomains !== undefined) {
    entries.push(['allowedDomains', JSON.stringify(normalizeDomains(patch.allowedDomains))]);
  }
  if (patch.allowAllDomains !== undefined) {
    entries.push(['allowAllDomains', patch.allowAllDomains ? '1' : '0']);
  }
  if (patch.publicEnabled !== undefined) {
    entries.push(['publicEnabled', patch.publicEnabled ? '1' : '0']);
  }

  await Promise.all(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  );

  return getSettings();
}

export function isUrlAllowed(url: string, settings: AppSettings): boolean {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host) return false;
  if (settings.allowAllDomains) return true;
  return settings.allowedDomains.some((d) => host === d || host.endsWith('.' + d));
}
