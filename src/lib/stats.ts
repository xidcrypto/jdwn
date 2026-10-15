import crypto from 'crypto';
import { prisma } from './prisma';

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

export async function recordVisit(req: Request): Promise<void> {
  const hash = hashIp(clientIp(req));
  const ua = (req.headers.get('user-agent') || '').slice(0, 300) || null;
  const date = todayKey();

  await Promise.all([
    prisma.visitor.upsert({
      where: { ipHash: hash },
      update: { hits: { increment: 1 }, userAgent: ua ?? undefined },
      create: { ipHash: hash, hits: 1, userAgent: ua },
    }),
    prisma.dailyStat.upsert({
      where: { date },
      update: { visits: { increment: 1 } },
      create: { date, visits: 1 },
    }),
  ]);
}

export async function recordExtract(ok: boolean, detail?: string): Promise<void> {
  const date = todayKey();
  await Promise.all([
    prisma.dailyStat.upsert({
      where: { date },
      update: ok
        ? { extracts: { increment: 1 }, ok: { increment: 1 } }
        : { extracts: { increment: 1 }, failed: { increment: 1 } },
      create: { date, extracts: 1, ok: ok ? 1 : 0, failed: ok ? 0 : 1 },
    }),
    prisma.activityLog.create({
      data: { type: 'extract', ok, detail: detail?.slice(0, 300) || null },
    }),
  ]);
}

export async function recordDownload(detail?: string): Promise<void> {
  const date = todayKey();
  await Promise.all([
    prisma.dailyStat.upsert({
      where: { date },
      update: { downloads: { increment: 1 } },
      create: { date, downloads: 1 },
    }),
    prisma.activityLog.create({
      data: { type: 'download', ok: true, detail: detail?.slice(0, 300) || null },
    }),
  ]);
}

export interface DailyPoint {
  date: string;
  visits: number;
  extracts: number;
  downloads: number;
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
    prisma.dailyStat.findMany({
      where: { date: { gte: todayKey(new Date(now.getTime() - (days - 1) * 86400000)) } },
      orderBy: { date: 'asc' },
    }),
    prisma.activityLog.findMany({ orderBy: { id: 'desc' }, take: 15 }),
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
