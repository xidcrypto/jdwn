import type { Metadata } from 'next';
import Link from 'next/link';
import StaticShell from '@/components/StaticShell';

export const metadata: Metadata = {
  title: 'Tentang',
  description:
    'jwplyr Extractor adalah alat gratis untuk mengunduh video dari berbagai platform secara cepat, aman, dan tanpa registrasi.',
};

export default function AboutPage() {
  return (
    <StaticShell
      title="Tentang jwplyr Extractor"
      subtitle="Alat gratis untuk mengunduh video favoritmu dengan cepat, aman, dan tanpa registrasi."
      updated="15 Oktober 2026"
    >
      <p>
        <strong>jwplyr Extractor</strong> adalah layanan berbasis web yang membantu kamu mengambil
        video dari berbagai platform media sosial dan situs berbagi video. Cukup tempel tautan
        video, dan sistem akan menampilkan pilihan format serta kualitas yang tersedia untuk
        diunduh.
      </p>

      <h2>Apa yang bisa dilakukan</h2>
      <ul>
        <li>Mengunduh video dalam berbagai resolusi yang tersedia (HD hingga yang paling ringan).</li>
        <li>Mengambil hanya audio (MP3) untuk kebutuhan musik atau podcast.</li>
        <li>Mendukung banyak platform berbagi video hanya dengan satu tautan.</li>
        <li>Tanpa perlu membuat akun, tanpa aplikasi tambahan, dan tanpa biaya.</li>
      </ul>

      <h2>Cara kerja</h2>
      <ol>
        <li>Salin tautan video dari aplikasi atau browser kamu.</li>
        <li>Tempel tautan tersebut ke kolom di halaman utama.</li>
        <li>Pilih format dan kualitas yang kamu inginkan, lalu unduh.</li>
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
