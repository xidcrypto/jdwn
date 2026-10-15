import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { ConfirmProvider } from '@/components/ConfirmProvider';
import { SITE_URL } from '@/lib/site';
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

const SITE_DESCRIPTION =
  'Unduh video dan audio dari berbagai platform dengan cepat, gratis, dan tanpa registrasi.';

export async function generateMetadata(): Promise<Metadata> {
  let siteName = 'Video Downloader';
  try {
    const settings = await getSettings();
    if (settings.siteName) siteName = settings.siteName;
  } catch {
    /* pakai default bila pengaturan belum tersedia */
  }
  const title = `${siteName} — Video Downloader Cepat & Gratis`;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s · ${siteName}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: siteName,
    keywords: ['video downloader', 'unduh video', 'download video', 'unduh mp3', siteName],
    formatDetection: { telephone: false, email: false, address: false },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: siteName,
    },
    openGraph: {
      type: 'website',
      siteName,
      title,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: SITE_DESCRIPTION,
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#0a0b10',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${sora.variable}`}>
      <body>
        <ConfirmProvider>{children}</ConfirmProvider>
      </body>
    </html>
  );
}
