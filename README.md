# jwplyr Extractor

Alat **video downloader** berbasis web + panel admin, dibangun dengan Next.js 15. Tempel tautan
video, pilih format/kualitas, lalu unduh langsung ke perangkat — cepat, gratis, dan tanpa
registrasi.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

> **Dibuat oleh X [@pansagr](https://x.com/pansagr)**

---

## Fitur

### Halaman publik
- Form unduh simpel: tempel tautan → proses → unduh.
- Parser khusus **jwplyr**: mengekstrak video dari halaman embed yang diizinkan admin.
- Streaming langsung melalui server dengan tautan bertanda tangan (signed) yang kedaluwarsa.
- **Dukungan HLS**: sumber playlist (`.m3u8`) diremux otomatis ke MP4 (via ffmpeg) agar bisa diputar
  dan diunduh.
- Halaman informasi profesional: **Tentang**, **Kebijakan Privasi**, **Syarat & Ketentuan**,
  **DMCA**, dan **Kontak**.
- `robots.txt` + `sitemap.xml` untuk SEO, plus metadata Open Graph/Twitter.

### Panel admin
- Autentikasi berbasis sesi (JWT via cookie) dengan halaman `/install` untuk membuat admin pertama.
- Dashboard statistik: total kunjungan, ekstraksi, unduhan, pengunjung unik, grafik 7 hari.
- **Log Akses**: catat IP, negara, User-Agent, dan status VPN, dengan filter per jenis aksi.
- Manajemen domain & link yang diizinkan.
- Pengaturan situs: nama situs, aktif/nonaktif publik, iklan (Adsterra), Smartlink.
- Manajemen & pengujian proxy untuk ekstraksi jwplyr.
- Penghapusan data proxy (semua/berhasil/gagal/nonaktif).

### Keamanan
- **Same-origin guard** untuk seluruh `/api/*` + **rate limiting** per IP.
- Header keamanan: CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
- **Blokir VPN/proxy/data center** (deteksi via ip-api.com, di-cache, fail-open) pada aksi publik.
- **DevGuard**: mencegah inspect element kasual (klik kanan, F12, `Ctrl+U`, dll.) di halaman publik.
- `X-Robots-Tag: noindex` untuk area sensitif (`/api`, `/admin`, `/install`).

---

## Tumpukan teknologi

- **Framework**: Next.js 15 (App Router) + React 19
- **Bahasa**: TypeScript
- **Database**: SQLite via Prisma ORM
- **Auth**: `jose` (JWT) + `bcryptjs`
- **Ikon**: lucide-react
- **Runtime produksi**: Node.js + PM2 (disarankan) di belakang nginx

---

## Persyaratan

- Node.js **18.18+** (disarankan 20+)
- npm (atau pnpm/yarn)
- SQLite (bawaan — tidak perlu server database terpisah)
- **ffmpeg** (untuk sumber HLS `.m3u8`):

  ```bash
  # Debian/Ubuntu
  sudo apt-get install -y ffmpeg
  ```

---

## Memulai

### 1. Clone & pasang dependensi

```bash
git clone https://github.com/xidcrypto/jdwn.git
cd jdwn
npm install
```

### 2. Konfigurasi environment

```bash
cp .env.example .env
```

Sesuaikan nilainya (lihat tabel di bawah), lalu siapkan database:

```bash
npm run db:push      # membuat/menyinkronkan skema SQLite
npm run db:generate  # men-generate Prisma Client
```

### 3. Jalankan

```bash
# Mode pengembangan
npm run dev

# Mode produksi
npm run build
npm start
```

Situs berjalan di `http://localhost:3000`.

### 4. Buat admin pertama

Buka `/install` pada saat pertama kali untuk membuat akun admin. Setelah itu, login melalui
`/admin`.

---

## Variabel Environment

| Variabel | Wajib | Default | Keterangan |
| --- | :---: | --- | --- |
| `DATABASE_URL` | Ya | `file:./data.db` | Koneksi SQLite. |
| `JWT_SECRET` | Ya | — | Secret acak ≥ 32 karakter untuk sesi & signed link. |
| `NEXT_PUBLIC_SITE_URL` | Tidak | `https://hgitopup.web.id` | URL publik untuk metadata, sitemap, canonical. |
| `ALLOWED_ORIGINS` | Tidak | — | Origin tambahan yang diizinkan (dipisah koma). |
| `API_ALLOW_NO_ORIGIN` | Tidak | — | Set `1` untuk mengizinkan request API tanpa Origin/Referer. |
| `CSP_POLICY` | Tidak | — | Kustomisasi header Content-Security-Policy. |
| `FFMPEG_PATH` | Tidak | `ffmpeg` | Path binary ffmpeg (untuk remux sumber HLS). |
| `REMUX_CACHE_DIR` | Tidak | `os.tmpdir()/jwplyr-remux` | Direktori cache hasil remux HLS. |

---

## Skrip npm

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan server pengembangan. |
| `npm run build` | Build produksi. |
| `npm start` | Menjalankan hasil build. |
| `npm run db:push` | Menyinkronkan skema Prisma ke database. |
| `npm run db:generate` | Men-generate Prisma Client. |
| `npm run db:studio` | Membuka Prisma Studio. |

---

## Deployment (PM2 + nginx)

```bash
npm install
npm run db:push
npm run build
pm2 start npm --name jwplyr-extractor -- start
pm2 save
```

Contoh konfigurasi nginx (reverse proxy):

```nginx
server {
    server_name hgitopup.web.id;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        client_max_body_size 70m;
    }
}
```

> Pastikan `X-Forwarded-For` diteruskan agar deteksi IP, rate limit, dan log akses akurat.

---

## Struktur proyek

```
src/
├── app/
│   ├── page.tsx                 # Halaman publik (downloader)
│   ├── admin/page.tsx           # Panel admin
│   ├── install/page.tsx         # Setup admin pertama
│   ├── about|privacy|terms|dmca|contact/page.tsx
│   ├── robots.ts / sitemap.ts   # SEO
│   └── api/                     # Route handlers (auth, public, logs, dll.)
├── components/                  # PublicApp, AdminApp, DevGuard, SiteFooter, dll.
└── lib/                         # prisma, settings, stats, vpn, security, sign, site, extractor
prisma/
└── schema.prisma                # Skema database
```

---

## API (ringkas)

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| `POST` | `/api/public/extract` | Ekstraksi tautan video. |
| `POST` | `/api/public/download` | Menyiapkan unduhan (signed link). |
| `GET`  | `/api/public/settings` | Konfigurasi publik (cacheable). |
| `POST` | `/api/public/visit` | Mencatat kunjungan. |
| `POST` | `/api/auth/login` | Login admin. |
| `GET`  | `/api/logs` | Log akses (perlu sesi admin). |
| `GET/PUT` | `/api/settings` | Pengaturan situs (perlu sesi admin). |
| `GET`  | `/api/stats` | Statistik dashboard (perlu sesi admin). |

---

## Lisensi & penggunaan

Proyek ini disediakan "sebagaimana adanya" untuk keperluan pribadi. Hormati hak cipta pemilik
konten. Layanan tidak berafiliasi dengan platform sumber mana pun. Untuk laporan hak cipta,
lihat halaman **DMCA**.

---

<p align="center">Dibuat oleh <a href="https://x.com/pansagr">X @pansagr</a></p>
