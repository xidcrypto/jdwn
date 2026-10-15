import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { ConfirmProvider } from '@/components/ConfirmProvider';
import { SITE_URL } from '@/lib/site';

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'jwplyr Extractor — Video Downloader Cepat & Gratis',
    template: '%s · jwplyr Extractor',
  },
  description:
    'Unduh video dan audio dari berbagai platform dengan cepat, gratis, dan tanpa registrasi.',
  applicationName: 'jwplyr Extractor',
  keywords: ['video downloader', 'unduh video', 'download video', 'mp3', 'jwplyr'],
  openGraph: {
    type: 'website',
    siteName: 'jwplyr Extractor',
    title: 'jwplyr Extractor — Video Downloader Cepat & Gratis',
    description:
      'Unduh video dan audio dari berbagai platform dengan cepat, gratis, dan tanpa registrasi.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'jwplyr Extractor — Video Downloader Cepat & Gratis',
    description:
      'Unduh video dan audio dari berbagai platform dengan cepat, gratis, dan tanpa registrasi.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0b10',
  width: 'device-width',
  initialScale: 1,
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
