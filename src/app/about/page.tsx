import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import StaticShell from '@/components/StaticShell';
import { getSettings } from '@/lib/settings';

export const viewport: Viewport = { themeColor: '#f5f6fb' };

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getSettings();
  return {
    title: 'Tentang',
    description: `${siteName} adalah alat gratis untuk mengunduh video dari berbagai platform secara cepat, aman, dan tanpa registrasi.`,
  };
}

export default async function AboutPage() {
  const { siteName } = await getSettings();
  return (
    <StaticShell
      title={`Tentang ${siteName}`}
      subtitle="Alat gratis untuk mengunduh video favoritmu dengan cepat, aman, dan tanpa registrasi."
      updated="15 Oktober 2026"
    >
      <p>
        <strong>{siteName}</strong> adalah layanan berbasis web yang membantu kamu menyimpan video
        dari berbagai platform media sosial dan situs berbagi video. Cukup tempel tautan video, dan
        sistem akan menyiapkannya untuk diunduh dalam kualitas terbaik yang tersedia.
      </p>

      <h2>Apa yang bisa dilakukan</h2>
      <ul>
        <li>Menyimpan video dari berbagai platform populer hanya dengan satu tautan.</li>
        <li>Menghasilkan berkas video dalam resolusi terbaik yang tersedia dari sumbernya.</li>
        <li>Hasil unduhan bersih, tanpa tanda air tambahan.</li>
        <li>Tanpa perlu membuat akun, tanpa aplikasi tambahan, dan tanpa biaya.</li>
      </ul>

      <h2>Cara kerja</h2>
      <ol>
        <li>Salin tautan video dari aplikasi atau browser kamu.</li>
        <li>Tempel tautan tersebut ke kolom di halaman utama.</li>
        <li>Tekan tombol unduh untuk menyimpan video ke perangkatmu.</li>
      </ol>
      <p>
        Kami tidak menyimpan file video di server kami. Proses hanya membaca tautan yang kamu
        berikan, mengambil informasi yang tersedia secara publik, lalu meneruskannya ke perangkatmu.
      </p>

      <h2>Privasi & keamanan</h2>
      <p>
        Kami menghargai privasimu. Kami hanya mencatat data teknis terbatas (seperti alamat IP dan
        jenis perangkat) untuk mencegah penyalahgunaan dan menjaga layanan tetap stabil. Untuk
        detail lengkap, silakan baca{' '}
        <Link href="/privacy">Kebijakan Privasi</Link> kami.
      </p>

      <h2>Penggunaan yang bertanggung jawab</h2>
      <p>
        Layanan ini ditujukan untuk penggunaan pribadi dan konten yang memang boleh diunduh.
        Harap hormati hak cipta pemilik konten. Baca{' '}
        <Link href="/terms">Syarat &amp; Ketentuan</Link> dan{' '}
        <Link href="/dmca">Kebijakan DMCA</Link> kami sebelum menggunakan layanan.
      </p>

      <h2>Kontak</h2>
      <p>
        Punya pertanyaan, masukan, atau menemukan masalah? Lihat halaman{' '}
        <Link href="/contact">Kontak</Link>.
      </p>
    </StaticShell>
  );
}
