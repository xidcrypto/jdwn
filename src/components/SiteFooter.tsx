import Link from 'next/link';
import { PUBLIC_PAGES, CREATOR } from '@/lib/site';

export default function SiteFooter({ siteName = 'jwplyr Extractor' }: { siteName?: string }) {
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
          <a href={CREATOR.url} target="_blank" rel="noopener noreferrer">
            {CREATOR.label}
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
