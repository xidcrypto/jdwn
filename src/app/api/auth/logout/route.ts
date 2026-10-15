import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentBearerToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const token = currentBearerToken(req);
  if (token) {
    await prisma.session.delete({ where: { token } }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
