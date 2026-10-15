import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const admin = await prisma.admin.findUnique({ where: { id: 1 } });
  const [proxyTotal, proxyEnabled] = await Promise.all([
    prisma.proxy.count(),
    prisma.proxy.count({ where: { enabled: true } }),
  ]);

  return NextResponse.json({
    username: admin?.username ?? null,
    name: admin?.name ?? null,
    email: admin?.email ?? null,
    createdAt: admin?.createdAt ?? null,
    proxyTotal,
    proxyEnabled,
  });
}
