import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, verifyPassword, hashPassword } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const { oldPassword, newPassword } = (await req.json().catch(() => ({}))) as {
    oldPassword?: string;
    newPassword?: string;
  };

  const admin = await prisma.admin.findUnique({ where: { id: 1 } });
  if (!admin) return NextResponse.json({ error: 'Admin tidak ditemukan' }, { status: 400 });

  if (!(await verifyPassword(String(oldPassword || ''), admin.passwordHash))) {
    return NextResponse.json({ error: 'Password lama salah' }, { status: 400 });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return NextResponse.json({ error: 'Password baru minimal 6 karakter' }, { status: 400 });
  }

  const { passwordHash, salt } = await hashPassword(newPassword);
  await prisma.admin.update({ where: { id: 1 }, data: { passwordHash, salt } });
  await prisma.session.deleteMany();

  return NextResponse.json({ ok: true });
}
