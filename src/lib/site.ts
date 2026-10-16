export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://hgitopup.web.id'
).replace(/\/+$/, '');

export const CREATOR = {
  label: '@pansagr',
  url: 'https://x.com/pansagr',
};

/** URL absolut dari path relatif ("/" atau "/about"). */
export function absoluteUrl(path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${p}`;
}

export const SITE_TAGLINE = 'Unduh video favoritmu, cepat dan mudah.';

export const SITE_DESCRIPTION =
  'Unduh video dari situs yang didukung secara cepat, gratis, tanpa registrasi, dan tanpa watermark.';

export const SITE_SHORT_DESCRIPTION =
  'Unduh video dan audio dari berbagai platform dengan cepat, gratis, dan tanpa registrasi.';

export const SITE_KEYWORDS = [
  'video downloader',
  'download video',
  'unduh video',
  'unduh video online',
  'video downloader gratis',
  'unduh video tanpa watermark',
  'no watermark video',
  'free video downloader',
  'online video downloader',
];

export type ChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export interface PublicPage {
  path: string;
  label: string;
  description: string;
  keywords?: string[];
  priority: number;
  changeFrequency: ChangeFrequency;
}

export const PUBLIC_PAGES: PublicPage[] = [
  {
    path: '/',
    label: 'Beranda',
    description: SITE_DESCRIPTION,
    priority: 1,
    changeFrequency: 'daily',
  },
  {
    path: '/about',
    label: 'Tentang',
    description:
      'Kenali lebih dekat: cara kerja, fitur, dan komitmen privasi layanan pengunduh video gratis ini.',
    keywords: ['tentang kami', 'cara kerja video downloader', 'unduh video gratis'],
    priority: 0.7,
    changeFrequency: 'monthly',
  },
  {
    path: '/privacy',
    label: 'Kebijakan Privasi',
    description:
      'Kebijakan privasi lengkap: data apa yang dikumpulkan, bagaimana diproses, dan hak pengguna.',
    keywords: ['kebijakan privasi', 'privasi data', 'privacy policy'],
    priority: 0.5,
    changeFrequency: 'monthly',
  },
  {
    path: '/terms',
    label: 'Syarat & Ketentuan',
    description:
      'Syarat dan ketentuan penggunaan layanan, batasan tanggung jawab, dan aturan penggunaan yang wajar.',
    keywords: ['syarat ketentuan', 'terms of service', 'aturan penggunaan'],
    priority: 0.5,
    changeFrequency: 'monthly',
  },
  {
    path: '/dmca',
    label: 'DMCA',
    description:
      'Kebijakan DMCA dan prosedur pelaporan pelanggaran hak cipta (take down) yang cepat dan jelas.',
    keywords: ['dmca', 'dmca policy', 'pelaporan hak cipta', 'copyright takedown'],
    priority: 0.5,
    changeFrequency: 'yearly',
  },
  {
    path: '/contact',
    label: 'Kontak',
    description:
      'Hubungi tim kami untuk pertanyaan, kerja sama, atau pelaporan masalah terkait layanan.',
    keywords: ['kontak', 'hubungi kami', 'contact'],
    priority: 0.5,
    changeFrequency: 'monthly',
  },
];
