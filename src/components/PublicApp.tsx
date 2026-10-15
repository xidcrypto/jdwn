'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  CircleAlert,
  ClipboardPaste,
  Clock,
  Download,
  Film,
  Link2,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import AdSlot from './AdSlot';
import DevGuard from './DevGuard';
import SiteFooter from './SiteFooter';

interface PublicResult {
  videoId: string;
  title: string;
  thumb: string | null;
  expiresAt: string | null;
  streamUrl: string;
  downloadUrl: string;
}

interface PublicSettings {
  siteName: string;
  publicEnabled: boolean;
  allowAllDomains: boolean;
  allowedDomains: string[];
  allowedLinks: string[];
  adsEnabled: boolean;
  adDownloadCode: string;
  adPlayerCode: string;
  smartlinkEnabled: boolean;
  smartlinkUrl: string;
  smartlinkDownload: boolean;
  smartlinkPlayer: boolean;
  devGuardEnabled: boolean;
  vpnBlockEnabled: boolean;
  ytdlpEnabled: boolean;
}

const BENEFITS = [
  {
    icon: Zap,
    title: 'Proses dalam hitungan detik',
    body: 'Tautan diproses seketika sehingga kamu tidak perlu menunggu lama untuk mulai mengunduh.',
  },
  {
    icon: ShieldCheck,
    title: 'Aman dan menjaga privasi',
    body: 'Video diteruskan langsung ke perangkatmu. Kami tidak menyimpan berkas apa pun di server.',
  },
  {
    icon: Sparkles,
    title: 'Hasil bersih, tanpa watermark',
    body: 'Unduhan disimpan apa adanya—tanpa logo tambahan maupun tanda air yang mengganggu.',
  },
  {
    icon: Clock,
    title: 'Gratis sepenuhnya',
    body: 'Tanpa biaya, tanpa langganan, dan tanpa pendaftaran akun yang memberatkan.',
  },
];

export default function PublicApp() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PublicResult | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [vpnBlocked, setVpnBlocked] = useState(false);
  const [cfg, setCfg] = useState<PublicSettings | null>(null);

  useEffect(() => {
    fetch('/api/public/visit', { method: 'POST' }).catch(() => undefined);
    fetch('/api/public/settings')
      .then((r) => r.json())
      .then((d: PublicSettings) => setCfg(d))
      .catch(() => undefined);
  }, []);

  const disabled = cfg?.publicEnabled === false;
  const ytOn = cfg?.ytdlpEnabled === true;
  const domainHint = cfg?.allowAllDomains
    ? 'website apa pun'
    : cfg?.allowedDomains?.length
      ? cfg.allowedDomains.join(', ')
      : 'situs sumber';
  const sample = cfg?.allowedDomains?.[0] || 'contoh.com';

  const submit = async () => {
    const clean = url.trim();
    if (!clean) {
      setError('Tempel dulu tautan video yang ingin diunduh.');
      return;
    }
    setBusy(true);
    setError('');
    setVpnBlocked(false);
    setResult(null);
    setShowPlayer(false);
    try {
      const r = await fetch('/api/public/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clean }),
      });
      const data = (await r.json().catch(() => ({}))) as PublicResult & {
        error?: string;
        vpn?: boolean;
      };
      if (!r.ok || !data.downloadUrl) {
        if (data.vpn) setVpnBlocked(true);
        throw new Error(data.error || 'Tidak dapat memproses tautan ini.');
      }
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError('');
    setUrl('');
    setShowPlayer(false);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrl(text.trim());
        setError('');
        setVpnBlocked(false);
      }
    } catch {
      setError('Tidak bisa membaca clipboard. Tekan lama kolom ini lalu pilih "Tempel".');
    }
  };

  const siteName = cfg?.siteName || 'Video Downloader';
  const showAds = cfg?.adsEnabled === true;
  const smartlinkOnDownload = cfg?.smartlinkEnabled === true && cfg?.smartlinkDownload === true;
  const smartlinkOnPlay = cfg?.smartlinkEnabled === true && cfg?.smartlinkPlayer === true;

  const openSmartlink = () => {
    const link = cfg?.smartlinkUrl;
    if (!link) return;
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    if (smartlinkOnDownload) openSmartlink();
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.downloadUrl;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const togglePlayer = () => {
    const next = !showPlayer;
    if (next && smartlinkOnPlay) openSmartlink();
    setShowPlayer(next);
  };

  return (
    <div className="pub">
      <DevGuard enabled={cfg?.devGuardEnabled === true} />
      <div className="pub-grid" aria-hidden="true" />
      <div className="lz-aurora" aria-hidden="true" />

      <header className="lz-nav">
        <div className="lz-nav-inner">
          <Link className="lz-brand" href="/">
            <span className="lz-logo">
              <Film size={18} />
            </span>
            <span className="lz-brand-text">
              <span className="lz-brand-name">{siteName}</span>
              <span className="lz-brand-sub">Unduhan video</span>
            </span>
          </Link>
          <nav className="lz-nav-links" aria-label="Navigasi utama">
            <Link href="/about" className="lz-nav-link">
              Tentang
            </Link>
            <Link href="/privacy" className="lz-nav-link">
              Privasi
            </Link>
            <Link href="/contact" className="lz-nav-link">
              Kontak
            </Link>
          </nav>
          <a href="#unduh" className="lz-nav-cta">
            Mulai
          </a>
        </div>
      </header>

      <main className="lz-main">
        <section className="lz-hero">
          <span className="lz-eyebrow">
            <span className="lz-dot" aria-hidden="true" />
            Tanpa aplikasi &middot; tanpa registrasi
          </span>
          <h1 className="lz-title">
            Unduh video favoritmu, <span className="lz-grad">cepat dan mudah.</span>
          </h1>
          <p className="lz-lede">
            Tempel tautan dari platform populer, lalu simpan videonya dalam kualitas terbaik—langsung
            ke perangkatmu. Satu halaman, selesai dalam sekejap.
          </p>

          <div className="lz-tool" id="unduh">
            <form
              className="lz-form"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="lz-field">
                <Link2 className="lz-field-icon" size={19} />
                <input
                  className="lz-input"
                  type="url"
                  inputMode="url"
                  enterKeyHint="go"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={url}
                  disabled={disabled}
                  placeholder={
                    ytOn
                      ? 'Tempel tautan video di sini…'
                      : `Tempel tautan video, mis. https://${sample}/…`
                  }
                  onChange={(e) => setUrl(e.target.value)}
                  aria-label="Tautan video"
                />
                {url && !disabled ? (
                  <button
                    type="button"
                    className="lz-inline lz-clear"
                    onClick={() => setUrl('')}
                    aria-label="Bersihkan"
                  >
                    <X size={16} />
                  </button>
                ) : null}
                {!url && !disabled ? (
                  <button type="button" className="lz-inline lz-paste" onClick={pasteFromClipboard}>
                    <ClipboardPaste size={15} />
                    <span>Tempel</span>
                  </button>
                ) : null}
              </div>
              <button className="lz-submit" type="submit" disabled={busy || disabled}>
                {busy ? <Loader2 className="spinner" size={18} /> : <Download size={18} />}
                <span>{busy ? 'Memproses…' : 'Unduh'}</span>
              </button>
            </form>

            <div className="lz-foot">
              {disabled ? (
                <span className="lz-msg lz-msg-warn">
                  <CircleAlert size={14} /> Layanan sedang tidak tersedia. Silakan coba lagi nanti.
                </span>
              ) : vpnBlocked ? (
                <span className="lz-msg lz-msg-warn">
                  <ShieldCheck size={14} /> VPN/proxy terdeteksi. Matikan VPN lalu coba lagi.
                </span>
              ) : error ? (
                <span className="lz-msg lz-msg-err">
                  <CircleAlert size={14} /> {error}
                </span>
              ) : (
                <span className="lz-msg">
                  <ShieldCheck size={14} /> Video tidak disimpan di server kami &middot; tautan
                  bersifat sementara
                </span>
              )}
            </div>
          </div>

          <ul className="lz-trust">
            <li>
              <Zap size={14} /> Proses instan
            </li>
            <li>
              <ShieldCheck size={14} /> Privasi terjaga
            </li>
            <li>
              <Sparkles size={14} /> Tanpa watermark
            </li>
            <li>
              <Clock size={14} /> Gratis
            </li>
          </ul>
        </section>

        {result ? (
          <section className="lz-result">
            <article className="lz-media">
              <div className="lz-media-thumb">
                {result.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.thumb}
                    alt=""
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Film className="ph" size={44} />
                )}
              </div>
              <div className="lz-media-body">
                <span className="lz-media-tag">
                  <CheckCircle2 size={13} /> Siap diunduh
                </span>
                <h3 className="lz-media-title">{result.title || result.videoId}</h3>
                <div className="lz-media-meta">
                  <span>
                    <Clock size={13} />
                    {result.expiresAt
                      ? 'Berlaku hingga ' + new Date(result.expiresAt).toLocaleString('id-ID')
                      : 'Tautan sementara'}
                  </span>
                  <span>
                    <ShieldCheck size={13} /> Tidak disimpan di server
                  </span>
                </div>
                <div className="lz-media-actions">
                  <button className="btn" onClick={handleDownload}>
                    <Download size={17} /> Unduh MP4
                  </button>
                  <button className="btn ghost" onClick={togglePlayer}>
                    {showPlayer ? <Film size={17} /> : <Play size={17} />}
                    {showPlayer ? 'Sembunyikan' : 'Pratinjau'}
                  </button>
                  <button className="btn ghost" onClick={reset}>
                    <Wand2 size={17} /> Video lain
                  </button>
                </div>

                {showAds && cfg?.adDownloadCode ? (
                  <div className="ad-slot ad-download" aria-label="Iklan">
                    <span className="ad-tag">Iklan</span>
                    <AdSlot html={cfg.adDownloadCode} />
                  </div>
                ) : null}
              </div>
            </article>

            {showPlayer ? (
              <div className="lz-player">
                <div className="lz-player-bar">
                  <span className="lz-player-dot" aria-hidden="true" /> Pratinjau
                </div>
                {showAds && cfg?.adPlayerCode ? (
                  <div className="ad-slot ad-player" aria-label="Iklan">
                    <span className="ad-tag">Iklan</span>
                    <AdSlot html={cfg.adPlayerCode} />
                  </div>
                ) : null}
                <video src={result.streamUrl} controls playsInline autoPlay />
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="lz-sources" aria-label="Platform yang didukung">
          <span className="lz-sources-label">Bekerja dengan platform yang kamu gunakan</span>
          <div className="lz-sources-row">
            {ytOn ? (
              <>
                <span>YouTube</span>
                <span>TikTok</span>
                <span>Instagram</span>
                <span>X</span>
                <span>Facebook</span>
                <span className="lz-sources-more">dan ribuan situs lain</span>
              </>
            ) : (
              <span className="lz-sources-more">{domainHint}</span>
            )}
          </div>
        </section>

        <section className="lz-block">
          <header className="lz-head">
            <span className="lz-kicker">Alur kerja</span>
            <h2 className="lz-h2">Tiga langkah, selesai.</h2>
            <p className="lz-sub">Dirancang seminimal mungkin—tanpa langkah yang membingungkan.</p>
          </header>
          <ol className="lz-flow">
            <li className="lz-flow-item">
              <span className="lz-flow-num">01</span>
              <h3>Salin tautan</h3>
              <p>Buka video di aplikasi atau browser, lalu salin tautannya.</p>
            </li>
            <li className="lz-flow-item">
              <span className="lz-flow-num">02</span>
              <h3>Tempel &amp; proses</h3>
              <p>Letakkan tautan pada kolom di atas, lalu tunggu beberapa saat.</p>
            </li>
            <li className="lz-flow-item">
              <span className="lz-flow-num">03</span>
              <h3>Simpan video</h3>
              <p>Tekan tombol unduh untuk menyimpan video ke perangkatmu.</p>
            </li>
          </ol>
        </section>

        <section className="lz-block">
          <header className="lz-head">
            <span className="lz-kicker">Kenapa memilih kami</span>
            <h2 className="lz-h2">Cepat, bersih, dan aman.</h2>
            <p className="lz-sub">
              Fokus pada satu hal—membuat proses mengunduh video menjadi semudah mungkin.
            </p>
          </header>
          <div className="lz-cards">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <article className="lz-card" key={b.title}>
                  <span className="lz-card-icon">
                    <Icon size={19} />
                  </span>
                  <h3>{b.title}</h3>
                  <p>{b.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="lz-block">
          <header className="lz-head">
            <span className="lz-kicker">Pertanyaan umum</span>
            <h2 className="lz-h2">Hal yang sering ditanyakan.</h2>
          </header>
          <div className="lz-qa">
            <details open>
              <summary>Apakah layanan ini berbayar?</summary>
              <div className="lz-qa-body">
                Tidak. Layanan ini sepenuhnya gratis dan dapat digunakan tanpa biaya tersembunyi.
              </div>
            </details>
            <details>
              <summary>Platform apa saja yang didukung?</summary>
              <div className="lz-qa-body">
                {ytOn ? (
                  <>
                    Kami mendukung <b>YouTube, TikTok, Instagram, X, dan Facebook</b>, serta ribuan
                    situs lain. Cukup tempel tautan video secara lengkap.
                  </>
                ) : (
                  <>
                    Saat ini kami mendukung tautan dari <b>{domainHint}</b>. Tempel tautan videonya
                    secara lengkap.
                  </>
                )}
              </div>
            </details>
            <details>
              <summary>Apakah saya perlu aplikasi atau akun?</summary>
              <div className="lz-qa-body">
                Tidak perlu. Cukup buka halaman ini, tempel tautan, lalu unduh. Tanpa pemasangan
                aplikasi dan tanpa pendaftaran.
              </div>
            </details>
            <details>
              <summary>Apakah video saya disimpan di server?</summary>
              <div className="lz-qa-body">
                Tidak. Kami hanya meneruskan video ke perangkatmu dan tidak menyimpan berkasnya.
              </div>
            </details>
            <details>
              <summary>Mengapa unduhan kadang gagal?</summary>
              <div className="lz-qa-body">
                Tautan sumber bersifat sementara dan dapat kedaluwarsa. Jika gagal, tekan “Video
                lain” lalu proses ulang untuk mendapatkan tautan yang baru.
              </div>
            </details>
          </div>
        </section>
      </main>

      <SiteFooter siteName={siteName} />
    </div>
  );
}
