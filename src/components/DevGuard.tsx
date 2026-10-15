'use client';

import { useEffect, useState } from 'react';
import { EyeOff } from 'lucide-react';

/**
 * Penghalang ringan untuk inspect element di halaman publik:
 *  - menonaktifkan klik kanan (context menu)
 *  - memblokir F12, Ctrl/Cmd+Shift+I/J/C/K, Ctrl/Cmd+U, dan tombol pintas sejenis
 *  - mendeteksi DevTools terbuka (heuristik ukuran jendela) dan menampilkan lapisan peringatan
 *
 * Catatan: ini hanya pencegah, bukan proteksi mutlak (DevTools tetap bisa dibuka
 * lewat cara lain). Bertujuan mengurangi penyalahgunaan kasual.
 */
export default function DevGuard({ enabled }: { enabled: boolean }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const combo =
        k === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K'].includes(k.toUpperCase())) ||
        (e.metaKey && e.altKey && ['I', 'J', 'C'].includes(k.toUpperCase())) ||
        ((e.ctrlKey || e.metaKey) && ['U'].includes(k.toUpperCase()));
      if (combo) {
        e.preventDefault();
        e.stopPropagation();
        setBlocked(true);
        window.setTimeout(() => setBlocked(false), 2200);
      }
    };

    const detect = () => {
      const w = window.outerWidth - window.innerWidth;
      const h = window.outerHeight - window.innerHeight;
      setBlocked(w > 160 || h > 160);
    };

    const iv = window.setInterval(detect, 900);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', detect);

    return () => {
      window.clearInterval(iv);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', detect);
    };
  }, [enabled]);

  if (!enabled || !blocked) return null;

  return (
    <div className="devguard" role="alert">
      <div className="devguard-card">
        <div className="devguard-icon">
          <EyeOff size={26} />
        </div>
        <h3>Akses diblokir</h3>
        <p>
          Alat pengembang (inspect element) terdeteksi. Silakan tutup DevTools untuk melanjutkan
          penggunaan.
        </p>
      </div>
    </div>
  );
}
