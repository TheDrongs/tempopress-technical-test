# Database Work Order - Step 4

Diimplementasikan pada 3 November 2026 menggunakan PostgreSQL 17, driver pg, dan
schema public pada database tempopress. Sumber pembentukan tabel adalah
[migration SQL](../backend/migrations/001_create_work_order_schema.sql).

## Cakupan dan aturan umum

Sebelum authentication, setelah tambahan foto dan penugasan SPV, empat tabel bisnis
memiliki total 31 kolom. Migration awal membentuk 29 kolom, lalu
[migration foto](../backend/migrations/002_add_sparepart_item_image.sql) menambah
image_path dan [migration SPV](../backend/migrations/003_add_work_order_supervisor.sql)
menambah assigned_spv_id tanpa mengubah migration awal. Tabel tambahan _schema_migrations
adalah metadata teknis setup, bukan entity atau fitur bisnis.

Authentication kemudian menambah username/password_hash dan tabel auth_sessions.
Kondisi akhir adalah 33 kolom bisnis, enam tabel termasuk dua tabel teknis, serta
lima migration. Rincian terbaru ada di [Authentication](AUTHENTICATION.md).

- ID: UUID primary key, default gen_random_uuid().
- Waktu: TIMESTAMPTZ, sehingga tanggal/waktu memiliki acuan zona waktu.
- created_at dan updated_at: NOT NULL, default NOW() saat insert.
- Query update Step 5 mengisi updated_at = NOW(); tidak ada trigger
  otomatis updated_at.
- Field optional menggunakan NULL sebelum terisi.
- Nilai role/status dibatasi CHECK constraint; perpindahan status dan kewenangan
  pelaku diperiksa service Step 5.

## users - 7 kolom

| Kolom | Tipe | Nullable | Keterangan |
| --- | --- | --- | --- |
| id | UUID | Tidak | Primary key, otomatis dibuat |
| name | VARCHAR | Tidak | Nama tidak boleh kosong setelah BTRIM |
| role | VARCHAR | Tidak | ADMIN / SPV / MECHANIC |
| created_at | TIMESTAMPTZ | Tidak | Default NOW() |
| updated_at | TIMESTAMPTZ | Tidak | Default NOW(), diperbarui saat update |
| username | TEXT | Ya untuk akun legacy | Unik, lowercase; wajib untuk login |
| password_hash | TEXT | Ya untuk akun legacy | Hash scrypt; tidak pernah dikirim API |

Role dan nama tidak unik; beberapa user dapat memiliki role atau nama yang sama.
Username dan password_hash ditambahkan untuk authentication. Username unik dan
dinormalisasi lowercase; password memakai hash scrypt. Akun legacy tanpa
kredensial tetap dapat menjadi referensi penugasan, tetapi belum dapat login.

## auth_sessions - 5 kolom

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | UUID | Primary key |
| user_id | UUID | FK users.id, ON DELETE CASCADE |
| token_hash | TEXT | SHA-256 token acak; unik |
| created_at | TIMESTAMPTZ | Awal session |
| expires_at | TIMESTAMPTZ | Batas session delapan jam |

Migration 004 menambah kredensial dan session; 005 mengganti identifier menjadi
username serta memutakhirkan akun seed yang diketahui. Hasil akhir: 33 kolom
pada empat tabel bisnis, satu tabel session, satu tabel metadata, dan delapan FK.
Seed tidak mengganti kredensial akun yang sudah dikustomisasi. Logout menghapus
session terkait; session kedaluwarsa dibersihkan ketika login berikutnya.

## work_orders - 11 kolom

| Kolom | Tipe | Nullable | Keterangan |
| --- | --- | --- | --- |
| id | UUID | Tidak | Primary key, otomatis dibuat |
| title | VARCHAR | Tidak | Judul tidak boleh kosong setelah BTRIM |
| description | TEXT | Ya | Deskripsi optional |
| status | VARCHAR | Tidak | Default DRAFT, mengikuti tujuh status Step 2 |
| created_by | UUID | Tidak | FK ke users.id |
| assigned_spv_id | UUID | Ya | FK ke users.id, SPV tujuan ditetapkan ketika submit |
| assigned_mechanic_id | UUID | Ya | FK ke users.id, belum terisi sebelum assignment |
| start_date | TIMESTAMPTZ | Ya | Diisi saat start oleh Mechanic |
| end_date | TIMESTAMPTZ | Ya | Diisi Admin saat completion |
| created_at | TIMESTAMPTZ | Tidak | Default NOW() |
| updated_at | TIMESTAMPTZ | Tidak | Default NOW(), diperbarui saat update |

Status: DRAFT, SUBMITTED, ASSIGNED, WAITING_SPAREPART_APPROVAL, READY_TO_WORK,
WORKING, COMPLETED. Jika start_date dan end_date sama-sama terisi, end_date tidak
boleh lebih awal dari start_date. Service menentukan kapan tanggal wajib diisi.

## sparepart_requests - 8 kolom

| Kolom | Tipe | Nullable | Keterangan |
| --- | --- | --- | --- |
| id | UUID | Tidak | Primary key, otomatis dibuat |
| work_order_id | UUID | Tidak | FK ke work_orders.id |
| status | VARCHAR | Tidak | PENDING / APPROVED, default PENDING |
| requested_by | UUID | Tidak | FK ke users.id |
| approved_by | UUID | Ya | FK ke users.id, belum terisi sebelum approval |
| approval_note | TEXT | Ya | Catatan approval optional dari ERD |
| created_at | TIMESTAMPTZ | Tidak | Default NOW() |
| updated_at | TIMESTAMPTZ | Tidak | Default NOW(), diperbarui saat update |

work_order_id tidak unik; satu WO dapat memiliki beberapa request. Database
menjaga referensi user yang valid; service memastikan role pelaku sesuai Step 2.

## sparepart_items - 7 kolom

| Kolom | Tipe | Nullable | Keterangan |
| --- | --- | --- | --- |
| id | UUID | Tidak | Primary key, otomatis dibuat |
| sparepart_request_id | UUID | Tidak | FK ke sparepart_requests.id |
| name | VARCHAR | Tidak | Nama tidak boleh kosong setelah BTRIM |
| qty | INTEGER | Tidak | Harus lebih besar dari nol |
| image_path | TEXT | Ya | Storage key relatif foto JPG/PNG, bukan isi gambar |
| created_at | TIMESTAMPTZ | Tidak | Default NOW() |
| updated_at | TIMESTAMPTZ | Tidak | Default NOW(), diperbarui saat update |

Tidak ada kolom stok atau harga. Satu request dapat memiliki beberapa items.
Tanpa foto, image_path NULL. CHECK constraint membatasi storage key ke
spareparts/<UUID v4>.jpg atau .png. File disimpan pada volume upload backend;
detail kontrak ada di [Foto Opsional Sparepart](SPAREPART_PHOTOS.md).

## Foreign key dan indeks

Tujuh hubungan FK:

1. work_orders.created_by -> users.id.
2. work_orders.assigned_mechanic_id -> users.id.
3. sparepart_requests.work_order_id -> work_orders.id.
4. sparepart_requests.requested_by -> users.id.
5. sparepart_requests.approved_by -> users.id.
6. sparepart_items.sparepart_request_id -> sparepart_requests.id.
7. work_orders.assigned_spv_id -> users.id.

Setiap kolom FK memiliki indeks. Primary key memiliki indeks unik PostgreSQL.
ON DELETE RESTRICT menolak penghapusan data induk yang masih digunakan. Tidak
ditambahkan endpoint penghapusan.

Migration 003 mempertahankan status, judul, dan tanggal data existing. WO non-draft
diarahkan ke SPV existing hanya jika ada tepat satu SPV. Jika ada beberapa SPV,
migration tidak menebak pemilik: baris legacy tanpa assigned_spv_id hanya dapat
dibaca Admin sampai pemiliknya ditetapkan. Draft tetap tanpa SPV tujuan.
Pada data demo saat revisi diterapkan, dua DRAFT dan satu WORKING dipertahankan;
WORKING diarahkan ke SPV Demo. Kepemilikan baru ditetapkan service saat submit.

## Migration dan startup Docker

Migration berada di backend/migrations; runner berada di
backend/src/database/setup/migrate.ts. Runner menggunakan fasilitas transaksi
Step 3. Semua migration yang belum diterapkan dijalankan dalam satu transaksi.

Tabel _schema_migrations menyimpan filename, checksum SHA-256, dan applied_at.
Migration yang sudah tercatat dilewati jika checksum sesuai. File yang sudah
diterapkan tidak boleh diubah/dihapus; perubahan berikutnya memakai file migration
baru. Line ending CRLF dinormalisasi ke LF saat menghitung checksum.

Advisory transaction lock mencegah dua proses migration berjalan bersamaan.
Kegagalan menerapkan migration membatalkan perubahan dalam transaksi tersebut.
Script tidak menghapus atau mengganti tabel/data yang sudah ada.

Saat backend container dimulai, docker-entrypoint.sh menjalankan migration dan
seed sebelum memulai HTTP server. Proses ini bekerja pada volume baru maupun
volume existing, tanpa bergantung pada docker-entrypoint-initdb.d.

## Seed user demo

| ID | Nama | Role |
| --- | --- | --- |
| 00000000-0000-4000-8000-000000000001 | Admin Demo | ADMIN |
| 00000000-0000-4000-8000-000000000002 | SPV Demo | SPV |
| 00000000-0000-4000-8000-000000000003 | Mechanic Demo | MECHANIC |

Seed hanya menambahkan ID yang belum ada. User existing tidak ditimpa, termasuk
nama yang telah diubah. Jika ID demo sudah dipakai oleh role berbeda, seed gagal
dan transaksi seed dibatalkan. Tidak dibuat data WO/request/item contoh.

## Perintah setup

Dengan Docker, dari root project:

```powershell
docker compose up --build
```

Untuk mengulang setup di backend container yang sedang berjalan:

```powershell
docker compose exec backend node dist/database/setup/cli.js setup
```

Untuk setup melalui Node.js lokal, jalankan PostgreSQL dan npm ci terlebih dulu.
Dari folder backend, dengan konfigurasi PG yang sesuai:

```powershell
npm run db:setup
```

Tersedia juga npm run db:migrate dan npm run db:seed untuk masing-masing operasi.
Script npm tersebut melakukan build sebelum menjalankan CLI. Di runtime container,
gunakan node dist/database/setup/cli.js dengan argumen migrate, seed, atau setup
karena dependency compiler tidak dipasang pada image runtime.

## Verifikasi baseline database

Hasil berikut mencatat tahap sebelum authentication. Hasil terbaru: 59 integrasi
backend dan dua health lulus; lihat [Authentication](AUTHENTICATION.md).

- Dua test health API dan 15 test integrasi database berhasil.
- Test schema memakai namespace step4_test_<UUID> yang dibersihkan setelah test;
  tidak memodifikasi tabel bisnis dalam public.
- Test mencakup setup awal/ulang/bersamaan, checksum, rollback migration gagal,
  field nullable/default, enam FK, nilai role/status, qty, dan urutan tanggal.
- Database existing telah berisi empat tabel bisnis dan satu tabel metadata.
- Seed menghasilkan tiga user; setup ulang menghasilkan nol migration/user baru.
- Backend container berhasil membaca schema dan user melalui pg.
- Tidak ada data bisnis pengujian atau schema test tertinggal di database aplikasi.
- DBeaver menampilkan tabel melalui Tempopress Local -> Databases -> tempopress
  -> Schemas -> public -> Tables.
- Health backend dan proxy frontend mengembalikan HTTP 200; tiga service healthy.

Jalankan npm run test:database dari folder backend untuk mengulang test integrasi.
Step 5 menambahkan 16 test workflow HTTP dengan PostgreSQL asli, sehingga suite
database/API pada Step 5 berisi 31 test. Tambahan foto membawa suite integrasi
menjadi 44 test, termasuk upgrade item existing tanpa foto. Pembatasan penugasan
SPV menambah enam test menjadi 50 test integrasi, termasuk migrasi data legacy
dan isolasi akses antar pengguna. Tiga migration sudah diterapkan pada database
aplikasi. Verifikasi revisi ini mempertahankan tiga user demo dan tiga WO milik
pengguna; tidak menambah data bisnis pengujian pada schema public.
Kontrak API ada pada [API Work Order](API.md).
