export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://hgitopup.web.id'
).replace(/\/+$/, '');

export const CREATOR = {
  label: '@pansagr',
  url: 'https://x.com/pansagr',
};

export const PUBLIC_PAGES: Array<{ path: string; label: string }> = [
  { path: '/', label: 'Beranda' },
  { path: '/about', label: 'Tentang' },
  { path: '/privacy', label: 'Kebijakan Privasi' },
  { path: '/terms', label: 'Syarat & Ketentuan' },
  { path: '/dmca', label: 'DMCA' },
  { path: '/contact', label: 'Kontak' },
];
