# Database

PostgreSQL 17, database default `tempopress`, schema `public`, driver `pg`.
Schema final memiliki empat tabel bisnis (33 kolom) dan dua tabel teknis.
ID memakai UUID; waktu memakai TIMESTAMPTZ. `created_at`/`updated_at` default NOW()
saat insert, dan repository memperbarui `updated_at` saat update.

## Tabel dan kolom

| Tabel | Kolom | Fungsi |
| --- | --- | --- |
| `users` | id, name, role, created_at, updated_at, username, password_hash | Akun, role, dan kredensial (7 kolom) |
| `work_orders` | id, title, description, status, created_by, assigned_spv_id, assigned_mechanic_id, start_date, end_date, created_at, updated_at | Informasi serta progres WO (11 kolom) |
| `sparepart_requests` | id, work_order_id, status, requested_by, approved_by, approval_note, created_at, updated_at | Pengajuan dan persetujuan (8 kolom) |
| `sparepart_items` | id, sparepart_request_id, name, qty, image_path, created_at, updated_at | Item pengajuan dan referensi foto opsional (7 kolom) |
| `auth_sessions` | id, user_id, token_hash, created_at, expires_at | Session login (5 kolom) |
| `_schema_migrations` | filename, checksum, applied_at | Riwayat penerapan migration |

Teks nama/judul memakai VARCHAR atau TEXT, deskripsi/catatan/path/kredensial TEXT,
qty INTEGER, dan relasi UUID. Detail tipe/constraint dapat dilihat langsung pada
[migration SQL](../backend/migrations/001_create_work_order_schema.sql).

## Relasi dan integritas

- `users` → `work_orders`: pembuat, SPV tujuan, dan mechanic yang ditugaskan.
- `work_orders` → `sparepart_requests`: satu WO dapat memiliki beberapa pengajuan.
  Flow demo membuat pengajuan ketika persiapan ASSIGNED.
- `users` → `sparepart_requests`: pemohon dan pemberi approval.
- `sparepart_requests` → `sparepart_items`: satu pengajuan memiliki beberapa item.
- `users` → `auth_sessions`: satu akun dapat memiliki beberapa session.

Total delapan FK. Kolom FK diindeks; parent bisnis yang masih dirujuk dilindungi
`ON DELETE RESTRICT`. Session memakai `ON DELETE CASCADE` terhadap user.
Username unik dan lowercase; nama/role tidak unik. Role: ADMIN/SPV/MECHANIC.

Status WO: DRAFT, SUBMITTED, ASSIGNED, WAITING_SPAREPART_APPROVAL, READY_TO_WORK,
WORKING, COMPLETED. Request: PENDING/APPROVED. CHECK membatasi role/status,
judul/nama nonkosong, qty > 0, dan end_date ≥ start_date jika kedua tanggal terisi.
Aturan siapa yang boleh memproses serta perpindahan status ditegakkan service.

Deskripsi, SPV/mechanic sebelum penugasan, tanggal sebelum tahap terkait,
approved_by/approval_note sebelum approval, dan image_path tanpa foto dapat NULL.
Username/password_hash nullable untuk akun legacy tanpa login; akun demo memiliki
kredensial. Hash tidak dikirim API; token session hanya disimpan sebagai SHA-256.

## Foto sparepart (opsional)

Foto adalah tambahan pendukung UX/review, bukan syarat pengajuan. Kolom nullable
`sparepart_items.image_path` menyimpan storage key seperti `spareparts/<UUID v4>.png`
atau `.jpg`, bukan bytes gambar. Tanpa foto nilainya NULL; data lama tetap valid.
CHECK membatasi format storage key dan backend menentukan nama file.

File berada pada volume Docker `sparepart_uploads`, dipasang ke `/app/uploads`
di backend; gambar berada di subfolder `spareparts/`. Tidak ada service storage
tambahan: Compose tetap database, backend, dan frontend. Di mode Node lokal,
default direktori `uploads` relatif working directory; ubah melalui
`UPLOADS_DIRECTORY`. Backend lokal tidak memuat `.env` otomatis.

Foto opsional satu JPG/PNG per item, maksimal 2 MiB dan 10 foto per pengajuan.
Kontrak upload, re-encode, dan akses terproteksi ada di
[backend](backend.md#foto-sparepart-opsional).
Database dan filesystem tidak berbagi transaksi; error biasa ditangani cleanup,
sedangkan crash mendadak dapat memerlukan rekonsiliasi manual.

## Migration dan seed

| Migration | Perubahan |
| --- | --- |
| `001_create_work_order_schema.sql` | Empat tabel bisnis, relasi, indeks, constraint |
| `002_add_sparepart_item_image.sql` | Path foto opsional pada item |
| `003_add_work_order_supervisor.sql` | SPV tujuan WO |
| `004_add_authentication.sql` | Kredensial dan session |
| `005_use_demo_usernames.sql` | Identifier username dan penyesuaian akun demo |

Runner memakai satu transaksi untuk migration pending dan advisory lock untuk
startup bersamaan. Checksum SHA-256 dicatat; line ending dinormalisasi. Migration
yang sudah diterapkan tidak diubah/dihapus; perubahan memakai file baru.
Startup backend Docker menjalankan migration dan seed sebelum HTTP server.

Seed menambah akun yang belum ada tanpa menimpa akun yang sudah dikustomisasi.
Jika ID demo sudah dipakai role berbeda, seed gagal dan transaksi dibatalkan.
Tidak ada seed WO/request/item sehingga daftar awal kosong.
Migration SPV hanya mengaitkan WO legacy otomatis jika ada tepat satu SPV;
WO legacy tanpa penerima tetap hanya terlihat Admin.

## Seed user demo

| Role | ID | Username / password |
| --- | --- | --- |
| Admin | `00000000-0000-4000-8000-000000000001` | `admin` / `admin123` |
| SPV | `00000000-0000-4000-8000-000000000002` | `spv` / `spv123` |
| Mechanic | `00000000-0000-4000-8000-000000000003` | `mekanik` / `mekanik123` |

Password di-hash scrypt. Detail session dan role switch ada di
[authentication](authentication.md).

## Menjalankan dan persistensi

Docker: `docker compose up --build` dari root. Setup ulang container:
`docker compose exec backend node dist/database/setup/cli.js setup`.
Lokal dari `backend/`: `npm run db:setup`; operasi terpisah tersedia sebagai
`npm run db:migrate` dan `npm run db:seed`.

Default DBeaver: host `localhost`, port `5432`, database/user `tempopress`,
password `tempopress_local`. Nilai dapat diubah melalui konfigurasi PG/Compose.
Database aplikasi berada pada named volume `postgres_data`; foto pada
`sparepart_uploads`. `docker compose down` mempertahankan data, sedangkan
`docker compose down -v` menghapus volume. Backup mencakup kedua volume secara
konsisten; dump database saja tidak menyertakan gambar.
