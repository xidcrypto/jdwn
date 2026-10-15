import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isInstalled, installAdmin, createSession } from '@/lib/auth';
import { saveSettings } from '@/lib/settings';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

export async function GET() {
  const installed = await isInstalled();
  return NextResponse.json({ installed });
}

export async function POST(req: Request) {
  if (await isInstalled()) {
    return NextResponse.json(
      { error: 'Admin sudah terdaftar. Instalasi hanya bisa dilakukan sekali.' },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    username?: string;
    password?: string;
    siteName?: string;
  };

  const siteName = String(body.siteName || '').trim();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  const errors: Record<string, string> = {};
  if (siteName.length < 2) errors.siteName = 'Nama website minimal 2 karakter';
  if (name.length < 2) errors.name = 'Nama minimal 2 karakter';
  if (!EMAIL_RE.test(email)) errors.email = 'Format email tidak valid';
  if (!USERNAME_RE.test(username))
    errors.username = 'Username 3–32 karakter (huruf, angka, _ . -)';
  if (password.length < 6) errors.password = 'Password minimal 6 karakter';

  if (Object.keys(errors).length) {
    return NextResponse.json({ error: 'Data belum valid', fields: errors }, { status: 400 });
  }

  try {
    await installAdmin({ name, email, username, password });
    await saveSettings({ siteName });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }

  const admin = await prisma.admin.findUnique({ where: { id: 1 } });
  const s = await createSession();

  return NextResponse.json({
    ok: true,
    token: s.token,
    expiresAt: s.expiresAt,
    username: admin?.username ?? username,
    name: admin?.name ?? name,
  });
}
