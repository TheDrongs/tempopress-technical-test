# Tempopress - Work Order Technical Test

**Paket penyerahan selesai disiapkan dan diuji dari hasil ekstraksi ZIP.**
Lihat [verifikasi paket](docs/SUBMISSION.md). Mulai dengan bagian
[Menjalankan dengan Docker](#menjalankan-dengan-docker) di bawah.

Backend Work Order menyediakan workflow API dari create sampai completion.
Frontend React menyediakan list dan modal detail, form login, serta
upload/review foto sparepart. Docker Compose menjalankan frontend, backend, dan
PostgreSQL.

## Stack

- Backend: NestJS + TypeScript
- Frontend: React + TypeScript + Vite, Tailwind CSS, komponen pola shadcn/Radix
- Integrasi frontend: Axios, Zustand, React Router
- Database: PostgreSQL 17
- Driver database backend: node-postgres (`pg`)
- Runtime container: Node.js 22, Nginx, Docker Compose

## Struktur

```text
backend/              # Aplikasi API NestJS
frontend/             # Aplikasi React + Vite
docker-compose.yml    # Frontend, backend, PostgreSQL, dan volume data
.env.example          # Konfigurasi lokal Docker Compose
README.md
```

Kerangka modul users, work-orders, dan sparepart-requests sudah terpasang.
Setiap fitur memiliki controller, service, tipe internal, serta repository
(interface + implementasi PostgreSQL). DTO dalam folder dto per fitur menjalankan
validasi runtime. Service mengatur aturan role/status dan transaksi, sedangkan
query berada di repository. Driver tetap pg; perubahan progres memakai kunci
baris WO agar request bersamaan tidak diproses ganda.

## Workflow dan rencana arsitektur

Workflow dan asumsi Step 2 telah disepakati. Rincian role, tujuh status WO,
perpindahan status, serta aturan sparepart dan completion dicatat bersama
arsitektur backend dan status implementasi kerangka Step 3 di
[Workflow dan Rencana Arsitektur Work Order](docs/WORKFLOW.md).

Struktur 31 kolom (termasuk image_path dan SPV tujuan), constraint, relasi, migration, dan seed dijelaskan di
[Database Work Order](docs/DATABASE.md).

Kontrak endpoint, body/response, error, identitas pelaku, dan contoh mencoba
workflow tersedia pada [API Work Order - Step 5](docs/API.md).

Aturan foto, kontrak multipart, volume penyimpanan, dan akses gambar dijelaskan di
[Foto Opsional Sparepart](docs/SPAREPART_PHOTOS.md).

Struktur folder FE, pembagian state, route modal, cara mencoba alur per role,
dan pengujian dijelaskan di [Frontend Work Order](docs/FRONTEND.md).

GET /api/health dan POST /api/auth/login dapat diakses sebelum login. Endpoint
users, WO, approval, dan foto memerlukan session yang valid. Foto juga mengikuti
pembatasan akses WO induknya. Backend mengambil identitas dan role dari database.

## Asumsi dan batas scope

- Admin membuat draft dan mengirim WO ke SPV; SPV menugaskan mechanic.
- Admin menyiapkan pekerjaan/pengajuan sparepart; SPV menyetujui sparepart.
- Mechanic menandai mulai bekerja; Admin memasukkan waktu selesai untuk completion.
- Satu SPV tujuan dan satu mechanic per WO. SPV/Mechanic hanya melihat penugasannya;
  Admin melihat semua WO. Jika hanya ada satu SPV, tujuan dipilih otomatis.
- Pengajuan sparepart opsional; satu pengajuan berisi beberapa item. Foto opsional,
  satu JPG/PNG per item, maksimal 2 MiB dan 10 foto per pengajuan.
- Foto tersimpan pada volume Docker; database menyimpan path relatif.
- Authentication merupakan bonus yang dipilih. Akun demo dibuat otomatis, tanpa registrasi.
- Pagination memakai daftar hasil API yang sudah dibatasi berdasarkan akses pengguna.
- Batas judul/deskripsi/nama sparepart/catatan: 50/100/30/100 karakter.
- Aplikasi ditujukan untuk demo localhost. Tidak mencakup modul ERP lain.

## Akun demo

| Role | Username | Password |
| --- | --- | --- |
| Admin | admin | admin123 |
| SPV | spv | spv123 |
| Mechanic | mekanik | mekanik123 |

Kredensial demo dibuat otomatis saat setup. Password disimpan sebagai hash scrypt.
Buka aplikasi dan login dengan akun terkait. Dropdown di bawah username membuka
popup login untuk pergantian role. Password salah atau pembatalan mempertahankan
session lama; login sukses mencabut session lama dan membuka panel akun baru. Nama dan role akun login tampil pada header; warna sidebar mengikuti role.
Session dipulihkan saat refresh; session yang kedaluwarsa mengarahkan ke login.

## Menjalankan dengan Docker

Prasyarat: Docker Desktop sudah terpasang dan berjalan menggunakan Linux containers.

Dari root project di PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Default konfigurasi juga tersedia di Compose sehingga perintah
`docker compose up --build` bisa dijalankan tanpa membuat `.env`.

Startup backend otomatis menjalankan migration dan seed sebelum HTTP server.
Setup dapat diulang pada volume existing tanpa menggandakan user atau migration.
Database memiliki empat tabel bisnis, tabel session `auth_sessions`, dan metadata
`_schema_migrations`. Lima migration diterapkan berurutan. File migration yang sudah diterapkan tidak diubah;
perubahan schema berikutnya memakai file migration baru.

- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/api/health
- PostgreSQL: localhost:5432

Frontend menggunakan Nginx untuk meneruskan `/api` ke backend. Halaman Work Order
menampilkan data API dengan loading/error/retry. Backend menunggu
database sehat sebelum mulai; frontend menunggu backend sehat. Jika port lokal bentrok, ubah
`FRONTEND_PORT`, `BACKEND_PORT`, atau `POSTGRES_PORT` di `.env`.

Untuk berhenti tanpa menghapus data database:

```powershell
docker compose down
```

Data PostgreSQL, termasuk session login, disimpan dalam named volume `postgres_data`. File foto memakai
named volume `sparepart_uploads` pada `/app/uploads` di backend; service tetap tiga.
Backup aplikasi perlu mencakup database dan volume foto. Perintah `down -v` akan
menghapus keduanya.

## Development tanpa container aplikasi

Prasyarat: Node.js 22.23.3 atau lebih baru dalam versi 22, serta npm.
Setiap aplikasi memiliki `package.json` dan lockfile sendiri.

Jalankan database dari root terlebih dahulu:

```powershell
docker compose up -d --wait database
```

Terminal pertama:

```powershell
cd backend
npm ci
npm run db:setup
npm run start:dev
```

Terminal kedua:

```powershell
cd frontend
npm ci
npm run dev
```

Buka http://localhost:5173. Vite meneruskan `/api` ke http://127.0.0.1:3000.
Jika backend menggunakan port lain, set `API_PROXY_TARGET` sebelum menjalankan Vite:

```powershell
$env:API_PROXY_TARGET = 'http://127.0.0.1:3001'
npm run dev
```

`.env` di root hanya dipakai Docker Compose. Untuk port backend lokal,
set `$env:PORT` di terminal backend. Koneksi PostgreSQL lokal default mengikuti
nilai pada tabel DBeaver di bawah. Jika konfigurasi database di `.env` diubah,
set variabel berikut di terminal backend sebelum `npm run start:dev`:

```powershell
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '5432'
$env:PGDATABASE = 'tempopress'
$env:PGUSER = 'tempopress'
$env:PGPASSWORD = 'tempopress_local'
```

Sesuaikan `PGPORT`, `PGDATABASE`, `PGUSER`, dan `PGPASSWORD` dengan konfigurasi
lokal. Di dalam Compose, host database adalah `database` dan port internal tetap
5432; Compose mengirim konfigurasi tersebut ke backend secara otomatis.

Jalankan `npm run db:setup` setelah menyesuaikan konfigurasi PG dan sebelum
memulai backend lokal. Operasi terpisah tersedia melalui `npm run db:migrate`
dan `npm run db:seed`. Script ini membuild backend dan menjalankan setup CLI.

Untuk mengulang setup di container yang sedang berjalan, dari root:

```powershell
docker compose exec backend node dist/database/setup/cli.js setup
```

## Koneksi DBeaver

Pilih koneksi PostgreSQL dengan nilai default berikut, atau sesuaikan dengan `.env`:

| Field | Nilai |
| --- | --- |
| Host | localhost |
| Port | 5432 |
| Database | tempopress |
| Username | tempopress |
| Password | tempopress_local |

Kredensial ini hanya untuk development lokal. Koneksi DBeaver membutuhkan service
database dalam keadaan berjalan. Akun database ini berbeda dari user aplikasi.

Di navigator DBeaver, buka Tempopress Local -> Databases -> tempopress -> Schemas
-> public -> Tables. Refresh node Tables jika daftar lama masih tersimpan.
Tabel users berisi Admin Demo, SPV Demo, dan Mechanic Demo. Lihat
[rincian seed](docs/DATABASE.md#seed-user-demo) untuk ID tetap masing-masing user.

## Pemeriksaan

Di folder `backend`:

```powershell
npm run build
npm run lint
npm test
```

Test transaksi dengan PostgreSQL asli (service database harus berjalan):

```powershell
npm run test:database
```

Test ini memakai konfigurasi PG yang sama dengan backend. Test transaksi memakai
tabel TEMP per koneksi; test schema membuat namespace terisolasi dan menghapusnya
setelah selesai. Tabel bisnis dalam public tidak diubah. Kasusnya mencakup
transaksi, setup awal/ulang/bersamaan, checksum, rollback migration gagal,
constraint, FK, nullable/default, qty, tanggal, serta workflow HTTP dengan dan tanpa
sparepart, pembatasan role, validasi, rollback, dan request bersamaan.
Test schema/workflow memerlukan izin
membuat schema, yang sudah tersedia pada user PostgreSQL lokal Compose.
Service bisnis nantinya menggunakan token TRANSACTION_MANAGER agar tidak
bergantung pada tipe koneksi PostgreSQL.

Di folder `frontend`:

```powershell
npm run build
npm run lint
```

Pemeriksaan manual: buka frontend, login sebagai admin, lalu buat WO pertama.
Setelah submit, logout dan login sebagai spv untuk penugasan; lanjutkan persiapan
sebagai admin, start sebagai mekanik, dan completion sebagai admin. Jalur sparepart
memerlukan persetujuan spv sebelum start. Panduan UI ada di docs/FRONTEND.md; contoh API/PowerShell
ada di docs/API.md. Endpoint `/api/health` tetap tersedia. Response health sukses:

```json
{"status":"ok","service":"backend","database":"connected"}
```

Test HTTP backend memverifikasi response 200 ketika pemeriksaan database berhasil
dan response 503 ketika pemeriksaan gagal. Test tersebut mengganti akses database
dengan test double; koneksi PostgreSQL asli diverifikasi melalui Docker Compose.

Verifikasi Docker Compose sudah berhasil dengan
`docker compose up --build -d --wait --wait-timeout 180`. Ketiga service berstatus
healthy. Query dari container backend berhasil membaca database `tempopress`,
frontend tersaji melalui Nginx, dan health API mengembalikan HTTP 200 dengan
`database: connected` baik melalui port backend maupun proxy frontend.

Untuk melihat status service yang sedang berjalan:

```powershell
docker compose ps
```

Verifikasi Step 5: build/lint backend, dua test health, dan 31 test integrasi
database/API berhasil. API langsung dan proxy frontend memverifikasi daftar
user/WO, header pelaku, role, validasi DTO, serta health. Test workflow memakai
schema terisolasi yang dibersihkan setelah selesai; data bisnis public tidak
diisi fixture pengujian.

Tambahan foto opsional sudah diverifikasi dengan build/lint, dua test health,
dan 44 test integrasi database/API. Upload melalui Nginx dan persistensi foto
setelah container backend dibuat ulang berhasil. Data/file uji dibersihkan.

Verifikasi frontend Step 6–7: build/lint, dua belas unit test, dan sembilan test browser
lulus. Kedua jalur sampai completed juga diuji melalui UI Docker dengan API asli,
termasuk upload, preview, approval, dan reload deep link. Data/file uji dibersihkan.
Jalankan `npm test` dan `npm run test:e2e` dari frontend untuk mengulang test FE;
test browser membutuhkan Chrome atau Edge terpasang.

Revisi penugasan: list/detail dibatasi di backend. Admin melihat semua WO, SPV
hanya WO non-draft yang dikirim kepadanya, Mechanic hanya WO yang ditugaskan
kepadanya. Migration 003 menambah assigned_spv_id; empat tabel bisnis tetap cukup.
Suite backend kini mencakup 65 test integrasi dan dua test health. Seluruh aksi
frontend memakai popup sukses di atas detail blur, lalu kembali ke list saat ditutup.

Audit dependency backend saat setup melaporkan dua temuan moderate pada tooling
development (`@nestjs/cli` dan dependency `minimatch`), bukan dependency runtime.
Perbaikan otomatis yang ditawarkan npm menurunkan major version CLI; perubahan
tersebut belum diterapkan.
