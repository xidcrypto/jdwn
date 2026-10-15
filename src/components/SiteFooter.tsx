import Link from 'next/link';
import { PUBLIC_PAGES, CREATOR } from '@/lib/site';

export function XIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function SiteFooter({ siteName = 'Video Downloader' }: { siteName?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <nav className="site-footer-links" aria-label="Tautan footer">
          {PUBLIC_PAGES.map((l) => (
            <Link key={l.path} href={l.path}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="site-footer-credit">
          © {year} {siteName} · Dibuat oleh{' '}
          <a
            href={CREATOR.url}
            target="_blank"
            rel="noopener noreferrer"
            className="creator-link"
          >
            <XIcon /> {CREATOR.label}
          </a>
        </div>

        <p className="site-footer-note">
          Layanan ini tidak berafiliasi dengan situs sumber mana pun. Gunakan secara bertanggung
          jawab dan hormati hak cipta pemilik konten.
        </p>
      </div>
    </footer>
  );
}
