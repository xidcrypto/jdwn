import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: Request, { params }: Ctx) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const { id } = await params;
  await prisma.proxy.delete({ where: { id: Number(id) } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const { id } = await params;
  const { enabled } = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  await prisma.proxy
    .update({ where: { id: Number(id) }, data: { enabled: !!enabled } })
    .catch(() => undefined);
  return NextResponse.json({ ok: true });
}
