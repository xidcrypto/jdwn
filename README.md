# jwplyr Extractor — Backend

Backend Node.js untuk mencari URL video asli jwplyr.com (tanpa iklan),
dengan database SQLite, 1 akun admin, dan manajemen proxy.

**Murni Node.js — tanpa `npm install` apa pun.** Butuh Node.js **22.5+**
(untuk modul bawaan `node:sqlite`).

## Menjalankan

```bash
node server.js
# atau dengan port & kredensial sendiri:
PORT=3000 ADMIN_USER=admin ADMIN_PASS=rahasia123 node server.js
```

- UI admin: http://localhost:3000/ (atau `/admin`)
- Database: `./data.db` (atau `$DB_PATH`)

Saat pertama dijalankan dan belum ada akun admin, server otomatis membuat
satu akun:
- dari `$ADMIN_USER` / `$ADMIN_PASS` bila diset, atau
- username `admin` + password acak yang **dicetak ke console** (ganti via menu Pengaturan).

## API

Semua endpoint memakai header `Authorization: Bearer <token>`
(kecuali `/api/login`; `/api/download` memakai `?token=` di URL).

| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/api/login` | `{username, password}` → `{token, expiresAt}` |
| POST | `/api/logout` | hapus sesi saat ini |
| GET | `/api/me` | info admin + statistik proxy |
| POST | `/api/change-password` | `{oldPassword, newPassword}` |
| GET | `/api/proxies` | daftar proxy (kredensial disamarkan) |
| POST | `/api/proxies` | `{proxy}` — tambah satu |
| POST | `/api/proxies/bulk` | `{proxies:[...]}` atau `{text:"..."}` — tambah banyak |
| POST | `/api/proxies/scrape` | scrape proxy gratis dari sumber publik → masuk DB (`{sources:[...]}` opsional) |
| POST | `/api/proxies/test-all` | uji massal proxy aktif, yg gagal dinonaktifkan (`{limit, concurrency, disableFailed}` opsional) |
| POST | `/api/proxies/prune` | hapus proxy yg sering gagal (`{minFail, onlyScraped}` opsional) |
| PATCH | `/api/proxies/:id` | `{enabled}` — aktif/nonaktif |
| DELETE | `/api/proxies/:id` | hapus |
| POST | `/api/proxies/:id/test` | uji proxy → `{ok, ms}` |
| POST | `/api/extract` | `{url}` → `{videoId, title, videoUrl, expiresAt, proxy}` |
| GET | `/api/download?url=..&token=..` | stream MP4 langsung (bisa diputar di browser/VLC) |

Contoh:

```bash
# login
TOKEN=$(curl -s -X POST localhost:3000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"..."}' | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).token")

# tambah proxy satuan
curl -X POST localhost:3000/api/proxies -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"proxy":"http://user:pass@host:8080"}'

# tambah bulk
curl -X POST localhost:3000/api/proxies/bulk -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"text":"http://u1:p1@h1:8080\nsocks5h://u2:p2@h2:1080"}'

# scrape proxy gratis -> DB
curl -X POST localhost:3000/api/proxies/scrape -H "Authorization: Bearer $TOKEN"

# uji massal (maks 200, 10 konkuren), yg gagal dinonaktifkan
curl -X POST localhost:3000/api/proxies/test-all -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"limit":200,"concurrency":10}'

# hapus proxy scrape yg gagal >=5x
curl -X POST localhost:3000/api/proxies/prune -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"minFail":5,"onlyScraped":true}'

# extract
curl -X POST localhost:3000/api/extract -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"url":"https://jwplyr.com/e/vclxjnlx2fvg"}'

# download / streaming (buka di browser atau VLC)
# http://localhost:3000/api/download?url=<url-embed>&token=<token>&download=1
```

## Cara kerja proxy

- Ekstraksi memakai proxy aktif dengan sistem **round-robin**; proxy yang
  sering gagal otomatis tenggelam ke urutan bawah (`fail_count` ASC).
- Bila satu proxy gagal, otomatis **failover** ke proxy berikutnya,
  terakhir dicoba tanpa proxy (direct).
- Setiap kegagalan menaikkan `fail_count` proxy tersebut (terlihat di UI).
- Format proxy: `http://user:pass@host:port` (awalan `http://` boleh
  dihilangkan), juga mendukung `socks5h://` bila proxy-nya SOCKS.

### Proxy gratis (auto-scrape)

Endpoint `POST /api/proxies/scrape` mengambil daftar proxy HTTP gratis dari
sumber publik (default: GitHub TheSpeedX/PROXY-List, monosans/proxy-list,
dan API proxyscrape) lalu menyimpannya ke DB. Sumber bisa dioverride via
`$PROXY_SCRAPE_SOURCES` (pisahkan dengan koma/baris baru).

Untuk scrape berkala otomatis, jalankan dengan:
`PROXY_SCRAPE_INTERVAL_HOURS=6 node server.js`

Alur yang disarankan untuk proxy gratis: **Scrape** → **Uji massal**
(menonaktifkan yang mati) → **Hapus proxy gagal** untuk bersih-bersih.

> Catatan: server file video mewajibkan header `Referer: https://jwplyr.com/`
> (tanpa itu: 403). Endpoint `/api/download` sudah mengirimkannya otomatis,
> jadi URL download bisa langsung diputar/diunduh tanpa 403.

## Struktur file

```
server.js      — HTTP server + routing + auth + API
db.js          — SQLite (tabel: admin, proxies, sessions)
extractor.js   — inti ekstraksi jwplyr (bisa dipakai terpisah)
admin.html     — UI admin (login, kelola proxy, extract, pengaturan)
data.db        — database SQLite (dibuat otomatis)
```
