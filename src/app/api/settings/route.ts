import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings, saveSettings, normalizeDomains, type AppSettings } from '@/lib/settings';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });
  return NextResponse.json(await getSettings());
}

export async function PUT(req: Request) {
  const sess = await getSession(req);
  if (!sess) return NextResponse.json({ error: 'Unauthorized: login dulu' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<AppSettings>;
  const patch: Partial<AppSettings> = {};

  if (typeof body.siteName === 'string') patch.siteName = body.siteName;
  if (typeof body.publicEnabled === 'boolean') patch.publicEnabled = body.publicEnabled;
  if (typeof body.allowAllDomains === 'boolean') patch.allowAllDomains = body.allowAllDomains;
  if (body.allowedDomains !== undefined) patch.allowedDomains = normalizeDomains(body.allowedDomains);

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Tidak ada perubahan yang dikirim.' }, { status: 400 });
  }

  const saved = await saveSettings(patch);
  return NextResponse.json({ ok: true, settings: saved });
}
