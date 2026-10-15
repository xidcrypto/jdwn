import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import StaticShell from '@/components/StaticShell';
import JsonLd from '@/components/JsonLd';
import { getSettings } from '@/lib/settings';
import { pageMetadata, pageStructuredLd } from '@/lib/seo';

export const viewport: Viewport = { themeColor: '#f5f6fb' };

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getSettings();
  return pageMetadata({
    siteName,
    title: 'Kebijakan Privasi',
    description: `Bagaimana ${siteName} mengumpulkan, menggunakan, dan melindungi data pengguna.`,
    path: '/privacy',
    keywords: ['kebijakan privasi', 'privasi data', 'privacy policy'],
  });
}

export default async function PrivacyPage() {
  const { siteName } = await getSettings();
  return (
    <>
      <JsonLd
        data={pageStructuredLd([
          { name: 'Beranda', path: '/' },
          { name: 'Kebijakan Privasi', path: '/privacy' },
        ])}
      />
      <StaticShell
        title="Kebijakan Privasi"
        subtitle="Penjelasan tentang data apa yang kami kumpulkan dan bagaimana kami melindunginya."
        updated="15 Oktober 2026"
      >
        <p>
          Kebijakan Privasi ini menjelaskan bagaimana <strong>{siteName}</strong>{' '}
          (&ldquo;kami&rdquo;) mengelola informasi saat kamu menggunakan layanan kami. Dengan
          menggunakan layanan ini, kamu menyetujui praktik yang dijelaskan di bawah.
        </p>

        <h2>1. Data yang kami kumpulkan</h2>
        <p>Kami dapat mengumpulkan informasi teknis terbatas, antara lain:</p>
        <ul>
          <li>
            <strong>Alamat IP</strong> — untuk mencegah penyalahgunaan, pembatasan laju (rate
            limiting), dan mendeteksi aktivitas VPN/proxy.
          </li>
          <li>
            <strong>User-Agent / perangkat</strong> — jenis browser dan sistem operasi untuk
            keperluan statistik dan keamanan.
          </li>
          <li>
            <strong>Data kunjungan</strong> — waktu akses, jenis tindakan (ekstraksi/unduh), dan
            tautan yang diproses.
          </li>
          <li>
            <strong>Perkiraan negara</strong> — diturunkan dari alamat IP untuk statistik agregat.
          </li>
        </ul>
        <p>
          Kami <strong>tidak</strong> meminta atau menyimpan kata sandi, data pembayaran, atau
          dokumen identitas. Layanan ini tidak memerlukan pendaftaran akun.
        </p>

        <h2>2. Cara kami menggunakan data</h2>
        <ul>
          <li>Menjalankan dan menjaga keandalan layanan.</li>
          <li>Mencegah spam, penyalahgunaan, dan serangan otomatis.</li>
          <li>Menghasilkan statistik agregat untuk peningkatan layanan.</li>
          <li>Mendeteksi dan memblokir aktivitas mencurigakan sesuai kebijakan kami.</li>
        </ul>

        <h2>3. Penyimpanan lokal</h2>
        <p>
          Kami dapat menggunakan penyimpanan lokal (local storage) pada perangkatmu untuk keperluan
          teknis, seperti menjaga sesi dan preferensi. Kami tidak menggunakannya untuk melacakmu di
          situs lain. Kamu dapat menghapusnya kapan saja melalui pengaturan browser.
        </p>

        <h2>4. Layanan pihak ketiga</h2>
        <p>Untuk menjalankan layanan, kami dapat memakai penyedia pihak ketiga, misalnya:</p>
        <ul>
          <li>
            <strong>Jaringan iklan</strong> — untuk menampilkan iklan yang mendukung layanan gratis
            ini. Penyedia iklan dapat memiliki kebijakan privasinya sendiri.
          </li>
          <li>
            <strong>Layanan deteksi IP/VPN</strong> — untuk menentukan apakah koneksi berasal dari
            penyedia VPN/proxy/data center demi keamanan.
          </li>
        </ul>

        <h2>5. Penyimpanan & retensi</h2>
        <p>
          Data teknis disimpan untuk jangka waktu terbatas sesuai kebutuhan operasional dan
          keamanan, lalu dihapus secara berkala. Kami tidak menyimpan file media yang kamu unduh di
          server kami.
        </p>

        <h2>6. Keamanan</h2>
        <p>
          Kami menerapkan langkah-langkah teknis yang wajar untuk melindungi data, termasuk
          pembatasan akses dan pemantauan aktivitas. Meski demikian, tidak ada sistem yang
          sepenuhnya bebas dari risiko.
        </p>

        <h2>7. Hak pengguna</h2>
        <p>
          Sebagai pengguna, kamu berhak meminta informasi mengenai data teknis yang terkait dengan
          aksesmu. Hubungi kami melalui halaman <Link href="/contact">Kontak</Link>.
        </p>

        <h2>8. Anak di bawah umur</h2>
        <p>
          Layanan ini tidak ditujukan untuk anak di bawah usia 13 tahun. Kami tidak dengan sengaja
          mengumpulkan data dari anak-anak.
        </p>

        <h2>9. Perubahan kebijakan</h2>
        <p>
          Kami dapat memperbarui kebijakan ini dari waktu ke waktu. Perubahan akan berlaku setelah
          dipublikasikan di halaman ini.
        </p>

        <h2>10. Kontak</h2>
        <p>
          Jika ada pertanyaan tentang kebijakan ini, silakan hubungi kami melalui halaman{' '}
          <Link href="/contact">Kontak</Link>.
        </p>
      </StaticShell>
    </>
  );
}
