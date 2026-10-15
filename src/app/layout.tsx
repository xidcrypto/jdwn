import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { ConfirmProvider } from '@/components/ConfirmProvider';
import JsonLd from '@/components/JsonLd';
import { CREATOR, SITE_KEYWORDS, SITE_SHORT_DESCRIPTION, SITE_URL } from '@/lib/site';
import { organizationWithSiteLd } from '@/lib/seo';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  let siteName = 'Video Downloader';
  try {
    const settings = await getSettings();
    if (settings.siteName) siteName = settings.siteName;
  } catch {
    /* pakai default bila pengaturan belum tersedia */
  }

  const title = `${siteName} — Video Downloader Cepat & Gratis`;
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
  const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;
  const yandex = process.env.NEXT_PUBLIC_YANDEX_VERIFICATION;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s · ${siteName}`,
    },
    description: SITE_SHORT_DESCRIPTION,
    applicationName: siteName,
    category: 'multimedia',
    keywords: Array.from(new Set([...SITE_KEYWORDS, siteName])),
    authors: [{ name: CREATOR.label, url: CREATOR.url }],
    creator: CREATOR.label,
    publisher: siteName,
    formatDetection: { telephone: false, email: false, address: false },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: siteName,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: 'website',
      siteName,
      title,
      description: SITE_SHORT_DESCRIPTION,
      url: SITE_URL,
      locale: 'id_ID',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: SITE_SHORT_DESCRIPTION,
      creator: CREATOR.label,
    },
    verification: {
      google,
      yandex,
      other: bing ? { 'msvalidate.01': bing } : undefined,
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#0a0b10',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let siteName = 'Video Downloader';
  try {
    const settings = await getSettings();
    if (settings.siteName) siteName = settings.siteName;
  } catch {
    /* default */
  }

  return (
    <html lang="id" className={`${inter.variable} ${sora.variable}`}>
      <body>
        <JsonLd data={organizationWithSiteLd(siteName)} />
        <ConfirmProvider>{children}</ConfirmProvider>
      </body>
    </html>
  );
}
