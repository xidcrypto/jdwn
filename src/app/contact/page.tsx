import type { Metadata, Viewport } from 'next';
import StaticShell from '@/components/StaticShell';
import JsonLd from '@/components/JsonLd';
import { CREATOR } from '@/lib/site';
import { getSettings } from '@/lib/settings';
import { pageMetadata, pageStructuredLd } from '@/lib/seo';

export const viewport: Viewport = { themeColor: '#f5f6fb' };

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getSettings();
  return pageMetadata({
    siteName,
    title: 'Kontak',
    description: `Hubungi tim ${siteName} untuk pertanyaan, masukan, atau laporan.`,
    path: '/contact',
    keywords: ['kontak', 'hubungi kami', 'contact'],
  });
}

export default async function ContactPage() {
  const { siteName } = await getSettings();
  return (
    <>
      <JsonLd
        data={pageStructuredLd([
          { name: 'Beranda', path: '/' },
          { name: 'Kontak', path: '/contact' },
        ])}
      />
      <StaticShell
        title="Hubungi Kami"
        subtitle="Ada pertanyaan, masukan, atau menemukan masalah? Kami siap membantu."
        updated="15 Oktober 2026"
      >
        <p>
          Kami senang mendengar masukan dari pengguna. Gunakan kanal di bawah ini sesuai
          kebutuhanmu.
        </p>

        <h2>Dukungan umum & masukan</h2>
        <p>
          Untuk pertanyaan umum, saran fitur, atau laporan bug, kirimkan pesan melalui X:{' '}
          <a href={CREATOR.url} target="_blank" rel="noopener noreferrer">
            {CREATOR.label}
          </a>
          .
        </p>

        <h2>Laporan hak cipta (DMCA)</h2>
        <p>
          Untuk laporan pelanggaran hak cipta, sertakan subjek <strong>"DMCA Notice"</strong> dan
          ikuti panduan pada halaman <a href="/dmca">Kebijakan DMCA</a>.
        </p>

        <h2>Keamanan & penyalahgunaan</h2>
        <p>
          Menemukan celah keamanan atau aktivitas penyalahgunaan? Laporkan secara bertanggung jawab
          melalui kanal di atas agar dapat kami tindak lanjuti dengan cepat.
        </p>

        <h2>Waktu respons</h2>
        <p>Kami berupaya membalas dalam 1&ndash;3 hari kerja. Terima kasih atas kesabaranmu.</p>
      </StaticShell>
    </>
  );
}
