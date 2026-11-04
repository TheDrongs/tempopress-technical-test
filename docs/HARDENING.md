# Hardening dan pergantian akun — 4 November 2026

Laporan ini memperbarui baseline pada AUTHENTICATION.md, SECURITY_REVIEW.md,
dan VERIFICATION.md. Implementasi serta pengujian revisi telah selesai.

## Batas input

| Field | Maksimum karakter |
| --- | ---: |
| Judul WO | 50 |
| Deskripsi WO (create dan update) | 100 |
| Nama sparepart | 30 |
| Catatan persetujuan | 100 |

Frontend membatasi input, menampilkan jumlah karakter, dan memberikan validasi
field. Backend memvalidasi DTO untuk JSON maupun multipart. Penghitungan Unicode
frontend mengikuti validator backend. Data existing tidak dipotong dan tidak
memerlukan migration baru.

## Pergantian akun

Dropdown role berada di bawah username. Memilih role membuka popup login dengan
username demo terkait dan password kosong. Membatalkan popup, password salah,
atau kredensial yang tidak sesuai role tujuan mempertahankan session lama.

POST /api/auth/switch membutuhkan session aktif serta username, password, dan
expectedRole (ADMIN/SPV/MECHANIC). Backend memverifikasi kredensial dan role aktual
sebelum mengganti session. Pencabutan token lama dan penyimpanan token baru berada
dalam satu transaksi: kegagalan penyimpanan mengembalikan transaksi, dan dua
permintaan switch bersamaan tidak dapat menggunakan session lama yang sama.

Setelah sukses, cookie diganti, cache WO dibersihkan, dan panel role baru dibuka.
Respons 401 dari request akun lama tidak menghapus session akun baru. Token dan
password tidak disimpan dalam localStorage.

## Content Security Policy

Nginx mengirim CSP pada respons frontend Docker: script hanya dari origin sendiri,
inline script/handler dan eval diblokir, object/frame embedding dibatasi, serta
API dan form tetap satu origin. Preview foto blob/data diizinkan. Inline style
diizinkan untuk komponen Radix. X-Content-Type-Options: nosniff juga dikirim.

Konfigurasi ini berlaku pada build production melalui Docker/Nginx. Server Vite
development tetap menggunakan konfigurasi HMR dan tidak mengirim CSP production.

## Verifikasi

Build serta lint backend/frontend lulus. Total **96 automated test** lulus:

| Suite | Jumlah |
| --- | ---: |
| Health API | 2 |
| Integrasi PostgreSQL/API | 65 |
| Unit frontend | 16 |
| Browser | 13 |

Integrasi mencakup batas input JSON/multipart, pergantian akun gagal/sukses,
rollback, dan concurrency. Browser mencakup counter serta popup pergantian akun.

Pemeriksaan tambahan melalui UI Docker dan API asli menyelesaikan dua jalur WO
(tanpa sparepart dan dengan foto/approval), total 13 aksi workflow. Cookie lama
tetap berlaku setelah cancel/password salah/role salah dan ditolak setelah switch
sukses. Pagination 5/10/20 diperiksa untuk semua role dengan 13 WO dan viewport
mobile. CSP memblokir inline script dan event handler yang sengaja disisipkan;
aplikasi, dialog, dan preview foto normal tidak menimbulkan pelanggaran CSP atau
error JavaScript. Seluruh data uji berada dalam project Compose terisolasi.

Project tes beserta volume telah dibersihkan. Snapshot sebelum/sesudah identik:
3 user, 5 WO, 3 pengajuan, dan 3 item pada database utama.
