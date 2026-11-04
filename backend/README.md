# Backend

NestJS + TypeScript. Lihat [README utama](../README.md) untuk setup dan batas scope.

```sh
npm ci
npm run db:setup
npm run start:dev
```

Endpoint awal: `GET /api/health`. Endpoint menjalankan `SELECT 1` melalui driver
`pg` dan mengembalikan HTTP 200 jika PostgreSQL dapat diakses, atau HTTP 503 jika
koneksi/query gagal. Empat tabel bisnis dan tiga user demo sudah tersedia melalui
migration/seed Step 4. Endpoint dan aturan workflow Step 5 sudah diimplementasikan.

Jalankan service database terlebih dahulu sesuai README utama. Koneksi lokal
menggunakan `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, dan `PGPASSWORD`, dengan
default yang sesuai konfigurasi Compose lokal.

```sh
npm run build
npm run lint
npm test
```

Fitur tersedia di src/modules untuk users, work-orders, dan sparepart-requests.
DTO menjalankan validasi HTTP; service mengatur role/status/transaksi; repository
menjalankan query parameterized. Login memverifikasi hash scrypt dan menerbitkan
cookie HttpOnly dengan session tersimpan di PostgreSQL. Guard melindungi API
bisnis dan foto; X-User-Id tidak menentukan identitas. GET /api/users menyediakan
data penugasan setelah login. [Kontrak authentication](../docs/AUTHENTICATION.md).
Lihat [kontrak dan contoh API](../docs/API.md).

Untuk menguji fasilitas transaksi menggunakan PostgreSQL asli:

```sh
npm run test:database
```

Test membuat tabel sementara yang hilang saat koneksi ditutup. Seluruh operasi
repository dalam satu callback withTransaction harus di-await. Nested transaction
belum didukung dan akan ditolak secara eksplisit.

Test schema dan workflow HTTP memakai namespace PostgreSQL terisolasi yang
dibersihkan setelah test. Total pengujian saat ini: dua health dan 65 integrasi.
Perintah setup: npm run db:setup, npm run db:migrate, dan npm run db:seed.
Container menjalankan setup otomatis sebelum HTTP server. Rincian schema dan seed
ada pada [dokumentasi database](../docs/DATABASE.md).
