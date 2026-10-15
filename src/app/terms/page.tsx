import type { Metadata } from 'next';
import Link from 'next/link';
import StaticShell from '@/components/StaticShell';

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan',
  description: 'Aturan penggunaan layanan jwplyr Extractor.',
};

export default function TermsPage() {
  return (
    <StaticShell
      title="Syarat & Ketentuan"
      subtitle="Dengan mengakses layanan ini, kamu dianggap telah membaca dan menyetujui syarat berikut."
      updated="15 Oktober 2026"
    >
      <p>
        Selamat datang di <strong>jwplyr Extractor</strong>. Syarat &amp; Ketentuan ini mengatur
        penggunaan layanan kami. Jika kamu tidak setuju dengan ketentuan ini, mohon tidak
        menggunakan layanan.
      </p>

      <h2>1. Deskripsi layanan</h2>
      <p>
        Kami menyediakan alat berbasis web untuk membantu mengunduh konten video/audio dari tautan
        yang kamu berikan. Layanan disediakan "sebagaimana adanya" (as is) dan dapat berubah atau
        dihentikan kapan saja tanpa pemberitahuan.
      </p>

      <h2>2. Penggunaan yang diizinkan</h2>
      <ul>
        <li>Mengunduh konten yang kamu miliki atau yang memang boleh diunduh.</li>
        <li>Menggunakan layanan untuk keperluan pribadi dan non-komersial.</li>
        <li>Mematuhi hukum yang berlaku di wilayahmu.</li>
      </ul>

      <h2>3. Larangan</h2>
      <p>Kamu setuju untuk tidak:</p>
      <ul>
        <li>Mengunduh atau mendistribusikan konten yang melanggar hak cipta.</li>
        <li>Menggunakan layanan untuk aktivitas ilegal, penipuan, atau pelecehan.</li>
        <li>Melakukan otomatisasi berlebih, scraping agresif, atau membebani server.</li>
        <li>Mencoba mengakses sistem, data, atau area yang tidak diizinkan.</li>
        <li>Melewati pembatasan keamanan, pemblokiran, atau pembatasan laju.</li>
      </ul>

      <h2>4. Hak cipta</h2>
      <p>
        Semua konten yang diunduh tetap menjadi milik pemegang haknya. Kami tidak memiliki konten
        tersebut dan tidak menyimpannya di server kami. Tanggung jawab atas legalitas unduhan
        sepenuhnya berada pada pengguna.
      </p>

      <h2>5. Ketersediaan layanan</h2>
      <p>
        Kami tidak menjamin layanan selalu tersedia, bebas gangguan, atau kompatibel dengan semua
        platform. Beberapa sumber dapat memblokir akses sehingga unduhan tertentu mungkin gagal.
      </p>

      <h2>6. Batasan tanggung jawab</h2>
      <p>
        Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian langsung maupun tidak
        langsung yang timbul dari penggunaan layanan, termasuk penyalahgunaan oleh pengguna.
      </p>

      <h2>7. Perubahan ketentuan</h2>
      <p>
        Kami dapat mengubah Syarat &amp; Ketentuan ini sewaktu-waktu. Versi terbaru akan selalu
        tersedia di halaman ini.
      </p>

      <h2>8. Kontak</h2>
      <p>
        Pertanyaan terkait ketentuan ini dapat disampaikan melalui halaman{' '}
        <Link href="/contact">Kontak</Link>.
      </p>
    </StaticShell>
  );
}
