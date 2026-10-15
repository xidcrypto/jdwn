import Link from 'next/link';
import { ArrowLeft, Film } from 'lucide-react';
import SiteFooter from './SiteFooter';

export default function StaticShell({
  title,
  subtitle,
  updated,
  children,
}: {
  title: string;
  subtitle?: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="doc">
      <header className="pub-header">
        <Link href="/" className="brand">
          <div className="brand-mark">
            <Film size={20} />
          </div>
          <div>
            <div className="brand-name">
              jwplyr <span>Extractor</span>
            </div>
            <div className="brand-sub">Video Downloader</div>
          </div>
        </Link>
        <div className="spacer" />
        <Link href="/" className="pub-link">
          <ArrowLeft size={15} /> Beranda
        </Link>
      </header>

      <main className="doc-main">
        <div className="doc-head">
          <h1 className="doc-title">{title}</h1>
          {subtitle ? <p className="doc-sub">{subtitle}</p> : null}
          {updated ? <p className="doc-updated">Terakhir diperbarui: {updated}</p> : null}
        </div>
        <article className="prose">{children}</article>
      </main>

      <SiteFooter />
    </div>
  );
}
