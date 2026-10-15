import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };

  const identifier = String(username || '').trim();
  const admin = await prisma.admin.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });
  const ok = admin ? await verifyPassword(String(password || ''), admin.passwordHash) : false;
  if (!ok || !admin) {
    return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
  }

  const s = await createSession();
  return NextResponse.json({
    token: s.token,
    expiresAt: s.expiresAt,
    username: admin.username,
    name: admin.name,
    email: admin.email,
  });
}
