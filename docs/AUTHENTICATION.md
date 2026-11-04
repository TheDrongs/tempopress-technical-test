# Authentication dan Pagination

Revisi 4 November 2026 setelah baseline Step 8. Authentication merupakan bonus
yang dipilih pada technical test; mekanisme selector identitas sebelumnya sudah
diganti dengan login session. Revisi lanjutan dan hasil pengujian terbaru ada di [HARDENING.md](HARDENING.md).

## Akun demo

| Role | Username | Password |
| --- | --- | --- |
| ADMIN | admin | admin123 |
| SPV | spv | spv123 |
| MECHANIC | mekanik | mekanik123 |

Migration dan seed berjalan otomatis pada startup Docker. Untuk proses Node lokal,
jalankan `npm run db:setup` dari backend setelah PostgreSQL berjalan. Kredensial
di atas khusus akun demo; password tersimpan sebagai hash scrypt dengan salt acak.
Seed yang diulang tidak menimpa kredensial akun yang telah dikustomisasi.

## Alur dan kontrak

1. POST /api/auth/login memverifikasi username/password dan menerbitkan session.
2. Cookie `tempopress_session` memakai HttpOnly, SameSite=Lax, Path=/api, dan batas
   delapan jam. Token acak 256-bit hanya diberikan ke browser melalui cookie;
   database menyimpan SHA-256 token, bukan token mentah.
3. Guard memeriksa token, expiry, dan user database untuk semua API bisnis.
   X-User-Id tidak digunakan untuk menentukan user/role. Role diperiksa ulang
   dari database, dan aturan status/penugasan tetap berlaku pada service.
4. GET /api/auth/me memulihkan identitas saat halaman dimuat ulang.
5. POST /api/auth/logout mencabut session terkait dan menghapus cookie.

| Endpoint | Akses | Hasil |
| --- | --- | --- |
| POST /api/auth/login | Public; username/password wajib | 200, user summary dan cookie |
| POST /api/auth/switch | Session valid; username/password/expectedRole | 200, session diganti setelah validasi |
| GET /api/auth/me | Session valid | 200, id/name/role |
| POST /api/auth/logout | Session valid | 204, cookie dihapus |
| GET /api/health | Public | 200 atau 503 |
| users, WO, approval, gambar sparepart | Session valid | Aturan role/penugasan tetap diterapkan |

Login salah dan session hilang/tidak valid/kedaluwarsa menghasilkan 401.
Request mutasi dari Origin yang berbeda atau Sec-Fetch-Site cross-site ditolak
403. Vite mempertahankan Host; Nginx meneruskan Host termasuk port agar pengecekan
Origin bekerja melalui kedua proxy. API privat dan gambar memakai Cache-Control
no-store. Foto hanya dapat dibaca oleh akun yang boleh membaca WO induknya.

Default cookie Secure=false sesuai localhost HTTP. Untuk penggunaan melalui
HTTPS, set AUTH_COOKIE_SECURE=true pada environment. Konfigurasi Compose menerima
nilai tersebut dari .env; backend lokal memakai environment proses.

## Frontend

- Route /login berisi username/password dan informasi akun demo.
- Route WO memerlukan session; tujuan detail dipulihkan setelah login dan tetap
  diperiksa backend. Dropdown role membuka popup login. Password salah/cancel mempertahankan session lama;
  login berhasil mengganti session secara transaksional dan membuka panel role baru.
- Header menampilkan nama, role, dan tombol Keluar. Sidebar mengikuti role akun.
- Axios mengirim cookie same-origin; password/token tidak disimpan di localStorage
  atau Zustand. Respons 401 mengembalikan pengguna ke login.
- Logout/expiry membatalkan request aktif dan membersihkan cache WO. Respons lama
  tidak boleh memulihkan data akun sebelumnya.

## Database dan struktur kode

Migration 004 menambah kredensial/session; migration 005 memutakhirkan identifier
menjadi username dan akun demo yang diketahui. Migration sebelumnya tidak diubah.
Data WO/request/item serta ID, nama, dan role user existing dipertahankan.

Empat tabel bisnis tetap ada dengan total 33 kolom; auth_sessions adalah tabel
teknis session dengan lima kolom. Bersama _schema_migrations terdapat enam tabel
dan delapan foreign key. Login baru membersihkan session yang sudah kedaluwarsa.

Backend: src/modules/auth berisi controller, dto/login.dto, AuthService, AuthGuard,
AuthRepository, implementasi PostgreSQL, serta utility password. HTTP controller
mengelola cookie; service menangani verifikasi/session; repository menjalankan SQL.
ActiveUser mengambil user yang sudah diverifikasi guard. Frontend memakai
src/auth/LoginPage, api/auth.api, dan stores/user.store.

## Pagination

Tabel semua role memakai pagination frontend dari daftar yang sudah difilter API:

- Default lima baris; pilihan 5, 10, atau 20 data per halaman.
- Indikator Page X of Y dan tombol halaman sebelumnya/berikutnya.
- Ukuran halaman dan pergantian akun kembali ke halaman pertama.
- Halaman kosong tetap Page 1 of 1; tombol navigasi dinonaktifkan sesuai batas.
- Perubahan jumlah data menjepit halaman ke batas yang valid.
- Ringkasan tugas dan total pekerjaan menghitung seluruh daftar yang boleh
  dibaca, bukan hanya baris pada halaman aktif.

## Verifikasi revisi

Build dan lint frontend/backend berhasil. Baseline authentication: 85 automated test lulus. Setelah hardening: **96**;
lihat [laporan terbaru](HARDENING.md). Rincian baseline:

| Suite | Test lulus |
| --- | --- |
| Health API | 2 |
| Integrasi database/API: transaksi, schema, workflow, foto, penugasan, auth | 59 |
| Unit frontend | 13 |
| Browser: login, expiry, pagination, kedua workflow, validasi, dan visibilitas | 11 |

Pemeriksaan terpisah melalui UI Docker dan API asli menyelesaikan dua WO,
satu tanpa sparepart dan satu dengan foto serta approval SPV. Ketiga role login
menggunakan akun demo di atas; 13 aksi workflow berhasil. Session dan gambar
terproteksi diperiksa langsung dan melalui proxy. Pagination diuji dengan 13 WO
untuk ketiga role, termasuk ukuran 5/10/20 dan viewport mobile. Tidak ada error
JavaScript halaman.

Setelah ketiga container pengujian dibuat ulang, seluruh record termasuk session
dan hash foto identik; cookie yang sudah diterbitkan tetap valid. Snapshot data
utama sebelum/sesudah migration menunjukkan empat WO, dua request, dua item,
serta identitas tiga user tidak berubah. Credential seed merupakan perubahan
yang disengaja. Data WO tambahan hanya ada di Compose pengujian terpisah.

Ketiga akun juga berhasil login/logout dan memulihkan session setelah refresh
melalui Vite development di localhost:5173, tanpa menulis data WO. Environment
Compose pengujian dibersihkan setelah verifikasi selesai.
