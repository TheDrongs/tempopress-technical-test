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

## Asumsi implementasi dan batas scope

Bagian ini mendokumentasikan keputusan implementasi untuk detail yang belum
ditentukan secara eksplisit dalam requirement. Penambahan fitur dijelaskan
terpisah agar reviewer dapat membedakannya dari workflow utama technical test.

- **Status proses:** tahap WO menggunakan `DRAFT`, `SUBMITTED`, `ASSIGNED`,
  `WAITING_SPAREPART_APPROVAL`, `READY_TO_WORK`, `WORKING`, dan `COMPLETED`.
  Status dipisahkan agar tahap penugasan, persiapan, dan persetujuan dapat dilacak.
- **Draft dan submit terpisah:** membuat WO menyimpan draft terlebih dahulu.
  WO diteruskan kepada SPV setelah Admin memilih **Submit Work Order**.
- **Peninjauan WO oleh SPV:** label UI **Menunggu Approval SPV** mengacu pada
  status `SUBMITTED`. SPV meninjau lalu menugaskan mechanic; aksi penugasan
  melanjutkan WO ke `ASSIGNED`, tanpa tahap approval WO tambahan.
- **Penerima dan akses:** satu WO memiliki satu SPV tujuan dan satu mechanic.
  SPV tujuan dipilih otomatis jika hanya ada satu; jika lebih, Admin memilihnya.
  Admin melihat semua WO, SPV hanya WO non-draft yang dikirim kepadanya, dan
  mechanic hanya WO yang ditugaskan kepadanya. Backend memeriksa akses ini.
- **Persiapan oleh Admin:** setelah penugasan mechanic, Admin meninjau atau
  memperbarui judul/deskripsi dan menentukan kebutuhan sparepart. Penugasan
  belum berarti pekerjaan sudah dimulai.
- **Sparepart opsional:** tanpa sparepart, WO langsung siap dikerjakan setelah
  persiapan. Jika dibutuhkan, Admin membuat satu pengajuan berisi satu atau
  beberapa item dengan nama dan jumlah bilangan bulat positif. Pengajuan harus
  disetujui SPV tujuan sebelum mechanic dapat mulai bekerja.
- **Waktu dan completion:** `start_date` diisi backend ketika mechanic yang
  ditugaskan mulai bekerja. Admin menyelesaikan WO dengan `end_date` yang tidak
  lebih awal dari waktu mulai. WO yang sudah `COMPLETED` tidak diproses ulang.
- **Batas input:** judul maksimal 50 karakter, deskripsi 100, nama sparepart 30,
  dan catatan persetujuan 100. Counter tampil di UI; backend memvalidasi batasnya.
- **Penyederhanaan demo:** tidak menambahkan rejection, revisi approval, reopen,
  pembatalan, penerimaan barang, atau modul inventory/ERP lain. Pagination
  5/10/20 menggunakan daftar hasil API yang sudah dibatasi sesuai akses akun.

## Fitur tambahan dan alasan bisnis

### Foto opsional per item sparepart

Foto merupakan pengembangan UX dan proses bisnis yang dipilih dalam implementasi,
di luar workflow inti. Foto membantu SPV mengenali sparepart yang diajukan dan
memvalidasi kebutuhan secara visual, sehingga review lebih mudah dibanding hanya
membaca nama dan jumlah item. Foto adalah informasi pendukung; pengajuan tetap
dapat diproses tanpa foto dan aturan persetujuan tidak berubah.

- Admin dapat menambahkan satu foto JPG/PNG per item pada form pengajuan.
- Maksimal 2 MiB per foto dan 10 foto per pengajuan; setiap item boleh tanpa foto.
- Preview tersedia sebelum submit, dan foto tampil di detail pengajuan untuk
  ditinjau SPV bersama nama, jumlah, serta catatan persetujuan.
- File tersimpan pada volume Docker `sparepart_uploads`; database menyimpan path
  relatif. Akses foto mengikuti akses WO induk dan membutuhkan session valid.

### Autentikasi dan kesesuaian role

Requirement menyatakan autentikasi tidak wajib dan dapat menjadi bonus;
implementasi ini memilih menambahkannya. Tujuannya memastikan role yang digunakan
sesuai dengan akun yang berhasil diverifikasi, sehingga pengguna tidak cukup
mengganti pilihan role untuk memperoleh hak Admin, SPV, atau Mechanic.

- Login memakai akun demo yang di-seed otomatis, tanpa fitur registrasi.
- Backend menentukan identitas dan role dari akun/session, lalu memvalidasi
  izin serta penugasan pada setiap aksi. Pilihan dropdown bukan sumber otorisasi.
- Password disimpan sebagai hash scrypt; session memakai cookie HttpOnly dan
  dapat dipulihkan saat refresh. Logout mencabut session.
- Dropdown role di bawah username membuka popup login untuk akun tujuan.
  Role baru aktif setelah username/password benar dan cocok dengan role tujuan.
- Password salah, role tidak sesuai, atau popup dibatalkan mempertahankan
  session lama. Setelah login tujuan berhasil, session lama dicabut dan session
  baru dibuat dalam satu transaksi; cache WO dibersihkan dan panel tujuan dibuka.

## Flow aplikasi lengkap

Setelah menjalankan Docker Compose, buka `http://localhost:5173` dan login sebagai
Admin. Database baru berisi tiga akun demo dengan daftar WO kosong. Untuk mencoba
peran berikutnya, gunakan dropdown role dan login melalui popup, atau logout lalu
login menggunakan akun terkait. Informasi akun tersedia di bagian Akun demo.

| Tahap | Pelaku dan aksi | Hasil/status |
| --- | --- | --- |
| 1. Buat WO | Admin memilih **Buat Work Order**, mengisi judul dan deskripsi opsional, lalu menyimpan. | WO tersimpan sebagai `DRAFT`. |
| 2. Submit | Admin membuka detail draft dan memilih **Submit Work Order**, dengan SPV tujuan. | `SUBMITTED`; UI menampilkan **Menunggu Approval SPV**. WO mulai terlihat oleh SPV tujuan. |
| 3. Tinjau dan tugaskan | SPV tujuan meninjau WO lalu memilih mechanic yang akan mengerjakan. | `ASSIGNED`; mechanic terpilih dapat melihat WO. Pekerjaan masih menunggu persiapan Admin. |
| 4A. Persiapan tanpa sparepart | Admin meninjau/memperbarui informasi lalu menyelesaikan persiapan tanpa pengajuan sparepart. | `READY_TO_WORK`; lanjut ke tahap 6. |
| 4B. Persiapan dengan sparepart | Admin menambahkan nama dan jumlah item, serta foto opsional, kemudian mengirim pengajuan. | Request `PENDING`; WO `WAITING_SPAREPART_APPROVAL`. |
| 5. Persetujuan sparepart | SPV tujuan membuka detail, memeriksa item/foto, lalu menyetujui; catatan persetujuan opsional. | Request `APPROVED`; WO menjadi `READY_TO_WORK` setelah tidak ada pengajuan terkait yang masih pending. |
| 6. Mulai pekerjaan | Mechanic yang ditugaskan membuka WO siap dikerjakan dan menjalankan aksi mulai bekerja. | `WORKING`; backend mencatat waktu mulai. |
| 7. Selesaikan WO | Admin membuka detail pekerjaan yang sedang berjalan, mengisi waktu selesai yang valid, lalu memilih **Selesaikan Work Order**. | `COMPLETED`; waktu selesai tersimpan dan aksi progres dikunci. |

Ringkasan jalur **tanpa sparepart**:

```text
Admin: DRAFT -> SUBMITTED
SPV: ASSIGNED
Admin: READY_TO_WORK
Mechanic: WORKING
Admin: COMPLETED
```

Ringkasan jalur **dengan sparepart**:

```text
Admin: DRAFT -> SUBMITTED
SPV: ASSIGNED
Admin: WAITING_SPAREPART_APPROVAL (item + foto opsional; request PENDING)
SPV: READY_TO_WORK (request APPROVED)
Mechanic: WORKING
Admin: COMPLETED
```

Mechanic tidak dapat memulai WO yang masih menunggu persiapan atau approval
sparepart. SPV/Mechanic tidak dapat membuka draft milik Admin atau WO di luar
penugasannya, termasuk melalui URL/API langsung. Completion dilakukan Admin,
sedangkan persetujuan sparepart dilakukan SPV.

Setiap aksi sukses menampilkan popup konfirmasi di atas detail yang diburamkan;
menutup popup mengembalikan pengguna ke daftar WO. List serta panel perhatian
menunjukkan status dan tugas yang masih perlu ditindaklanjuti sesuai role.
Validasi yang gagal mempertahankan form agar data dapat diperbaiki.

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
Setelah submit, ganti akun melalui popup login role SPV untuk penugasan; lanjutkan persiapan
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
