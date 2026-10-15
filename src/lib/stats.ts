import crypto from 'crypto';
import { prisma } from './prisma';
import type { VpnInfo } from './vpn';

const SECRET =
  process.env.JWT_SECRET || process.env.APP_SECRET || 'dev-insecure-secret-change-me';

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export function hashIp(ip: string): string {
  return crypto.createHmac('sha256', SECRET).update(ip).digest('hex').slice(0, 32);
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Log aktivitas disimpan maksimal 24 jam, lalu dihapus otomatis. */
export const LOG_TTL_MS = 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 30 * 60 * 1000;
let lastPruneAt = 0;

/**
 * Hapus log aktivitas yang lebih tua dari 24 jam.
 * Dijalankan berkala (maks. tiap 30 menit) saat ada aktivitas, atau dipaksa saat log dibuka.
 */
export async function pruneActivityLogs(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastPruneAt < PRUNE_INTERVAL_MS) return 0;
  lastPruneAt = now;
  try {
    const res = await prisma.activityLog.deleteMany({
      where: { createdAt: { lt: new Date(now - LOG_TTL_MS) } },
    });
    return res.count;
  } catch {
    return 0;
  }
}

/** Batas waktu (>=) untuk log yang masih berlaku. */
export function logSince(): Date {
  return new Date(Date.now() - LOG_TTL_MS);
}

interface RequestMeta {
  ip: string;
  ua: string | null;
  country: string | null;
  isVpn: boolean;
}

function requestMeta(req: Request, vpn?: VpnInfo): RequestMeta {
  return {
    ip: clientIp(req),
    ua: (req.headers.get('user-agent') || '').slice(0, 300) || null,
    country: vpn?.country ?? null,
    isVpn: vpn?.isVpn ?? false,
  };
}

export async function recordVisit(req: Request, vpn?: VpnInfo): Promise<void> {
  const ip = clientIp(req);
  const hash = hashIp(ip);
  const meta = requestMeta(req, vpn);
  const date = todayKey();

  await Promise.all([
    prisma.visitor.upsert({
      where: { ipHash: hash },
      update: {
        hits: { increment: 1 },
        userAgent: meta.ua ?? undefined,
        ip: meta.ip,
        country: meta.country ?? undefined,
        isVpn: meta.isVpn,
      },
      create: {
        ipHash: hash,
        hits: 1,
        userAgent: meta.ua,
        ip: meta.ip,
        country: meta.country,
        isVpn: meta.isVpn,
      },
    }),
    prisma.dailyStat.upsert({
      where: { date },
      update: { visits: { increment: 1 } },
      create: { date, visits: 1 },
    }),
  ]);
}

export async function recordExtract(
  req: Request,
  ok: boolean,
  detail?: string,
  vpn?: VpnInfo,
): Promise<void> {
  const date = todayKey();
  const meta = requestMeta(req, vpn);
  await Promise.all([
    prisma.dailyStat.upsert({
      where: { date },
      update: ok
        ? { extracts: { increment: 1 }, ok: { increment: 1 } }
        : { extracts: { increment: 1 }, failed: { increment: 1 } },
      create: { date, extracts: 1, ok: ok ? 1 : 0, failed: ok ? 0 : 1 },
    }),
    prisma.activityLog.create({
      data: {
        type: 'extract',
        ok,
        detail: detail?.slice(0, 300) || null,
        ip: meta.ip,
        ua: meta.ua,
        country: meta.country,
        isVpn: meta.isVpn,
      },
    }),
    pruneActivityLogs(),
  ]);
}

export async function recordDownload(
  req: Request,
  detail?: string,
  vpn?: VpnInfo,
): Promise<void> {
  const date = todayKey();
  const meta = requestMeta(req, vpn);
  await Promise.all([
    prisma.dailyStat.upsert({
      where: { date },
      update: { downloads: { increment: 1 } },
      create: { date, downloads: 1 },
    }),
    prisma.activityLog.create({
      data: {
        type: 'download',
        ok: true,
        detail: detail?.slice(0, 300) || null,
        ip: meta.ip,
        ua: meta.ua,
        country: meta.country,
        isVpn: meta.isVpn,
      },
    }),
    pruneActivityLogs(),
  ]);
}

/** Catat percobaan yang diblokir (mis. VPN/proxy terdeteksi). */
export async function recordBlocked(
  req: Request,
  detail?: string,
  vpn?: VpnInfo,
): Promise<void> {
  const meta = requestMeta(req, vpn);
  await prisma.activityLog.create({
    data: {
      type: 'blocked',
      ok: false,
      detail: detail?.slice(0, 300) || null,
      ip: meta.ip,
      ua: meta.ua,
      country: meta.country,
      isVpn: meta.isVpn,
    },
  });
  void pruneActivityLogs();
}

export interface DailyPoint {
  date: string;
  visits: number;
  extracts: number;
  downloads: number;
}

export interface AccessLog {
  id: number;
  type: string;
  detail: string | null;
  ip: string | null;
  ua: string | null;
  country: string | null;
  isVpn: boolean;
  ok: boolean;
  createdAt: string;
}

export interface VisitorRow {
  id: number;
  ip: string | null;
  country: string | null;
  isVpn: boolean;
  hits: number;
  userAgent: string | null;
  firstSeen: string;
  lastSeen: string;
}

export async function getAccessData(
  limit = 200,
  type?: string,
): Promise<{ logs: AccessLog[]; visitors: VisitorRow[] }> {
  await pruneActivityLogs(true);
  const since = logSince();
  const [logs, visitors] = await Promise.all([
    prisma.activityLog.findMany({
      where: { createdAt: { gte: since }, ...(type ? { type } : {}) },
      orderBy: { id: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    }),
    prisma.visitor.findMany({ orderBy: { lastSeen: 'desc' }, take: 200 }),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l.id,
      type: l.type,
      detail: l.detail,
      ip: l.ip,
      ua: l.ua,
      country: l.country,
      isVpn: l.isVpn,
      ok: l.ok,
      createdAt: l.createdAt.toISOString(),
    })),
    visitors: visitors.map((v) => ({
      id: v.id,
      ip: v.ip,
      country: v.country,
      isVpn: v.isVpn,
      hits: v.hits,
      userAgent: v.userAgent,
      firstSeen: v.firstSeen.toISOString(),
      lastSeen: v.lastSeen.toISOString(),
    })),
  };
}

export interface StatsResult {
  uniqueVisitors: number;
  totalHits: number;
  visitsToday: number;
  visitorsToday: number;
  extractsTotal: number;
  extractsOk: number;
  extractsFailed: number;
  downloadsTotal: number;
  proxyTotal: number;
  proxyActive: number;
  proxyDisabled: number;
  activeSessions: number;
  blockedTotal: number;
  vpnVisitors: number;
  daily: DailyPoint[];
  activity: Array<{
    id: number;
    type: string;
    detail: string | null;
    ok: boolean;
    createdAt: string;
  }>;
}

export async function getStats(days = 7): Promise<StatsResult> {
  const date = todayKey();
  const now = new Date();
  const since = logSince();
  void pruneActivityLogs();

  const [
    uniqueVisitors,
    hitAgg,
    visitorsToday,
    todayRow,
    extractAgg,
    downloadAgg,
    proxyTotal,
    proxyActive,
    proxyDisabled,
    activeSessions,
    blockedTotal,
    vpnVisitors,
    dailyRows,
    activity,
  ] = await Promise.all([
    prisma.visitor.count(),
    prisma.visitor.aggregate({ _sum: { hits: true } }),
    prisma.visitor.count({ where: { lastSeen: { gte: new Date(date + 'T00:00:00.000Z') } } }),
    prisma.dailyStat.findUnique({ where: { date } }),
    prisma.dailyStat.aggregate({ _sum: { extracts: true, ok: true, failed: true } }),
    prisma.dailyStat.aggregate({ _sum: { downloads: true } }),
    prisma.proxy.count(),
    prisma.proxy.count({ where: { enabled: true } }),
    prisma.proxy.count({ where: { enabled: false } }),
    prisma.session.count({ where: { expiresAt: { gt: now } } }),
    prisma.activityLog.count({ where: { type: 'blocked', createdAt: { gte: since } } }),
    prisma.visitor.count({ where: { isVpn: true } }),
    prisma.dailyStat.findMany({
      where: { date: { gte: todayKey(new Date(now.getTime() - (days - 1) * 86400000)) } },
      orderBy: { date: 'asc' },
    }),
    prisma.activityLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { id: 'desc' },
      take: 15,
    }),
  ]);

  const byDate = new Map(dailyRows.map((r) => [r.date, r]));
  const daily: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = todayKey(new Date(now.getTime() - i * 86400000));
    const row = byDate.get(d);
    daily.push({
      date: d,
      visits: row?.visits ?? 0,
      extracts: row?.extracts ?? 0,
      downloads: row?.downloads ?? 0,
    });
  }

  return {
    uniqueVisitors,
    totalHits: hitAgg._sum.hits ?? 0,
    visitsToday: todayRow?.visits ?? 0,
    visitorsToday,
    extractsTotal: extractAgg._sum.extracts ?? 0,
    extractsOk: extractAgg._sum.ok ?? 0,
    extractsFailed: extractAgg._sum.failed ?? 0,
    downloadsTotal: downloadAgg._sum.downloads ?? 0,
    proxyTotal,
    proxyActive,
    proxyDisabled,
    activeSessions,
    blockedTotal,
    vpnVisitors,
    daily,
    activity: activity.map((a) => ({
      id: a.id,
      type: a.type,
      detail: a.detail,
      ok: a.ok,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
