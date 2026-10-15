import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

const PRIVATE_PATHS = ['/admin', '/admin/', '/install', '/install/', '/api/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/admin', '/install', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
