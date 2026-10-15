import type { Metadata } from 'next';
import Link from 'next/link';
import StaticShell from '@/components/StaticShell';

export const metadata: Metadata = {
  title: 'Kebijakan DMCA',
  description:
    'Prosedur pemberitahuan dan penanganan pelanggaran hak cipta (DMCA) di jwplyr Extractor.',
};

export default function DmcaPage() {
  return (
    <StaticShell
      title="Kebijakan DMCA"
      subtitle="Prosedur pemberitahuan pelanggaran hak cipta dan tindakan yang kami lakukan."
      updated="15 Oktober 2026"
    >
      <p>
        <strong>jwplyr Extractor</strong> menghormati hak kekayaan intelektual pihak lain dan
        berkomitmen menangani keluhan pelanggaran hak cipta sesuai Digital Millennium Copyright Act
        (DMCA) dan hukum hak cipta yang berlaku.
      </p>

      <h2>Peran kami</h2>
      <p>
        Kami adalah penyedia alat teknis. Kami <strong>tidak meng-host</strong> dan{' '}
        <strong>tidak menyimpan</strong> file media di server kami. Konten sepenuhnya berada di
        platform/situs pihak ketiga. Karena itu, permintaan penghapusan konten sebaiknya juga
        ditujukan kepada platform yang menaungi konten tersebut.
      </p>

      <h2>Mengajukan pemberitahuan DMCA</h2>
      <p>
        Jika kamu yakin bahwa karya berhak ciptamu disalahgunakan melalui layanan kami, kirim
        pemberitahuan tertulis yang memuat:
      </p>
      <ol>
        <li>Identitas dan informasi kontak kamu (nama, email).</li>
        <li>Deskripsi karya berhak cipta yang kamu klaim dilanggar.</li>
        <li>
          Tautan (URL) spesifik yang menjadi objek keluhan, agar kami dapat mengidentifikasinya
          dengan jelas.
        </li>
        <li>Pernyataan bahwa kamu memiliki dasar keyakinan yang baik atas klaim tersebut.</li>
        <li>
          Pernyataan, di bawah sumpah, bahwa informasi dalam pemberitahuan akurat dan kamu berhak
          bertindak atas nama pemegang hak.
        </li>
        <li>Tanda tangan kamu (elektronik atau fisik).</li>
      </ol>

      <h2>Tindakan kami</h2>
      <ul>
        <li>Meninjau setiap pemberitahuan yang valid dalam waktu wajar.</li>
        <li>
          Menonaktifkan atau membatasi akses terhadap tautan/endpoint tertentu yang secara langsung
          terkait dengan pelanggaran, bila memungkinkan secara teknis.
        </li>
        <li>
          Menangguhkan akses pengguna yang terbukti berulang kali melakukan pelanggaran.
        </li>
      </ul>

      <h2>Penolakan (counter-notice)</h2>
      <p>
        Jika kamu yakin konten yang ditangguhkan tidak melanggar hak cipta, kamu dapat mengirimkan
        penolakan tertulis beserta bukti pendukung untuk kami tinjau.
      </p>

      <h2>Kontak</h2>
      <p>
        Kirim pemberitahuan DMCA melalui halaman <Link href="/contact">Kontak</Link> dengan subjek
        "DMCA Notice".
      </p>
    </StaticShell>
  );
}
