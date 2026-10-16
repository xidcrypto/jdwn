import { handlePublicDownload } from '@/lib/publicDownload';

export const runtime = 'nodejs';
export const maxDuration = 600;

export async function GET(req: Request) {
  const u = new URL(req.url);
  return handlePublicDownload(req, u.searchParams.get('token'));
}

export async function HEAD(req: Request) {
  const u = new URL(req.url);
  return handlePublicDownload(req, u.searchParams.get('token'));
}
