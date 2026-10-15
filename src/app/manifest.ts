import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/settings';
import { SITE_DESCRIPTION, SITE_TAGLINE } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = 'Video Downloader';
  try {
    const s = await getSettings();
    if (s.siteName) name = s.siteName;
  } catch {
    /* fallback */
  }

  return {
    name,
    short_name: name.slice(0, 32),
    description: SITE_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    lang: 'id',
    dir: 'ltr',
    background_color: '#f5f6fb',
    theme_color: '#5560e8',
    categories: ['utilities', 'productivity'],
    icons: [
      { src: '/icon', sizes: '64x64', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Unduh video',
        short_name: 'Unduh',
        description: SITE_TAGLINE,
        url: '/#unduh',
      },
    ],
  };
}
