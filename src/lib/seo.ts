import type { Metadata } from 'next';
import { absoluteUrl, CREATOR, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_URL } from './site';

/** Serialisasi aman untuk <script type="application/ld+json">. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/* ------------------------------------------------------------------ */
/* Structured data (JSON-LD)                                           */
/* ------------------------------------------------------------------ */

export function organizationLd(siteName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: siteName,
    url: absoluteUrl('/'),
    logo: { '@type': 'ImageObject', url: absoluteUrl('/icon') },
    sameAs: [CREATOR.url],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        url: absoluteUrl('/contact'),
        availableLanguage: ['id', 'en'],
      },
    ],
  };
}

export function webSiteLd(siteName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: siteName,
    url: absoluteUrl('/'),
    inLanguage: 'id',
    description: SITE_DESCRIPTION,
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

export function softwareApplicationLd(siteName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/#application`,
    name: siteName,
    url: absoluteUrl('/'),
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Mendukung JavaScript',
    inLanguage: 'id',
    isAccessibleForFree: true,
    description: SITE_DESCRIPTION,
    publisher: { '@id': `${SITE_URL}/#organization` },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' },
    featureList: [
      'Unduh video dari YouTube, TikTok, Instagram, X, dan Facebook',
      'Tanpa registrasi dan tanpa aplikasi tambahan',
      'Tanpa watermark',
      'Kualitas video maksimal dari sumber',
    ],
  };
}

export interface FaqItem {
  q: string;
  a: string;
}

export function faqLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

export function organizationWithSiteLd(siteName: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationLd(siteName), webSiteLd(siteName)],
  };
}

export function homeStructuredLd(siteName: string, faq: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [softwareApplicationLd(siteName), faqLd(faq)],
  };
}

export function pageStructuredLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbLd(crumbs)],
  };
}

/* ------------------------------------------------------------------ */
/* FAQ beranda — sumber tunggal untuk konten & schema FAQPage          */
/* ------------------------------------------------------------------ */

export interface FaqContext {
  ytdlpEnabled: boolean;
  domainHint: string;
}

export function homeFaq({ ytdlpEnabled, domainHint }: FaqContext): FaqItem[] {
  return [
    {
      q: 'Apakah layanan ini berbayar?',
      a: 'Tidak. Layanan ini sepenuhnya gratis dan dapat digunakan tanpa biaya tersembunyi.',
    },
    ytdlpEnabled
      ? {
          q: 'Platform apa saja yang didukung?',
          a: 'Kami mendukung YouTube, TikTok, Instagram, X, dan Facebook, serta ribuan situs lain. Cukup tempel tautan video secara lengkap.',
        }
      : {
          q: 'Platform apa saja yang didukung?',
          a: `Saat ini kami mendukung tautan dari ${domainHint}. Tempel tautan videonya secara lengkap.`,
        },
    {
      q: 'Apakah saya perlu aplikasi atau akun?',
      a: 'Tidak perlu. Cukup buka halaman ini, tempel tautan, lalu unduh. Tanpa pemasangan aplikasi dan tanpa pendaftaran.',
    },
    {
      q: 'Apakah video saya disimpan di server?',
      a: 'Tidak. Kami hanya meneruskan video ke perangkatmu dan tidak menyimpan berkasnya.',
    },
    {
      q: 'Mengapa unduhan kadang gagal?',
      a: 'Tautan sumber bersifat sementara dan dapat kedaluwarsa. Jika gagal, tekan “Video lain” lalu proses ulang untuk mendapatkan tautan yang baru.',
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Metadata lengkap untuk satu halaman publik                          */
/* ------------------------------------------------------------------ */

export interface PageMetaInput {
  siteName: string;
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  /** Bila false, judul dipakai apa adanya tanpa menambah "· siteName". */
  titleTemplate?: boolean;
}

export function pageMetadata({
  siteName,
  title,
  description,
  path,
  keywords,
  titleTemplate = true,
}: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = titleTemplate ? `${title} · ${siteName}` : title;
  const kw = Array.from(new Set([...(keywords ?? []), ...SITE_KEYWORDS, siteName]));

  return {
    title: { absolute: fullTitle },
    description,
    keywords: kw,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'id_ID',
      siteName,
      title: fullTitle,
      description,
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  };
}
