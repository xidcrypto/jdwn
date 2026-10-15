import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES, SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_PAGES.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: p.path === '/' ? 1 : 0.6,
  }));
}
