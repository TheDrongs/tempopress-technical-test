# API Work Order - Step 5

Base URL langsung: http://localhost:3000/api.
Melalui proxy frontend Docker: http://localhost:5173/api.

## Authentication dan identitas pelaku

POST /auth/login menerima username/password dan menerbitkan cookie HttpOnly.
GET /auth/me mengembalikan user login; POST /auth/logout mencabut session (204).
GET /health dan POST /auth/login bersifat public. Endpoint lain memerlukan cookie
session yang valid; X-User-Id diabaikan sebagai sumber identitas. Role dan
penugasan diperiksa menggunakan user dari database. Foto mengikuti akses WO induk.
Rincian dan akun demo: [Authentication](AUTHENTICATION.md).

| Nama | Role | ID |
| --- | --- | --- |
| Admin Demo | ADMIN | 00000000-0000-4000-8000-000000000001 |
| SPV Demo | SPV | 00000000-0000-4000-8000-000000000002 |
| Mechanic Demo | MECHANIC | 00000000-0000-4000-8000-000000000003 |

## Konvensi

- Request dan response menggunakan camelCase; kolom SQL tetap snake_case.
- ID menggunakan UUID. Tanggal response berupa ISO 8601.
- Body JSON memakai Content-Type: application/json.
- Pengajuan sparepart juga menerima multipart/form-data untuk foto opsional.
- DTO menjalankan validasi runtime. Field body yang tidak dikenal ditolak.
- Title dan nama sparepart di-trim dan tidak boleh kosong.
- Qty harus JSON number berupa integer 1 sampai 2147483647 (kapasitas INTEGER
  PostgreSQL), bukan string angka.
- Description dan approvalNote optional dan dapat bernilai null.
- Status, createdBy, requestedBy, approvedBy, ID, dan timestamp ditentukan backend.
- Start menggunakan URL dan session tanpa body. Submit menerima spvId opsional
  pada demo dengan satu SPV; jika beberapa SPV tersedia, spvId wajib dipilih.

## Endpoint

| Method | Path relatif /api | Pelaku | Status awal WO | HTTP sukses |
| --- | --- | --- | --- | --- |
| GET | /users | User login | - | 200 |
| GET | /work-orders | User aktif valid | Semua | 200 |
| GET | /work-orders/:id | User aktif valid | Semua | 200 |
| GET | /sparepart-items/:id/image | User login dengan akses WO | Semua | 200 |
| POST | /work-orders | ADMIN | - | 201 |
| POST | /work-orders/:id/submit | ADMIN | DRAFT | 200 |
| POST | /work-orders/:id/assign | SPV tujuan WO | SUBMITTED | 200 |
| POST | /work-orders/:id/update | ADMIN | ASSIGNED | 200 |
| POST | /work-orders/:id/request-sparepart | ADMIN | ASSIGNED | 201 |
| POST | /sparepart-requests/:id/approve | SPV tujuan WO | WAITING_SPAREPART_APPROVAL | 200 |
| POST | /work-orders/:id/start | MECHANIC yang ditugaskan | READY_TO_WORK | 200 |
| POST | /work-orders/:id/complete | ADMIN | WORKING | 200 |

GET /health tetap tersedia dan memeriksa PostgreSQL dengan SELECT 1.

## 1. Data user dan Work Order

GET /users mengembalikan array user dengan id, name, role. Frontend dapat memakai
daftar tersebut untuk selector dan memfilter role MECHANIC untuk assignment.

GET /work-orders mengembalikan array WO, diurutkan createdAt terbaru lalu ID.
Revisi pengguna 4 November 2026 membatasi list dan detail berdasarkan penugasan:
Admin melihat semua WO; SPV hanya melihat non-draft dengan assignedSpvId miliknya;
Mechanic hanya melihat non-draft dengan assignedMechanicId miliknya. DRAFT tidak
terlihat oleh SPV/Mechanic. Detail yang tidak berhak dibaca mengembalikan 404,
termasuk bila URL/UUID diketahui. Filter list dijalankan dalam query PostgreSQL.

GET /work-orders/:id mengembalikan data WO beserta:
- createdByUser: ringkasan pembuat (id, name, role).
- assignedMechanic: ringkasan mechanic atau null.
- assignedSpv: ringkasan SPV tujuan atau null. assignedSpvId ada pada list/detail.
- sparepartRequests: daftar pengajuan beserta items, requestedByUser, approvedByUser.

## 2. Create

POST /work-orders, pelaku ADMIN:

```json
{
  "title": "Perbaikan rem",
  "description": "Rem belakang kurang responsif"
}
```

Response adalah WO dengan status DRAFT, createdBy sesuai pelaku, serta
assignedMechanicId/startDate/endDate yang belum terisi. Description optional.

## 3. Submit

POST /work-orders/:id/submit, pelaku ADMIN. DRAFT berubah menjadi SUBMITTED dan
assignedSpvId ditetapkan. Body dapat berisi { "spvId": "<UUID SPV>" }. Jika body
kosong dan ada tepat satu SPV, backend memilih SPV tersebut. Jika tidak ada SPV
atau tersedia beberapa pilihan, body kosong ditolak 400. ID bukan SPV ditolak
400, UUID tidak ditemukan 404. Response adalah WO yang telah diperbarui.

## 4. Assign

POST /work-orders/:id/assign, pelaku SPV:

```json
{
  "mechanicId": "00000000-0000-4000-8000-000000000003"
}
```

User tujuan harus ada dan ber-role MECHANIC. Status menjadi ASSIGNED; startDate
belum diisi.
Hanya assignedSpvId yang dapat melakukan assignment atau approval terkait;
SPV lain ditolak 403. Status dan kepemilikan diperiksa di dalam transaksi/kunci WO.

## 5. Persiapan Admin tanpa sparepart

POST /work-orders/:id/update, pelaku ADMIN:

```json
{
  "title": "Perbaikan rem - hasil peninjauan",
  "description": "Dapat dikerjakan tanpa sparepart"
}
```

Title/description optional. Body {} berarti Admin mengonfirmasi informasi yang
sudah ada. Description null mengosongkan deskripsi. Status menjadi READY_TO_WORK.

## 6. Persiapan Admin dengan sparepart

POST /work-orders/:id/request-sparepart, pelaku ADMIN:

```json
{
  "title": "Perbaikan rem - penggantian kampas",
  "description": "Perlu penggantian sparepart",
  "items": [
    { "name": "Kampas rem", "qty": 2 },
    { "name": "Minyak rem", "qty": 1 }
  ]
}
```

Title/description optional, items wajib berupa array minimal satu item. Dalam
satu transaksi, backend menyimpan update WO, request PENDING dengan requestedBy
pelaku, seluruh items, dan status WO WAITING_SPAREPART_APPROVAL.

Response berbentuk:

```text
{
  workOrder: <WO yang diperbarui>,
  sparepartRequest: <pengajuan lengkap beserta items dan ringkasan user>
}
```

Frontend memilih satu endpoint persiapan sesuai keputusan sparepart. Tidak perlu
memanggil /update lebih dahulu pada jalur sparepart, karena /request-sparepart
juga menyelesaikan update lanjutan. Field needsSparepart dari DTO kerangka awal
tidak menjadi field kontrak API final; keputusan direpresentasikan oleh endpoint.

Pembuatan request menyelesaikan persiapan awal dari ASSIGNED. Relasi database
tetap satu WO ke banyak request, dan approval memeriksa semua request terkait.

Tambahan foto opsional: setiap item pada response memiliki imagePath dan imageUrl,
atau null jika tanpa foto. Input JSON lama tetap valid. Upload foto menggunakan
multipart items JSON dan field photos.<photoKey>; foto tidak dapat diubah setelah
submit. Kontrak lengkap, batas file, contoh PowerShell, dan endpoint gambar ada
di [Foto Opsional Sparepart](SPAREPART_PHOTOS.md).

## 7. Approval

POST /sparepart-requests/:id/approve, pelaku SPV:

```json
{ "approvalNote": "Disetujui untuk perbaikan" }
```

Body {} juga valid. Request harus PENDING dan WO harus menunggu approval.
Request berubah menjadi APPROVED, approvedBy diisi ID SPV. Jika seluruh request
terkait telah disetujui, WO menjadi READY_TO_WORK; jika masih ada PENDING, WO tetap
menunggu. Response berisi workOrder dan sparepartRequest seperti operasi create.

## 8. Start

POST /work-orders/:id/start, pelaku MECHANIC yang ditugaskan. READY_TO_WORK berubah
menjadi WORKING. Start date diisi waktu sistem. Response adalah WO yang diperbarui.

## 9. Complete

POST /work-orders/:id/complete, pelaku ADMIN:

```json
{ "endDate": "2026-11-03T14:30:00+07:00" }
```

End date wajib ISO 8601 dengan timezone (Z atau offset), harus valid, dan tidak
lebih awal dari startDate. Status menjadi COMPLETED. Response adalah WO yang
diperbarui. Progres tidak dapat dijalankan ulang setelah selesai.

## Error

| HTTP | Makna |
| --- | --- |
| 400 | UUID/input tidak valid; user tujuan assignment bukan mechanic; end date lebih awal dari start |
| 401 | Session hilang, tidak valid, kedaluwarsa, atau login gagal |
| 403 | Role pelaku salah atau mechanic bukan yang ditugaskan |
| 404 | User aktif, WO, mechanic tujuan, atau request tidak ditemukan |
| 409 | Status tidak sesuai atau aksi telah dilakukan |
| 500 | Kegagalan internal; rincian SQL tidak dikirim ke response |
| 503 | PostgreSQL tidak tersedia pada endpoint health |

Error validasi/operasi bisnis memakai format standar NestJS:

```json
{
  "message": "This action requires Work Order status DRAFT.",
  "error": "Conflict",
  "statusCode": 409
}
```

Untuk error validasi DTO, message dapat berupa array. Health memiliki response
sendiri sebagaimana dijelaskan README.

## Transaksi dan request bersamaan

Service mengoordinasikan transaksi menggunakan TRANSACTION_MANAGER. Repository
memakai SELECT FOR UPDATE pada WO terkait sebelum memeriksa/mengubah status.
Seluruh aksi progres dan approval menggunakan kunci WO yang sama. Approval
membaca ulang request setelah kunci diperoleh.

Dua request aksi yang sama menghasilkan satu keberhasilan dan satu konflik,
bukan dua pemrosesan. Kegagalan menyimpan items membatalkan perubahan WO dan
pengajuan dalam transaksi yang sama.

## Mencoba dari PowerShell

```powershell
$api = 'http://localhost:3000/api'
Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body '{"username":"admin","password":"admin123"}' -SessionVariable admin
Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body '{"username":"spv","password":"spv123"}' -SessionVariable spv
Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body '{"username":"mekanik","password":"mekanik123"}' -SessionVariable mechanic

Invoke-RestMethod "$api/users" -WebSession $admin
$wo = Invoke-RestMethod "$api/work-orders" -Method Post -WebSession $admin -ContentType 'application/json' -Body '{"title":"Perbaikan rem"}'
Invoke-RestMethod "$api/work-orders/$($wo.id)/submit" -Method Post -WebSession $admin
Invoke-RestMethod "$api/work-orders/$($wo.id)/assign" -Method Post -WebSession $spv -ContentType 'application/json' -Body '{"mechanicId":"00000000-0000-4000-8000-000000000003"}'
Invoke-RestMethod "$api/work-orders/$($wo.id)/update" -Method Post -WebSession $admin -ContentType 'application/json' -Body '{}'
Invoke-RestMethod "$api/work-orders/$($wo.id)/start" -Method Post -WebSession $mechanic
$completion = @{ endDate = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json
Invoke-RestMethod "$api/work-orders/$($wo.id)/complete" -Method Post -WebSession $admin -ContentType 'application/json' -Body $completion
Invoke-RestMethod "$api/work-orders/$($wo.id)" -WebSession $admin
```

Untuk jalur sparepart, pada WO baru yang telah di-assign, ganti langkah /update
dengan /request-sparepart menggunakan body items. Simpan sparepartRequest.id dari
response, lakukan approval memakai session SPV, lalu jalankan start dan complete.

## Pengujian

Dari backend, npm test menjalankan dua test health. npm run test:database
menjalankan 65 test integrasi (5 transaksi, 13 schema/setup, 17 workflow HTTP,
14 foto, 4 visibilitas/ownership, dan 12 authentication). Frontend memiliki 16 unit
test dan 13 test browser terpisah;
lihat [Frontend Work Order](FRONTEND.md).

Test workflow memakai PostgreSQL asli pada schema step5_test_<UUID>, dengan
konfigurasi validasi HTTP yang sama seperti production. Schema dihapus setelah
test; data bisnis dalam public tidak dipakai sebagai fixture pengujian.

## Revisi batas input dan pergantian akun

Judul WO maksimal 50 karakter, deskripsi 100, nama sparepart 30, dan catatan
persetujuan 100. Batas berlaku pada JSON/multipart; pelanggaran menghasilkan 400.

POST /api/auth/switch membutuhkan cookie session aktif dan body:

```json
{"username":"spv","password":"spv123","expectedRole":"SPV"}
```

Sukses menghasilkan 200, user summary, dan cookie baru; token lama dicabut dalam
transaksi yang sama. Kredensial salah (401) atau role tujuan tidak sesuai (403)
tidak mencabut session lama. expectedRole hanya ADMIN, SPV, atau MECHANIC.
Lihat [Hardening](HARDENING.md).
