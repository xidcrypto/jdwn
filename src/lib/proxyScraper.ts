export const DEFAULT_SOURCES = [
  'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
  'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
  'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
];

export function getSources(): string[] {
  const env = process.env.PROXY_SCRAPE_SOURCES;
  if (env && env.trim()) {
    return env.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_SOURCES;
}

async function fetchSource(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export function parseProxies(text: string): string[] {
  const out: string[] = [];
  for (let line of text.split('\n')) {
    line = line.trim().replace(/\r$/, '');
    const m = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/.exec(line);
    if (!m) continue;
    const port = parseInt(m[2], 10);
    if (port < 1 || port > 65535) continue;
    if (m[1].split('.').some((o) => parseInt(o, 10) > 255)) continue;
    out.push(`http://${m[1]}:${port}`);
  }
  return out;
}

export interface SourceResult {
  source: string;
  count: number;
  ok: boolean;
  error?: string;
}

export interface ScrapeResult {
  proxies: string[];
  perSource: SourceResult[];
}

export async function scrapeProxies(
  sources?: string[],
  { timeoutMs = 25000, maxPerSource = 3000 }: { timeoutMs?: number; maxPerSource?: number } = {},
): Promise<ScrapeResult> {
  const list = sources && sources.length ? sources : getSources();
  const found = new Map<string, string>();
  const perSource: SourceResult[] = [];
  for (const src of list) {
    try {
      const text = await fetchSource(src, timeoutMs);
      let count = 0;
      for (const px of parseProxies(text)) {
        if (found.has(px)) continue;
        found.set(px, src);
        count++;
        if (count >= maxPerSource) break;
      }
      perSource.push({ source: src, count, ok: true });
    } catch (e) {
      perSource.push({ source: src, count: 0, ok: false, error: (e as Error).message });
    }
  }
  return { proxies: [...found.keys()], perSource };
}
