# Backend

NestJS + TypeScript dengan driver PostgreSQL `pg`. Backend berupa modular monolith
dengan Light Clean Architecture: controller → service → repository → PostgreSQL.

## Struktur dan aturan lapisan

```text
backend/src/
├── common/validation/             # Trim dan batas teks
├── database/                      # Pool, transaksi, migration, dan seed
├── modules/
│   ├── auth/                      # Login, session, guard, dan pergantian akun
│   ├── users/                     # Data user untuk penugasan
│   ├── work-orders/               # List/detail dan progres WO
│   └── sparepart-requests/        # Pengajuan, approval, items, dan foto
├── configure-app.ts               # Global ValidationPipe
├── app.module.ts
└── main.ts
```

Controller mengurus HTTP/DTO; service mengatur role, status, penugasan, dan transaksi.
Repository interface dihubungkan ke implementasi PostgreSQL melalui injection token.
SQL parameterized dan pemetaan snake_case → camelCase berada di repository.
DTO input berada dalam `dto/` milik fitur dan terpisah dari tipe internal.

`TRANSACTION_MANAGER.withTransaction` meneruskan koneksi melalui AsyncLocalStorage.
Operasi progres/approval mengunci baris WO dengan `SELECT FOR UPDATE` sebelum
memeriksa status. Perubahan WO, request, dan items di-commit/rollback bersama;
aksi duplikat bersamaan tidak diproses dua kali. Nested transaction ditolak dan
seluruh operasi dalam callback harus di-await.

## Kontrak API

Base URL: `http://localhost:3000/api`; proxy frontend: `http://localhost:5173/api`.
Body/response camelCase, ID UUID, dan tanggal response ISO 8601.
Health dan login bersifat public; API bisnis memerlukan session. Identitas/status/
timestamp sistem ditentukan backend, bukan header `X-User-Id` atau field client.

| Method | Path relatif `/api` | Akses dan input utama |
| --- | --- | --- |
| GET | `/health` | Public; `SELECT 1`, 200 connected atau 503 unavailable |
| GET | `/users` | User login; ringkasan id/name/role untuk penugasan |
| GET | `/work-orders` | User login; daftar sesuai akses, terbaru dahulu |
| GET | `/work-orders/:id` | User login dengan akses WO; metadata, user terkait, request/items |
| POST | `/work-orders` | Admin; `title`, `description` opsional → DRAFT (201) |
| POST | `/work-orders/:id/submit` | Admin/DRAFT; `spvId` opsional jika hanya satu SPV → SUBMITTED |
| POST | `/work-orders/:id/assign` | SPV tujuan/SUBMITTED; `mechanicId` → ASSIGNED |
| POST | `/work-orders/:id/update` | Admin/ASSIGNED; `title`/`description` opsional → READY_TO_WORK |
| POST | `/work-orders/:id/request-sparepart` | Admin/ASSIGNED; `items` wajib, judul/deskripsi opsional → menunggu approval (201) |
| POST | `/sparepart-requests/:id/approve` | SPV tujuan; `approvalNote` opsional → request APPROVED |
| POST | `/work-orders/:id/start` | Mechanic yang ditugaskan/READY_TO_WORK → WORKING, waktu server |
| POST | `/work-orders/:id/complete` | Admin/WORKING; `endDate` ber-timezone dan ≥ startDate → COMPLETED |
| GET | `/sparepart-items/:id/image` | User login dengan akses WO induk; JPG/PNG |

Mutasi sukses selain create WO/pengajuan menghasilkan 200. Body `{}` valid untuk
persiapan tanpa perubahan informasi dan approval tanpa catatan. Jalur sparepart
langsung memanggil `/request-sparepart`, tanpa memanggil `/update` lebih dahulu.
Response pengajuan/approval berbentuk `{ workOrder, sparepartRequest }`.
Detail mencakup `createdByUser`, `assignedSpv`, `assignedMechanic`, dan
`sparepartRequests` beserta items/pemohon/pemberi approval.

Contoh pengajuan tanpa foto:

```json
{
  "items": [
    { "name": "Kampas rem", "qty": 2 },
    { "name": "Minyak rem", "qty": 1 }
  ]
}
```

Minimal satu item; qty berupa JSON integer 1–2147483647. Title/nama di-trim dan
tidak boleh kosong. Deskripsi/catatan opsional dapat bernilai null. Batas karakter:
judul 50, deskripsi 100, nama sparepart 30, catatan 100. Field tak dikenal ditolak.

## Foto sparepart (opsional)

Tambahan UX untuk membantu validasi visual SPV; pengajuan tanpa foto tetap valid.
Satu foto JPG/PNG per item, maksimal 2 MiB, 20 megapixel, satu frame, dan maksimal
10 foto per pengajuan. Batas request Nginx 22 MiB termasuk multipart.

Endpoint pengajuan yang sama menerima `multipart/form-data`:

| Field | Isi |
| --- | --- |
| `title`, `description` | Teks opsional dengan aturan DTO yang sama |
| `items` | String JSON array, misalnya `[{"name":"Kampas rem","qty":2,"photoKey":"pad-1"}]` |
| `photos.pad-1` | File untuk item dengan `photoKey` yang sesuai |

`photoKey` unik, 1–64 karakter huruf/angka/underscore/minus, dengan tepat satu
file pasangan. Urutan file tidak menentukan pasangan. Client tidak mengirim
`imagePath`/`imageUrl`; browser/Axios menentukan multipart boundary.

Backend memeriksa isi gambar dengan sharp, melakukan re-encode, dan menghapus
metadata. File disimpan setelah validasi dan pemeriksaan status; kegagalan biasa
membersihkan file yang telah ditulis. Filesystem dan database bukan satu transaksi:
penghentian paksa proses dapat memerlukan rekonsiliasi file.

Response item memuat `imagePath` relatif serta
`imageUrl: /api/sparepart-items/<UUID item>/image`; keduanya null tanpa foto.
Pembacaan berdasarkan UUID item dan akses WO, bukan path bebas dari client.
Tidak ada endpoint penggantian/penghapusan foto setelah submit.
Penyimpanan dan volume dijelaskan di [database](database.md#foto-sparepart-opsional).

## Error dan operasional

400: input tidak valid; 401: session/login tidak valid; 403: role/penugasan aksi
salah; 404: data tidak ada atau detail/foto di luar akses; 409: status/aksi ulang;
413: batas upload; 500: kegagalan internal tanpa rincian SQL; 503: health database gagal.
Error bisnis memakai `statusCode`, `message`, `error`; pesan DTO dapat berupa array.

Jalankan database, lalu dari `backend/`: `npm ci`, `npm run db:setup`,
`npm run start:dev`. Docker menjalankan setup sebelum server secara otomatis.
Konfigurasi koneksi: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`.
Lihat [README](../README.md#menjalankan-service) untuk startup lengkap.

Build/lint: `npm run build`, `npm run lint`; health test: `npm test`;
integrasi PostgreSQL: `npm run test:database`. Suite backend mencakup 2 health dan
65 integrasi pada TEMP/schema terisolasi yang dibersihkan setelah test.
Kontrak session ada di [authentication](authentication.md), kontrol input di
[security](security.md), dan alur bisnis di [workflow](workflow.md).
