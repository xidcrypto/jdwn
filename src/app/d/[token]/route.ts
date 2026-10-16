import { handlePublicDownload } from '@/lib/publicDownload';

export const runtime = 'nodejs';
export const maxDuration = 600;

// URL unduhan/streaming yang terlihat user: /d/<token-terenkripsi>.
// Token diteruskan sebagai segmen path (bukan query rewrite yang tidak
// menyubstitusi parameter), jadi tidak ada jejak "/api/" di browser.
type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  return handlePublicDownload(req, token);
}

export async function HEAD(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  return handlePublicDownload(req, token);
}
