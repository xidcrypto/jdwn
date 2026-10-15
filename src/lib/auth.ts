import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Session } from '@prisma/client';
import { prisma } from './prisma';

export const SESSION_DAYS = 7;

export async function hashPassword(password: string): Promise<{ passwordHash: string; salt: string }> {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(String(password ?? ''), salt);
  return { passwordHash, salt };
}

export async function isInstalled(): Promise<boolean> {
  const count = await prisma.admin.count();
  return count > 0;
}

export interface InstallInput {
  name: string;
  email: string;
  username: string;
  password: string;
}

export async function installAdmin(input: InstallInput): Promise<void> {
  if (await isInstalled()) {
    throw new Error('Admin sudah terdaftar. Instalasi hanya bisa dilakukan sekali.');
  }
  const { passwordHash, salt } = await hashPassword(input.password);
  await prisma.admin.create({
    data: {
      id: 1,
      name: input.name,
      email: input.email,
      username: input.username,
      passwordHash,
      salt,
    },
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(String(password ?? ''), hash);
  } catch {
    return false;
  }
}

export async function createSession(): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await prisma.session.create({ data: { token, expiresAt } });
  return { token, expiresAt };
}

function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

export async function getSessionByToken(token: string | null | undefined): Promise<Session | null> {
  if (!token) return null;
  const row = await prisma.session.findUnique({ where: { token } });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { token: row.token } }).catch(() => undefined);
    return null;
  }
  return row;
}

export async function getSession(req: Request): Promise<Session | null> {
  return getSessionByToken(bearerToken(req));
}

export function currentBearerToken(req: Request): string | null {
  return bearerToken(req);
}
