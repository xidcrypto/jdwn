import Link from 'next/link';
import { ArrowLeft, Compass, Film, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="nf">
      <div className="nf-orb nf-orb-1" />
      <div className="nf-orb nf-orb-2" />

      <div className="nf-card scale-in">
        <div className="nf-logo">
          <Film size={26} />
        </div>

        <div className="nf-code">
          <span>4</span>
          <span className="nf-zero">
            <Compass size={58} strokeWidth={1.6} />
          </span>
          <span>4</span>
        </div>

        <h1 className="nf-title">Halaman Tidak Ditemukan</h1>
        <p className="nf-sub">
          Sepertinya tautan yang kamu tuju sudah dipindahkan, dihapus, atau tidak pernah ada.
        </p>

        <div className="nf-actions">
          <Link className="btn" href="/">
            <Home size={17} /> Kembali ke Beranda
          </Link>
          <Link className="btn ghost" href="/admin">
            <ArrowLeft size={17} /> Panel Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
