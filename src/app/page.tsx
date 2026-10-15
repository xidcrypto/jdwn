import type { Metadata, Viewport } from 'next';
import PublicApp from '@/components/PublicApp';
import JsonLd from '@/components/JsonLd';
import { getSettings } from '@/lib/settings';
import { homeFaq, homeStructuredLd, pageMetadata } from '@/lib/seo';
import { SITE_DESCRIPTION } from '@/lib/site';

export const viewport: Viewport = { themeColor: '#f5f6fb' };

async function readSite() {
  try {
    return await getSettings();
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await readSite();
  const siteName = settings?.siteName || 'Video Downloader';
  return pageMetadata({
    siteName,
    title: `${siteName} — Video Downloader Cepat & Gratis`,
    description: SITE_DESCRIPTION,
    path: '/',
    titleTemplate: false,
  });
}

export default async function HomePage() {
  const settings = await readSite();
  const siteName = settings?.siteName || 'Video Downloader';
  const domainHint = settings?.allowAllDomains
    ? 'website apa pun'
    : settings?.allowedDomains?.length
      ? settings.allowedDomains.join(', ')
      : 'situs sumber';
  const faq = homeFaq({ ytdlpEnabled: settings?.ytdlpEnabled !== false, domainHint });

  return (
    <>
      <JsonLd data={homeStructuredLd(siteName, faq)} />
      <PublicApp />
    </>
  );
}
