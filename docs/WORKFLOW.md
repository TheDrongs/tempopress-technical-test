# Workflow dan Rencana Arsitektur Work Order

Tambahan 4 November 2026: foto opsional per item sparepart diminta setelah Step 5.
Rinciannya dicatat pada bagian tambahan di akhir dokumen dan
[Foto Opsional Sparepart](SPAREPART_PHOTOS.md). Aturan/status workflow Step 2 tetap.

## Step 2 - Workflow dan Aturan Bisnis

Disetujui pada 3 November 2026. Keputusan step 2 ini menjadi acuan implementasi
database, backend, frontend, dan dokumentasi asumsi. Backend workflow telah
diimplementasikan pada Step 5; fitur frontend dikerjakan pada tahap berikutnya.

### Role dan tanggung jawab

| Role | Aksi |
| --- | --- |
| ADMIN | Membuat, submit, update lanjutan, dan menyelesaikan WO dengan end date |
| SPV | Menugaskan Mechanic dan menyetujui Sparepart Request |
| MECHANIC | Menandai WO sebagai Working |

### Status Work Order

| Status | Makna |
| --- | --- |
| DRAFT | WO dibuat tetapi belum disubmit |
| SUBMITTED | WO disubmit dan menunggu assignment |
| ASSIGNED | Mechanic ditentukan; menunggu persiapan lanjutan Admin |
| WAITING_SPAREPART_APPROVAL | Pengajuan sparepart dibuat dan menunggu persetujuan |
| READY_TO_WORK | Persiapan selesai dan pekerjaan boleh dimulai |
| WORKING | Pekerjaan dimulai oleh Mechanic |
| COMPLETED | Pekerjaan ditutup Admin dengan end date |

Status WO menyatakan tahap proses dan tidak diganti dengan kolom `is_finished`.
Jika diperlukan pada tampilan, `isFinished` dihitung dari status COMPLETED.

### Perpindahan status

| Status awal | Aksi | Pelaku | Status berikutnya |
| --- | --- | --- | --- |
| Belum ada WO | Membuat WO | ADMIN | DRAFT |
| DRAFT | Submit | ADMIN | SUBMITTED |
| SUBMITTED | Assign Mechanic | SPV | ASSIGNED |
| ASSIGNED | Menyelesaikan persiapan tanpa sparepart | ADMIN | READY_TO_WORK |
| ASSIGNED | Menyelesaikan persiapan dengan pengajuan sparepart | ADMIN | WAITING_SPAREPART_APPROVAL |
| WAITING_SPAREPART_APPROVAL | Persyaratan approval terpenuhi | SPV | READY_TO_WORK |
| READY_TO_WORK | Mulai bekerja | MECHANIC yang ditugaskan | WORKING |
| WORKING | Completion dengan end date | ADMIN | COMPLETED |

### Aturan tiap tahap

1. **Create:** Admin mengisi title dan description (optional). WO tersimpan sebagai
   DRAFT; created_by berisi ID Admin. Mechanic, start date, dan end date belum perlu
   terisi. Pembuatan dan submit adalah dua aksi terpisah.
2. **Submit:** Admin mengubah DRAFT menjadi SUBMITTED. WO yang sudah melewati tahap
   ini tidak disubmit ulang; identitas pembuat tetap sama.
3. **Assign:** SPV memilih user ber-role MECHANIC untuk WO SUBMITTED.
   assigned_mechanic_id terisi dan status menjadi ASSIGNED. Assignment belum
   berarti pekerjaan dimulai.
4. **Update lanjutan:** Admin meninjau atau memperbarui title/description setelah
   assignment, lalu menyelesaikan keputusan kebutuhan sparepart. Tidak ditambahkan
   informasi fleet, breakdown time, atau field tambahan dari mockup.
5. **Tanpa sparepart:** persiapan selesai dan WO menjadi READY_TO_WORK tanpa request.
6. **Dengan sparepart:** Admin membuat request beserta nama dan jumlah items.
   Request berstatus PENDING dengan requested_by terisi; approved_by belum terisi.
   WO menjadi WAITING_SPAREPART_APPROVAL setelah pengajuan berhasil disimpan.
7. **Approval:** SPV menyetujui request PENDING menjadi APPROVED dan mengisi
   approved_by. WO menjadi READY_TO_WORK ketika persyaratan approval terpenuhi.
   Jika masih ada request terkait yang PENDING, WO tetap menunggu. Status request
   terpisah dari status WO. Tidak ditambahkan rejection, revisi approval, atau
   penerimaan barang.
8. **Start:** hanya Mechanic yang ditugaskan dapat memulai WO READY_TO_WORK.
   Aksi mengisi start_date dan mengubah status menjadi WORKING. WO yang menunggu
   approval belum boleh dimulai.
9. **Complete:** Admin memasukkan end_date pada WO WORKING. End date wajib diisi
   dan tidak lebih awal dari start date. Status menjadi COMPLETED dan aksi progres
   berikutnya dikunci. Tidak ditambahkan reopen atau pembatalan WO.

### Asumsi implementasi yang disepakati

- Nama dan makna tujuh status WO di atas.
- Update lanjutan berarti peninjauan/perubahan title/description dan penyelesaian
  keputusan kebutuhan sparepart setelah assignment.
- Admin membuat Sparepart Request.
- Hanya Mechanic yang ditugaskan dapat melakukan start.
- Start date diisi saat Mechanic memulai pekerjaan.
- End date divalidasi terhadap start date; progres dikunci setelah completion.

Backend menegakkan aturan tersebut; frontend menampilkan aksi berdasarkan role
dan status. Kontrak API dan detail penyimpanan dipetakan pada tahap berikutnya.

## Step 3 - Struktur Backend dan Light Clean Architecture

Dicatat pada 3 November 2026. Status: **kerangka kode sudah diimplementasikan**.
Struktur ini mengikuti workflow Step 2 dan menjadi acuan pekerjaan database pada
Step 4 serta implementasi fitur backend pada Step 5. Modul, tipe, DTO awal, kontrak
repository, provider, dan fasilitas transaksi sudah tersedia. Endpoint bisnis,
validasi runtime DTO, query bisnis, dan aturan workflow dilengkapi pada Step 5.

### 3.1. Bentuk arsitektur

- Backend berupa satu aplikasi NestJS dengan pembagian modul berdasarkan fitur
  (modular monolith).
- Setiap fitur memisahkan HTTP layer, business logic, dan persistence sesuai
  Light Clean Architecture.
- Alur pemanggilan: controller -> service/use case -> repository -> PostgreSQL.
- Service bergantung pada repository interface. Implementasi PostgreSQL memenuhi
  interface tersebut dan dihubungkan melalui dependency injection NestJS.
- Frontend tetap aplikasi React yang mengakses backend melalui REST API.

### 3.2. Struktur kerangka folder dan file

Tree ini mencatat fondasi Step 3; setup database dan helper API ditambahkan pada
Step 4 dan Step 5 sebagaimana dijelaskan pada bagian masing-masing.

```text
backend/
|-- src/
|   |-- database/
|   |   |-- database.module.ts
|   |   |-- database.pool.ts
|   |   |-- database.service.ts
|   |   `-- transaction-manager.ts
|   |-- modules/
|   |   |-- users/
|   |   |   |-- users.module.ts
|   |   |   |-- users.controller.ts
|   |   |   |-- users.service.ts
|   |   |   |-- user.types.ts
|   |   |   `-- repositories/
|   |   |       |-- user.repository.ts
|   |   |       `-- pg-user.repository.ts
|   |   |-- work-orders/
|   |   |   |-- work-orders.module.ts
|   |   |   |-- work-orders.controller.ts
|   |   |   |-- work-orders.service.ts
|   |   |   |-- work-order.types.ts
|   |   |   |-- dto/
|   |   |   |   |-- create-work-order.dto.ts
|   |   |   |   |-- assign-mechanic.dto.ts
|   |   |   |   |-- update-work-order.dto.ts
|   |   |   |   `-- complete-work-order.dto.ts
|   |   |   `-- repositories/
|   |   |       |-- work-order.repository.ts
|   |   |       `-- pg-work-order.repository.ts
|   |   `-- sparepart-requests/
|   |       |-- sparepart-requests.module.ts
|   |       |-- sparepart-requests.controller.ts
|   |       |-- sparepart-requests.service.ts
|   |       |-- sparepart-request.types.ts
|   |       |-- dto/
|   |       |   |-- create-sparepart-request.dto.ts
|   |       |   |-- sparepart-item.dto.ts
|   |       |   `-- approve-sparepart-request.dto.ts
|   |       `-- repositories/
|   |           |-- sparepart-request.repository.ts
|   |           `-- pg-sparepart-request.repository.ts
|   |-- app.module.ts
|   |-- app.controller.ts
|   |-- app.service.ts
|   `-- main.ts
|-- test/
|   |-- app.e2e-spec.ts
|   `-- database.integration-spec.ts
`-- vitest.config.database.ts
```

### 3.3. Pembagian tanggung jawab modul

| Modul | Tanggung jawab |
| --- | --- |
| users | Mengambil data pengguna, role, dan mechanic untuk kebutuhan aplikasi |
| work-orders | Mengelola WO dari create, submit, assignment, update lanjutan, start, sampai completion |
| sparepart-requests | Mengelola pengajuan beserta items dan approval SPV |
| database | Menyediakan connection pool, pemeriksaan koneksi, dan fasilitas transaksi PostgreSQL |

Sparepart items dikelola sebagai bagian dari pengajuan, sehingga tidak membutuhkan
modul bisnis tersendiri. Modul users mendukung kebutuhan identitas pelaku dan
assignment; tidak menambahkan registrasi, login, atau CRUD pengelolaan akun.

### 3.4. DTO dan validasi input

DTO (Data Transfer Object) mendefinisikan bentuk data pada batas HTTP. DTO input
diletakkan dalam folder `dto/` milik fitur yang menggunakannya.

| File | Class | Kegunaan |
| --- | --- | --- |
| work-orders/dto/create-work-order.dto.ts | CreateWorkOrderDto | Input pembuatan WO: title dan description optional |
| work-orders/dto/assign-mechanic.dto.ts | AssignMechanicDto | Input ID mechanic yang akan ditugaskan |
| work-orders/dto/update-work-order.dto.ts | UpdateWorkOrderDto | Input update lanjutan dan penyelesaian persiapan Admin sesuai Step 2 |
| work-orders/dto/complete-work-order.dto.ts | CompleteWorkOrderDto | Input end date untuk completion |
| sparepart-requests/dto/create-sparepart-request.dto.ts | CreateSparepartRequestDto | Input pengajuan beserta daftar items |
| sparepart-requests/dto/sparepart-item.dto.ts | SparepartItemDto | Input nama dan jumlah setiap item pengajuan |
| sparepart-requests/dto/approve-sparepart-request.dto.ts | ApproveSparepartRequestDto | Input approval note jika digunakan; catatan boleh kosong |

- Daftar items pada CreateSparepartRequestDto menggunakan SparepartItemDto.
- Bentuk payload final dipetakan pada [kontrak API Step 5](API.md), mengikuti Step 2.
- Submit dan start tidak membutuhkan DTO body kosong apabila seluruh inputnya
  berasal dari ID pada URL dan identitas pelaku.
- Modul users belum memerlukan DTO input untuk create/update user karena fitur
  tersebut tidak termasuk scope yang sedang dikerjakan.
- Deklarasi tipe/class saja tidak memvalidasi request secara otomatis. Step 5
  mengaktifkan ValidationPipe, class-validator, dan class-transformer pada HTTP layer.
- Pemeriksaan bentuk input (teks, UUID, format tanggal, nama dan qty item) berada
  pada HTTP layer. Pemeriksaan role, keberadaan data, status, penugasan, dan urutan
  workflow berada pada service.
- Client tidak menentukan status, pembuat, atau pemberi approval secara bebas
  melalui DTO aksi. Nilai tersebut ditentukan dari operasi dan identitas pelaku.

### 3.5. Controller sebagai HTTP layer

Controller menerima request, mengambil parameter URL dan identitas pelaku,
menggunakan DTO untuk input, memanggil service, lalu mengembalikan response HTTP.

Contoh assignment:

1. WorkOrdersController menerima ID WO dan AssignMechanicDto.
2. Controller meneruskan data beserta identitas pelaku ke WorkOrdersService.
3. Service menjalankan aturan assignment dan mengembalikan hasil.
4. Controller mengembalikan hasil tersebut sebagai response.

Controller tidak menulis SQL atau memutuskan perpindahan status. Identitas aktif
berlaku per request; tidak disimpan sebagai satu user aktif global pada backend.
Step 5 memakai X-User-Id dan mengambil role dari database untuk selector tanpa login.

### 3.6. Service/use case sebagai business layer

Rencana awal menggunakan satu service utama per fitur. Service berisi operasi
bisnis; tidak perlu membuat class use case terpisah untuk setiap aksi pada scope ini.

| Service | Operasi utama |
| --- | --- |
| UsersService | Menyediakan data user dan mechanic yang diperlukan aplikasi |
| WorkOrdersService | List/detail, create, submit, assign, update lanjutan, start, complete |
| SparepartRequestsService | Membuat pengajuan beserta items dan melakukan approval |

Service memeriksa role pelaku, keberadaan data, status awal, dan aturan Step 2;
kemudian menggunakan repository untuk membaca atau mengubah data. Contohnya,
assignment memerlukan pelaku SPV, WO SUBMITTED, dan user tujuan ber-role MECHANIC.

Operasi persiapan Admin menghubungkan update lanjutan dengan keputusan sparepart
sesuai Step 2. Pemisahan endpoint tidak boleh memungkinkan workflow tersebut
dilewati. Detail kontrak dan koordinasi operasinya diselesaikan pada Step 5.

### 3.7. Repository interface sebagai kontrak persistence

| Interface | Lokasi | Data yang ditangani |
| --- | --- | --- |
| UserRepository | users/repositories/user.repository.ts | Users dan role |
| WorkOrderRepository | work-orders/repositories/work-order.repository.ts | Work Orders |
| SparepartRequestRepository | sparepart-requests/repositories/sparepart-request.repository.ts | Requests beserta items |

Interface mendefinisikan operasi yang dibutuhkan service, misalnya findById,
findAll, create, atau update. Method final mengikuti kebutuhan fitur. Kontrak
menggunakan tipe data internal aplikasi dan tidak bergantung pada DTO HTTP atau
tipe connection pool milik driver PostgreSQL.

### 3.8. Repository implementation dan akses database

| Kontrak | Implementasi |
| --- | --- |
| UserRepository | PgUserRepository |
| WorkOrderRepository | PgWorkOrderRepository |
| SparepartRequestRepository | PgSparepartRequestRepository |

Implementasi menggunakan driver `pg` yang sudah tersedia. ORM tambahan tidak
direncanakan untuk scope ini. Repository menulis parameterized SQL, menjalankan
query melalui fasilitas database, dan memetakan baris database menjadi tipe
internal aplikasi. SQL bisnis tidak berada di controller atau service.

### 3.9. Module dan dependency injection

- File module mendaftarkan controller, service, dan provider fitur.
- Karena interface TypeScript tidak tersedia saat runtime, repository memakai
  injection token seperti USER_REPOSITORY, WORK_ORDER_REPOSITORY, dan
  SPAREPART_REQUEST_REPOSITORY.
- Token dan interface didefinisikan bersama kontrak repository terkait.
- Provider NestJS memetakan token tersebut ke implementasi PostgreSQL.
- Modul mengekspor kontrak/provider yang dibutuhkan fitur lain. Dependency
  antarmodul disusun satu arah agar service tidak saling bergantung melingkar.

Contoh: WorkOrdersService menerima WORK_ORDER_REPOSITORY; WorkOrdersModule
menyediakan PgWorkOrderRepository sebagai implementasinya.

### 3.10. Transaksi lintas perubahan terkait

Service mengatur satu operasi bisnis, sedangkan fasilitas database dan repository
menjalankan seluruh query terkait pada koneksi transaksi yang sama.

Operasi pembuatan pengajuan mencakup:

1. Menyimpan request.
2. Menyimpan seluruh items.
3. Memperbarui WO menjadi WAITING_SPAREPART_APPROVAL.

Operasi approval mencakup:

1. Memperbarui request menjadi APPROVED dan mengisi approved_by.
2. Memeriksa apakah persyaratan approval terpenuhi.
3. Memperbarui status WO bila sudah siap dikerjakan.

Perubahan dalam satu operasi harus berhasil bersama atau di-rollback bersama.
Fasilitas transaksi harus meneruskan konteks transaksi ke implementasi repository
yang terlibat tanpa mewajibkan service menangani PoolClient PostgreSQL. Koneksi
dikembalikan ke pool setelah transaksi selesai atau gagal.

Implementasi memakai AsyncLocalStorage untuk meneruskan konteks koneksi melalui
pemanggilan asynchronous. Service dapat menerima token TRANSACTION_MANAGER yang
memiliki kontrak withTransaction; tipe PoolClient hanya digunakan pada fasilitas
database. Nested transaction ditolak secara eksplisit. Seluruh operasi di dalam
callback transaksi harus di-await; konteks yang sudah ditutup menolak query baru.
Transaksi yang telah dibatalkan PostgreSQL tidak dilaporkan sebagai commit sukses.

### 3.11. Tipe internal dan integrasi dengan scaffold

- user.types.ts mendefinisikan bentuk User dan nilai role.
- work-order.types.ts mendefinisikan bentuk Work Order dan tujuh status Step 2.
- sparepart-request.types.ts mendefinisikan Request, Item, serta PENDING/APPROVED.
- DTO menyatakan input aksi; tipe internal menyatakan data yang digunakan service
  dan repository. Keduanya tidak harus memiliki field yang sama.
- AppModule memasang modul bisnis yang baru.
- AppController dan AppService yang sekarang menangani health tetap dapat
  digunakan untuk fungsi health.
- DatabaseModule dan DatabaseService yang sudah ada dikembangkan untuk kebutuhan
  akses data dan transaksi sambil mempertahankan health check PostgreSQL.

### 3.12. Checklist hasil Step 3

Dokumentasi rencana:

- [x] Bentuk modular monolith dengan Light Clean dijelaskan.
- [x] Struktur fitur, DTO, tipe internal, dan repository dirinci.
- [x] Batas controller, service, repository, dan database ditetapkan dalam rencana.
- [x] Driver pg, dependency injection, dan kebutuhan transaksi dicatat.

Implementasi kerangka:

- [x] Membuat modul bisnis dan struktur file yang diperlukan.
- [x] Membuat tipe internal dan kontrak repository.
- [x] Memasang provider dan dependency antarmodul.
- [x] Menyediakan fasilitas transaksi untuk repository.
- [x] Mengintegrasikan kerangka dengan AppModule dan memastikan health tetap bekerja.

Class repository PostgreSQL sudah terpasang sebagai provider. Kerangka awalnya
telah dilengkapi query, endpoint bisnis, dan validasi DTO melalui Step 5.
Kontrak payload final dicatat pada API.md.

Verifikasi: build dan lint backend, dua test health API yang juga memuat seluruh
modul melalui AppModule, serta lima test transaksi terhadap PostgreSQL asli.
Test integrasi menggunakan tabel TEMP yang dihapus saat koneksi ditutup sehingga
tidak membuat tabel bisnis sebelum Step 4. Jalankan npm run test:database dari
folder backend dengan service PostgreSQL berjalan untuk mengulang test transaksi.

Pembuatan tabel dilakukan pada Step 4. DTO dan operasi bisnis dilengkapi bersama
kontrak API serta fitur backend pada Step 5. Frontend dikerjakan pada tahapnya.

## Step 4 - Struktur Database dan Data Awal

Diimplementasikan pada 3 November 2026. Status: **selesai dan terverifikasi**.
Schema lengkap, jenis kolom, nullable, constraint, relasi, dan perintah setup
dicatat pada [Database Work Order](DATABASE.md). Source pembentukan tabel ada di
backend/migrations/001_create_work_order_schema.sql.

### 4.1. Aturan umum

- Database tetap tempopress pada PostgreSQL 17, menggunakan schema public.
- Empat tabel bisnis memiliki total 29 kolom mengikuti ERD.
- ID UUID otomatis menggunakan gen_random_uuid().
- Timestamp memakai TIMESTAMPTZ. created_at dan updated_at terisi NOW() saat insert.
- Query update pada Step 5 harus memperbarui updated_at; tidak ada trigger otomatis.
- Field optional boleh NULL. Status dan role dibatasi CHECK constraint.

### 4.2. Tabel users

Kolom: id, name, role, created_at, updated_at. Nilai role adalah ADMIN, SPV, dan
MECHANIC. Nama tidak boleh kosong. Nama dan role tidak unik, sehingga beberapa
user dapat memiliki nama/role yang sama. Tidak ditambahkan email atau password.

### 4.3. Tabel work_orders

Kolom: id, title, description, status, created_by, assigned_mechanic_id, start_date,
end_date, created_at, updated_at. Title tidak boleh kosong. Default status DRAFT,
dengan tujuh nilai mengikuti Step 2. Description, mechanic, start date, dan end
date boleh NULL. Jika kedua tanggal terisi, end date tidak lebih awal dari start.

### 4.4. Tabel sparepart_requests

Kolom: id, work_order_id, status, requested_by, approved_by, approval_note,
created_at, updated_at. Status PENDING/APPROVED dengan default PENDING.
Approved_by dan approval_note boleh NULL. Work_order_id tidak unik agar hubungan
satu WO ke beberapa pengajuan tetap tersedia sesuai ERD.

### 4.5. Tabel sparepart_items

Kolom: id, sparepart_request_id, name, qty, created_at, updated_at. Nama tidak
boleh kosong; qty adalah INTEGER lebih besar dari nol. Tidak ditambahkan stok
atau harga.

### 4.6. Relasi, constraint, dan indeks

Enam FK menghubungkan pembuat/mechanic WO, WO milik request, pemohon/pemberi
approval, dan items milik request. Setiap FK memiliki indeks. ON DELETE RESTRICT
melindungi data induk yang masih dirujuk. Database memeriksa keberadaan referensi;
role pelaku dan perpindahan status ditegakkan oleh service pada Step 5.

### 4.7. Migration

- SQL versioned dijalankan melalui backend/src/database/setup/migrate.ts.
- Semua migration pending menggunakan satu transaksi dan advisory lock.
- Tabel teknis _schema_migrations menyimpan filename, checksum SHA-256, applied_at.
  Tabel ini bukan tambahan entity bisnis.
- Migration yang telah diterapkan dilewati; checksum berbeda atau file yang
  dihapus ditolak. Perubahan berikutnya menggunakan file migration baru.
- Kegagalan migration di-rollback; tabel/data existing tidak diganti atau dihapus.
- Perintah lokal: npm run db:migrate. npm run db:setup menjalankan migration dan seed.
- Startup Docker menerapkan setup sebelum HTTP server, termasuk pada volume existing.

### 4.8. Seed user demo

Tiga user tersedia: Admin Demo (ADMIN), SPV Demo (SPV), Mechanic Demo (MECHANIC).
Masing-masing memiliki UUID tetap, tercatat di DATABASE.md. Seed menambahkan ID
yang belum ada tanpa menimpa data existing. ID demo yang dipakai role berbeda
menyebabkan transaksi seed gagal. Perintah lokal: npm run db:seed.

### 4.9. Verifikasi

- [x] Empat tabel bisnis dibuat dengan 29 kolom sesuai desain.
- [x] UUID, timestamp, default, nullable, dan enam FK diverifikasi.
- [x] Nilai role/status, title/nama kosong, qty, dan urutan tanggal diperiksa.
- [x] Penghapusan parent yang masih dirujuk ditolak.
- [x] Migration dan seed ulang tidak menggandakan data.
- [x] Setup bersamaan dan rollback saat migration gagal diuji.
- [x] User demo tersedia dan terbaca dari container backend melalui pg.
- [x] DBeaver menampilkan tabel pada Tempopress Local -> Databases -> tempopress
  -> Schemas -> public -> Tables.
- [x] Build/lint backend, dua test health API, dan 15 test integrasi database lolos.
- [x] Ketiga service Docker healthy; health langsung dan melalui frontend HTTP 200.

Test memakai tabel TEMP atau schema step4_test_<UUID> yang dibersihkan sesudahnya.
Database aplikasi tidak berisi data WO/request/item pengujian atau sisa schema test.

### 4.10. Dokumentasi dan batas hasil

- [x] README utama dan backend diperbarui untuk setup lokal/Docker.
- [x] Dokumentasi schema dan user demo disimpan pada DATABASE.md.
- [x] Workflow ini mencatat implementasi dan hasil pemeriksaan Step 4.

Tabel dan seed siap dipakai. Query repository, validasi DTO, endpoint, dan aturan
bisnis diimplementasikan pada Step 5 di bawah. Selector/tampilan masuk tahap frontend.

## Step 5 - Repository, Validasi, dan API Workflow

Diimplementasikan pada 3 November 2026. Status: **selesai dan terverifikasi**.
Kontrak lengkap, payload, response, error, dan contoh PowerShell tersedia pada
[API Work Order - Step 5](API.md).

### 5.1. Identitas pelaku

Semua endpoint WO dan approval memakai header X-User-Id. ActiveUserPipe memeriksa
UUID dan mengambil user beserta role dari database. Identitas berlaku per request.
GET /api/users dan /api/health tidak memerlukan header. Ini simulasi identitas
tanpa authentication; frontend nantinya memilih user dan meneruskan ID tersebut.

### 5.2. Query repository

Provider PostgreSQL sekarang mengimplementasikan pembacaan user, WO, request,
dan items; insert; update; serta pemeriksaan request pending. SQL menggunakan
parameter. Kolom SQL dipetakan ke camelCase, timestamp update diperbarui, dan
service tidak menulis SQL. Detail WO memakai proyeksi baca pengajuan/items
bersama tanpa dependency melingkar antarservice.

### 5.3. Data selector, list, dan detail

GET /api/users menyediakan id/name/role. GET /api/work-orders menyediakan daftar
WO. GET /api/work-orders/:id menyediakan detail beserta ringkasan pembuat,
mechanic, request/items, pemohon, dan pemberi approval. Seluruh role valid dapat
melihat daftar/detail karena requirement tidak membatasi pembacaan per pembuat.

### 5.4. Create dan submit

Admin membuat WO DRAFT dengan title, description optional, dan created_by sesuai
pelaku. Submit hanya menerima DRAFT dan menghasilkan SUBMITTED. Pembuatan
mengembalikan HTTP 201; submit HTTP 200. Field sistem tidak ditentukan client.

### 5.5. Assignment

SPV menugaskan user MECHANIC pada WO SUBMITTED. User tujuan harus ada dan
ber-role MECHANIC. Assigned_mechanic_id diisi, status ASSIGNED, start_date tetap
belum terisi.

### 5.6. Update lanjutan dan keputusan sparepart

Admin menyelesaikan persiapan dari ASSIGNED melalui satu dari dua endpoint:

- POST /api/work-orders/:id/update menyimpan peninjauan/perubahan title dan
  description, lalu menghasilkan READY_TO_WORK untuk jalur tanpa sparepart.
- POST /api/work-orders/:id/request-sparepart menerima title/description optional
  serta items wajib. Operasi menyimpan update WO, request/items, dan status
  WAITING_SPAREPART_APPROVAL dalam satu transaksi.

Frontend memilih endpoint berdasarkan keputusan sparepart. Jalur sparepart tidak
memanggil /update terlebih dahulu. NeedsSparepart pada DTO awal diganti pemetaan
endpoint final ini; tidak diperlukan field tambahan pada database.

### 5.7. Pengajuan sparepart

Request dibuat PENDING dengan requested_by sesuai Admin aktif dan minimal satu
item bernama tidak kosong serta qty integer positif. Semua perubahan persiapan,
request, dan items berhasil bersama atau di-rollback bersama. Response HTTP 201
berisi workOrder dan sparepartRequest lengkap.

### 5.8. Approval

SPV menyetujui request PENDING pada WO WAITING_SPAREPART_APPROVAL. Status menjadi
APPROVED, approved_by terisi, approval_note optional. Jika masih ada request
PENDING, WO tetap menunggu. Jika semua terpenuhi, WO menjadi READY_TO_WORK.
Approval dan perubahan WO berada dalam satu transaksi; response HTTP 200 berisi
workOrder dan sparepartRequest.

### 5.9. Start dan completion

Mechanic yang ditugaskan memulai WO READY_TO_WORK menjadi WORKING dengan
start_date waktu sistem. Admin menyelesaikan WORKING menjadi COMPLETED dengan
endDate ISO 8601 ber-timezone yang tidak lebih awal dari start_date. Progres
berulang dan perubahan tahap dari status yang tidak sesuai ditolak.

### 5.10. Validasi dan error

ConfigureApplication memasang validasi yang sama pada production dan test HTTP.
DTO memvalidasi tipe, UUID, nama/title, nested items, qty, dan tanggal. Field body
yang tidak dikenal ditolak. DTO HTTP terpisah dari tipe input internal service.

Error: 400 untuk input/header tidak valid; 403 untuk role atau mechanic pelaku
yang salah; 404 untuk data tidak ditemukan; 409 untuk konflik status/aksi ulang.
Kegagalan internal tidak mengirim rincian SQL dalam response.

### 5.11. Transaksi dan konkurensi

Service memakai TRANSACTION_MANAGER. Repository mengunci baris WO dengan
SELECT FOR UPDATE sebelum memeriksa/mengubah status. Semua progres dan approval
memakai urutan kunci WO yang sama; approval membaca ulang request sesudah kunci
diperoleh. Request bersamaan menghasilkan satu pemrosesan dan konflik bagi aksi
duplikat. Perubahan WO/request/items tetap atomik.

### 5.12. Endpoint final

| Method | Endpoint | Pelaku |
| --- | --- | --- |
| GET | /api/users | Tidak diperlukan |
| GET | /api/work-orders | User aktif valid |
| GET | /api/work-orders/:id | User aktif valid |
| POST | /api/work-orders | ADMIN |
| POST | /api/work-orders/:id/submit | ADMIN |
| POST | /api/work-orders/:id/assign | SPV |
| POST | /api/work-orders/:id/update | ADMIN |
| POST | /api/work-orders/:id/request-sparepart | ADMIN |
| POST | /api/sparepart-requests/:id/approve | SPV |
| POST | /api/work-orders/:id/start | MECHANIC yang ditugaskan |
| POST | /api/work-orders/:id/complete | ADMIN |

### 5.13. Checklist hasil

- [x] Repository menggunakan data PostgreSQL asli.
- [x] Daftar user, list WO, dan detail WO tersedia.
- [x] Workflow tanpa sparepart selesai sampai COMPLETED.
- [x] Workflow dengan sparepart selesai melalui approval sampai COMPLETED.
- [x] Role salah, mechanic berbeda, lompatan status, dan aksi berulang ditolak.
- [x] Validasi input, nested items, qty, UUID, dan tanggal teruji.
- [x] Kegagalan penyimpanan items membatalkan perubahan WO dan request.
- [x] Submit/start/pengajuan/approval bersamaan teruji.
- [x] Approval memeriksa seluruh pengajuan pending terkait.
- [x] Build/lint backend, dua test health, dan 31 test integrasi database/API lolos.
- [x] Docker build berhasil; tiga service healthy.
- [x] API langsung dan proxy frontend memverifikasi header, role, DTO, dan health.
- [x] Dokumentasi API dan README diperbarui.

Enam belas test workflow menggunakan HTTP NestJS dan PostgreSQL asli pada schema
step5_test_<UUID>. Schema test dibersihkan; database aplikasi tetap berisi tiga
user demo tanpa data WO/request/item pengujian. Pada akhir Step 5, frontend masih
halaman health; list/detail, form, dan selector kemudian diselesaikan di Step 6–7.

## Tambahan Foto Opsional - Poin 1–5

Diminta pengguna pada 4 November 2026. Ini tambahan terhadap requirement awal;
status dan perpindahan workflow Step 2 tetap berlaku. Foto melekat pada setiap
item pengajuan sparepart, bukan pada WO secara umum.

- [x] 1. Satu foto JPG/PNG opsional per item, maksimal 2 MiB dan 20 megapixel;
  maksimal 10 foto per request. Item tanpa foto tetap valid.
- [x] 2. Migration 002 menambah image_path nullable pada sparepart_items.
  Empat tabel bisnis memiliki total 30 kolom. Migration 001 tidak diubah.
- [x] 3. Named volume sparepart_uploads dipasang ke /app/uploads pada backend.
  Izin tulis disiapkan untuk user node; batas Nginx 22 MiB. Service tetap tiga.
- [x] 4. Endpoint pengajuan menerima multipart serta JSON tanpa foto. photoKey
  mencocokkan file ke item; isi file divalidasi dan di-encode ulang. Role/status,
  kunci baris, transaksi, dan cleanup saat gagal tetap diterapkan.
- [x] 5. GET /api/sparepart-items/:id/image menyajikan foto berdasarkan item UUID.
  Respons pengajuan/detail/approval menyertakan imagePath dan imageUrl atau null.
- [x] 6. UI upload, preview, ganti/hapus pilihan sebelum submit, dan Axios.
- [x] 7. Thumbnail dan viewer pada tampilan review SPV.

Build/lint backend, 44 test integrasi database/API, dan dua test health berhasil.
Upload PNG 1.773.461 byte melalui proxy Nginx berhasil, termasuk pengajuan campuran
foto/tanpa foto dan approval SPV. Container backend kemudian dibuat ulang;
hash gambar tetap sama melalui backend langsung dan proxy frontend. Volume
mempertahankan file. Ketiga service healthy setelah verifikasi.

Data dan file uji Docker sudah dibersihkan; database aplikasi kembali memiliki
tiga user demo dan nol WO/request/item. Tidak ada schema uji atau file foto uji
tertinggal. Kontrak dan batas konsistensi filesystem/database dicatat di
[Foto Opsional Sparepart](SPAREPART_PHOTOS.md).

## Step 6 - Frontend Work Order

Diimplementasikan pada 4 November 2026 menggunakan struktur feature folder yang
disepakati, Tailwind CSS, dan komponen lokal pola shadcn/ui dengan Radix Dialog.

- [x] App shell mint dengan logo perusahaan dan satu navigasi Work Order.
- [x] WorkOrderListPage dan WorkOrderDetailPage dalam folder work-orders.
- [x] Detail menjadi child route /work-orders/:id dan tampil sebagai modal.
- [x] Role selector dari user demo API, tanpa login.
- [x] Form create dan persiapan, status badge, serta tindakan per role/status.
- [x] Pengajuan items dengan satu foto opsional per item, ganti/hapus sebelum kirim.
- [x] Thumbnail review, placeholder tanpa foto, dan dialog preview besar.
- [x] Form assignment SPV, catatan approval, start mechanic, dan completion Admin.
- [x] Empty/loading/error/retry, feedback hasil, dan penanganan submit ganda.
- [x] Setelah setiap aksi sukses, detail blur dengan popup sesuai aksi; menutup
  popup melalui Tutup/X/Escape menutup kedua modal dan kembali ke list.
- [x] Validasi satu field: border merah, getaran, dan pesan di bawah field.
  Multi-field: seluruh border terkait merah, tanpa getaran, pesan umum saja.
- [x] Layout desktop/mobile, label form, focus trap, Escape, dan footer modal.

## Step 7 - Integrasi API dan State Frontend

- [x] Axios instance /api dan header X-User-Id eksplisit per operasi.
- [x] users.api, work-order.api, user.store, dan work-order.store dipisahkan.
- [x] State bersama memakai Zustand; form/File/preview memakai state React lokal.
- [x] Hanya ID pengguna pilihan yang dipersist di localStorage.
- [x] List/detail dimuat ulang setelah mutasi; respons lama dibatalkan/diabaikan.
- [x] Gagal refresh dipisahkan dari write yang sudah berhasil.
- [x] JSON tanpa foto dan multipart dengan photoKey per item terhubung ke API.
- [x] Waktu selesai lokal dikonversi ISO UTC dan tidak boleh sebelum startDate.
- [x] Delapan unit test dan sembilan test browser berhasil; build dan lint bersih.
- [x] Docker frontend dibangun ulang; ketiga service healthy.
- [x] Dua jalur sampai completed diverifikasi melalui UI Docker dan API asli.
- [x] Foto invalid mempertahankan form; foto valid, preview, approval, serta
  deep-link reload melalui Nginx berhasil.
- [x] Data/file verifikasi dibersihkan; kembali tiga user demo dan nol data bisnis.

Struktur, tanggung jawab komponen/state, dan cara mencoba UI dicatat di
[Frontend Work Order](FRONTEND.md). Test Playwright memakai fixture API terisolasi;
verifikasi API asli dilakukan terpisah melalui UI Docker.

## Revisi UI dan Akses Penugasan - 4 November 2026

Tambahan yang diminta pengguna setelah Step 6–7; workflow status tetap mengikuti
Step 2. Pemilihan user tetap simulasi tanpa login melalui X-User-Id.

- [x] Judul halaman mengikuti role: Work Orders - Admin/SPV/Mechanic Panel.
- [x] Panel informasi di atas tabel menghitung WO yang memerlukan perhatian
  pengguna aktif sesuai role, penugasan, dan status. Rincian memisahkan penugasan
  mechanic dan approval sparepart; panel tersembunyi jika tidak ada tugas.
- [x] Semua aksi sukses memakai popup yang sama di atas detail blur: create,
  submit, assign, persiapan dengan/tanpa sparepart, approval, start, dan complete.
- [x] Revisi footer detail: teks keterangan status, tujuan SPV tunggal, dan
  tombol Tutup dihapus. Divider serta tombol aksi tetap ada. Detail ditutup
  melalui ikon X atau Escape; selector tujuan tetap ada jika SPV lebih dari satu.
- [x] Migration 003 menambah assigned_spv_id; tetap empat tabel bisnis, 31 kolom.
  WO non-draft existing dihubungkan otomatis hanya jika terdapat tepat satu SPV.
- [x] Admin melihat semua WO. SPV hanya melihat WO yang dikirim kepadanya;
  Mechanic hanya melihat WO penugasannya. Draft tersembunyi untuk keduanya.
- [x] Filter diterapkan pada API list dan detail; detail di luar penugasan 404.
  Assignment dan approval SPV lain ditolak. Cache frontend dikosongkan saat
  pengguna berubah agar data pengguna sebelumnya tidak sempat ditampilkan.
- [x] Submit otomatis memilih SPV tunggal; jika lebih dari satu, Admin memilih
  SPV tujuan sebelum mengirim WO. API memvalidasi penerima tersebut.
- [x] 50 test integrasi database/API, delapan unit test frontend, dan sembilan
  test browser berhasil; build dan lint frontend/backend berhasil.
- [x] Verifikasi baca saja terhadap aplikasi aktual: Admin melihat tiga WO,
  SPV satu WO, Mechanic satu WO. Dua draft ditolak pada akses detail non-Admin.
  Tiga WO pengguna dipertahankan dan tidak ada request tulis pada verifikasi ini.

Verifikasi revisi penugasan di atas menggunakan frontend/backend development yang sudah berjalan
dan PostgreSQL pada Docker. Catatan tiga container healthy di atas merupakan
hasil verifikasi Docker pada tahap sebelumnya.

## Step 8 - Verifikasi Aplikasi Final

Selesai pada 4 November 2026. Laporan dan perintah ada di
[Verifikasi Aplikasi Final](VERIFICATION.md).

- [x] Build dan jalankan ketiga service terbaru melalui Docker Compose.
- [x] Setup pada volume kosong; migration dan seed otomatis, dapat diulang tanpa
  menggandakan data. Environment pengujian dipisahkan dari aplikasi utama.
- [x] Health backend langsung/proxy dan akses localhost berhasil.
- [x] Dua jalur workflow sampai COMPLETED melalui UI Docker dengan API asli.
- [x] Popup sukses, validasi input, role/penugasan, serta tahap yang salah teruji.
- [x] Upload campuran foto/tanpa foto, preview, approval, dan rollback foto invalid.
- [x] Data tetap tampil setelah reload dan deep link; desktop/mobile diperiksa.
- [x] Data PostgreSQL dan hash foto identik setelah ketiga container dibuat ulang.
- [x] 50 test integrasi backend, dua test health, 12 unit frontend, dan sembilan
  test browser lulus; build dan lint kedua aplikasi berhasil.
- [x] Review pemisahan HTTP/business/persistence dan cakupan requirement selesai.
- [x] Data aplikasi utama identik sebelum/sesudah; environment pengujian dibersihkan.

Pada baseline Step 8 ini, Step 9 belum dijalankan; status final diperbarui pada
bagian Step 9 di akhir dokumen. Log approval/proses masih usulan, bukan fitur yang sudah dibuat.

## Revisi Authentication dan Pagination - 4 November 2026

Authentication bonus dipilih setelah Step 8; pada tahap ini paket ditahan selama
revisi. Kontrak: [Authentication dan Pagination](AUTHENTICATION.md).

- [x] Login username/password dengan akun admin/admin123, spv/spv123, dan
  mekanik/mekanik123. Password di-hash scrypt.
- [x] Session PostgreSQL, cookie HttpOnly, pemulihan saat refresh, expiry, logout.
- [x] API privat dan gambar memakai identitas session; X-User-Id tidak menentukan
  pelaku. Pembatasan role, penugasan, dan status tetap berlaku.
- [x] Cache/reset request saat logout/expiry; header identitas dan warna per role.
- [x] Pagination semua role: 5/10/20, Page X of Y, navigasi, reset dan batas halaman.
- [x] Migration/seed mempertahankan empat WO utama beserta request dan item.
- [x] Build/lint, 59 integrasi backend, dua health, 13 unit frontend, 11 browser lulus.
- [x] Kedua jalur UI Docker dengan login asli dan persistensi session/foto teruji.

## Review Security Input - 4 November 2026

- [x] Audit query parameterized, DTO/whitelist, rendering JSX, dan validasi gambar.
- [x] Tes SQLi dan stored XSS terarah melalui UI/API Docker pada database terpisah.
- [x] Payload tampil sebagai teks/data; tidak ada eksekusi JavaScript atau SQL
  injeksi pada jalur yang diuji. Data utama tetap utuh.
- [x] Laporan [Security Review](SECURITY_REVIEW.md) mencatat hasil dan batas audit.
- [x] CSP Nginx serta batas field 50/100/30/100 dan counter UI diterapkan; lihat HARDENING.md.

## Step 9 — Paket penyerahan final

- [x] README memuat cara menjalankan, tech stack, asumsi, struktur, dan akun demo.
- [x] Revisi batas field/counter dan popup role switch selesai. Login gagal atau
  cancel mempertahankan session lama; sukses mengganti session secara transaksional.
- [x] Build/lint dan 96 automated test lulus; kedua workflow UI Docker terverifikasi.
- [x] ZIP source memuat backend, frontend, dokumentasi, Compose, serta env example.
- [x] Dependency lokal, build, env privat, upload, data/session, dan tmp tidak dipaketkan.
- [x] ZIP diekstrak ke folder baru; Docker Compose membangun dan menjalankan tiga
  service sehat. Lima migration, tiga login demo, health, CSP, dan logout teruji.
- [x] Project/volume tes dibersihkan dan snapshot data utama identik.

ZIP disiapkan untuk
dikirim oleh kandidat; tidak dikirim ke pihak lain dari workspace ini.
