import { clientIp } from './stats';

export interface VpnInfo {
  ip: string;
  isVpn: boolean;
  isHosting: boolean;
  isProxy: boolean;
  country: string | null;
  isp: string | null;
  /** true bila pengecekan berhasil dilakukan; false bila dilewati/gagal (fail-open). */
  checked: boolean;
}

const OK: (ip: string) => VpnInfo = (ip) => ({
  ip,
  isVpn: false,
  isHosting: false,
  isProxy: false,
  country: null,
  isp: null,
  checked: false,
});

interface CacheRow {
  exp: number;
  data: VpnInfo;
}

const cache = new Map<string, CacheRow>();
const TTL_MS = 6 * 60 * 60 * 1000; // 6 jam
const PRIVATE_RE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|::1$|fe80:|fc|fd|local$|unknown$)/i;

function isPrivate(ip: string): boolean {
  return !ip || PRIVATE_RE.test(ip);
}

/**
 * Deteksi VPN/proxy/datacenter memakai ip-api.com (gratis, tanpa API key).
 * Hasil di-cache per IP selama 6 jam. Fail-open: bila lookup gagal,
 * pengguna tetap diizinkan (isVpn=false).
 */
export async function checkVpn(ip: string): Promise<VpnInfo> {
  if (isPrivate(ip)) return OK(ip);

  const now = Date.now();
  const hit = cache.get(ip);
  if (hit && hit.exp > now) return hit.data;

  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,isp,proxy,hosting`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    const j = (await res.json()) as {
      status?: string;
      country?: string;
      isp?: string;
      proxy?: boolean;
      hosting?: boolean;
    };
    if (j.status !== 'success') {
      const data = OK(ip);
      cache.set(ip, { exp: now + 5 * 60 * 1000, data });
      return data;
    }
    const isProxy = j.proxy === true;
    const isHosting = j.hosting === true;
    const data: VpnInfo = {
      ip,
      isVpn: isProxy || isHosting,
      isProxy,
      isHosting,
      country: j.country || null,
      isp: j.isp || null,
      checked: true,
    };
    cache.set(ip, { exp: now + TTL_MS, data });
    return data;
  } catch {
    return OK(ip);
  }
}

export async function checkVpnForRequest(req: Request): Promise<VpnInfo> {
  return checkVpn(clientIp(req));
}
