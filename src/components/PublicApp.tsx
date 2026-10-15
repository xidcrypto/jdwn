'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  Download,
  Film,
  HelpCircle,
  Link2,
  Loader2,
  MousePointerClick,
  Play,
  ShieldCheck,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import AdSlot from './AdSlot';

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
}

export default function PublicApp() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PublicResult | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [cfg, setCfg] = useState<PublicSettings | null>(null);

  useEffect(() => {
    fetch('/api/public/visit', { method: 'POST' }).catch(() => undefined);
    fetch('/api/public/settings')
      .then((r) => r.json())
      .then((d: PublicSettings) => setCfg(d))
      .catch(() => undefined);
  }, []);

  const disabled = cfg?.publicEnabled === false;
  const domainHint = cfg?.allowAllDomains
    ? 'website apa pun'
    : cfg?.allowedDomains?.length
      ? cfg.allowedDomains.join(', ')
      : 'jwplyr.com';
  const sample = cfg?.allowedDomains?.[0] || 'jwplyr.com';

  const submit = async () => {
    const clean = url.trim();
    if (!clean) {
      setError('Tempel dulu URL video-nya.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    setShowPlayer(false);
    try {
      const r = await fetch('/api/public/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clean }),
      });
      const data = (await r.json().catch(() => ({}))) as PublicResult & { error?: string };
      if (!r.ok || !data.downloadUrl) throw new Error(data.error || 'Gagal mengekstrak video.');
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

  const siteName = cfg?.siteName || 'jwplyr Extractor';
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
      <header className="pub-header">
        <div className="brand">
          <div className="brand-mark">
            <Film size={20} />
          </div>
          <div>
            <div className="brand-name">{siteName}</div>
            <div className="brand-sub">Video Downloader</div>
          </div>
        </div>
        <div className="spacer" />
      </header>

      <main className="pub-main">
        <section className="hero">
          <div className="hero-badge fade-in">
            <Sparkles size={14} /> Cepat · Gratis · Tanpa iklan
          </div>
          <h1 className="hero-title animate-in">
            Download Video <span className="grad">Tanpa Ribet</span>
          </h1>
          <p className="hero-sub animate-in d1">
            Tempel tautan video di bawah, lalu unduh videonya dalam kualitas terbaik langsung ke
            perangkatmu. Tanpa watermark, tanpa aplikasi.
          </p>
        </section>

        <section className="dl-card scale-in d1">
          <div className="dl-form">
            <div className="dl-input-wrap">
              <Link2 className="dl-icon" size={19} />
              <input
                className="dl-input"
                type="url"
                inputMode="url"
                value={url}
                disabled={disabled}
                placeholder={`Tempel URL di sini, contoh: https://${sample}/e/xxxx`}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
              />
            </div>
            <button className="btn dl-btn" onClick={submit} disabled={busy || disabled}>
              {busy ? <Loader2 className="spinner" size={18} /> : <Download size={18} />}
              {busy ? 'Memproses…' : 'Download'}
            </button>
          </div>

          {disabled ? (
            <div className="field-error" style={{ justifyContent: 'center', marginTop: 14 }}>
              <CircleAlert size={14} /> Layanan sedang dinonaktifkan sementara.
            </div>
          ) : error ? (
            <div className="field-error" style={{ justifyContent: 'center', marginTop: 14 }}>
              <CircleAlert size={14} /> {error}
            </div>
          ) : (
            <div className="dl-note">
              <ShieldCheck size={13} /> Kami tidak menyimpan videomu. Tautan berlaku sementara.
            </div>
          )}
        </section>

        {result ? (
          <section className="result" style={{ marginBottom: 22 }}>
            <div className="dl-card" style={{ marginBottom: 0 }}>
              <div className="result-card">
                <div className="result-thumb">
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
                <div className="result-info">
                  <h3>{result.title || result.videoId}</h3>
                  <div className="result-meta">
                    <span>
                      <CheckCircle2 size={13} /> Berhasil diekstrak
                    </span>
                    <span>
                      <Clock size={13} />
                      {result.expiresAt
                        ? 'Berlaku s/d ' + new Date(result.expiresAt).toLocaleString('id-ID')
                        : 'Tautan sementara'}
                    </span>
                  </div>
                  <div className="result-actions">
                    <button className="btn" onClick={handleDownload}>
                      <Download size={17} /> Download MP4
                    </button>
                    <button className="btn ghost" onClick={togglePlayer}>
                      {showPlayer ? <Film size={17} /> : <Play size={17} />}
                      {showPlayer ? 'Sembunyikan' : 'Putar dulu'}
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
              </div>

              {showPlayer ? (
                <div className="video-frame">
                  <div className="video-badge">
                    <span className="dot live" style={{ color: 'var(--ok)' }} /> Preview
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
            </div>
          </section>
        ) : null}

        <div className="pub-features">
          <span className="pub-chip fade-in d1">
            <Zap size={14} /> Ekstraksi cepat
          </span>
          <span className="pub-chip fade-in d2">
            <ShieldCheck size={14} /> Tanpa iklan
          </span>
          <span className="pub-chip fade-in d3">
            <Download size={14} /> Tanpa watermark
          </span>
          <span className="pub-chip fade-in d4">
            <Clock size={14} /> Gratis &amp; tanpa batas
          </span>
        </div>

        <h2 className="steps-title animate-in">Cara Pakai</h2>
        <p className="steps-sub animate-in d1">Tiga langkah mudah, selesai dalam hitungan detik.</p>
        <div className="steps">
          <div className="step-card animate-in d1">
            <div className="step-num">
              <MousePointerClick size={20} />
            </div>
            <h3>1. Salin Tautan</h3>
            <p>Buka video, lalu salin URL-nya dari browser kamu.</p>
          </div>
          <div className="step-card animate-in d2">
            <div className="step-num">
              <Wand2 size={20} />
            </div>
            <h3>2. Tempel &amp; Proses</h3>
            <p>Tempel tautan di kolom di atas dan tekan tombol Download.</p>
          </div>
          <div className="step-card animate-in d3">
            <div className="step-num">
              <Download size={20} />
            </div>
            <h3>3. Unduh Video</h3>
            <p>Klik Download MP4 untuk menyimpan video ke perangkatmu.</p>
          </div>
        </div>

        <section className="faq">
          <h2>Pertanyaan Umum</h2>
          <details open>
            <summary>
              <HelpCircle size={16} /> Apakah layanan ini gratis?
            </summary>
            <div className="faq-body">
              Ya, sepenuhnya gratis dan tanpa iklan. Kamu bisa mengunduh video sebanyak yang kamu
              mau.
            </div>
          </details>
          <details>
            <summary>
              <HelpCircle size={16} /> Tautan apa saja yang didukung?
            </summary>
            <div className="faq-body">
              Saat ini kami mendukung tautan dari: <b>{domainHint}</b>. Tempel URL videonya secara
              lengkap.
            </div>
          </details>
          <details>
            <summary>
              <HelpCircle size={16} /> Kenapa video tidak bisa diputar atau diunduh?
            </summary>
            <div className="faq-body">
              Tautan video bersifat sementara dan bisa kedaluwarsa. Jika gagal, tekan “Video lain”
              lalu ekstrak ulang untuk mendapatkan tautan segar.
            </div>
          </details>
          <details>
            <summary>
              <HelpCircle size={16} /> Apakah video saya disimpan di server?
            </summary>
            <div className="faq-body">
              Tidak. Server hanya meneruskan (streaming) video ke perangkatmu tanpa menyimpannya.
            </div>
          </details>
        </section>
      </main>

      <footer className="pub-footer">
        <p>
          © {new Date().getFullYear()} {siteName} · Dibuat untuk penggunaan pribadi.
        </p>
      </footer>
    </div>
  );
}
