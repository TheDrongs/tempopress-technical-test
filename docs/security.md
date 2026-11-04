# Security

Ringkasan kontrol keamanan yang diterapkan pada aplikasi demo. Pemeriksaan yang
telah dilakukan mencakup SQL injection, stored XSS, validasi upload, akses antar
role, session, serta CSP; hasil pada jalur tersebut bukan jaminan terhadap semua
jenis serangan atau konfigurasi deployment.

## Input dan SQL injection

- Backend memakai ValidationPipe global: `transform`, `whitelist`, dan
  `forbidNonWhitelisted`. DTO memvalidasi UUID, nested items, qty, tanggal, dan teks.
- Query menggunakan parameter `$1`, `$2`, dan seterusnya. Nama kolom/kondisi
  dinamis berasal dari mapping tetap dalam kode; input pengguna menjadi nilai data.
- Judul/nama di-trim dan tidak boleh kosong. Qty integer positif; waktu selesai
  tidak lebih awal dari mulai. Role/status/penugasan tetap diverifikasi service.
- Field sistem seperti status, pembuat, dan pemberi approval tidak dapat disetel
  bebas melalui body. Rincian SQL/internal tidak dikirim dalam error response.

| Field | Maksimum karakter |
| --- | ---: |
| Judul WO | 50 |
| Deskripsi | 100 |
| Nama sparepart | 30 |
| Catatan persetujuan | 100 |

Frontend menyediakan validasi/counter untuk UX; backend memvalidasi ulang JSON
maupun multipart. Pembatasan panjang bukan pengganti parameterisasi SQL.

## XSS dan Content Security Policy

Teks pengguna dirender sebagai plain text melalui JSX; tidak menggunakan
`dangerouslySetInnerHTML`, `innerHTML`, atau eval untuk konten pengguna.
Tidak ada HTML sanitizer karena aplikasi tidak mendukung rich HTML; trim saja
bukan mekanisme pencegahan XSS. Jika rich HTML ditambahkan, kebutuhan sanitasi
dan output encoding harus ditinjau sesuai konteks.

Nginx Docker mengirim CSP dengan sumber default/script/connect/font/form/base
origin sendiri, `script-src-attr 'none'`, `object-src 'none'`, dan
`frame-ancestors 'none'`. Preview gambar mengizinkan `blob:`/`data:`.
Inline JavaScript/handler dan eval diblokir; inline CSS diizinkan untuk Radix.
Header `X-Content-Type-Options: nosniff` juga dikirim. Konfigurasi lengkap ada di
[nginx.conf](../frontend/nginx.conf).

CSP ini berlaku pada frontend production Docker/Nginx. Server development Vite
memakai HMR dan tidak mengirim CSP production. Pemeriksaan browser memverifikasi
payload inline diblokir tanpa mengganggu dialog serta preview normal.

## Session, otorisasi, dan request lintas origin

Password di-hash scrypt; token acak disampaikan lewat cookie HttpOnly, SameSite=Lax,
berumur delapan jam. Database hanya menyimpan hash token. API bisnis dan foto
memerlukan session; respons privat memakai `Cache-Control: no-store`.

Backend mengambil user/role dari database. Admin melihat semua WO, SPV hanya
penugasannya, Mechanic hanya penugasannya; draft tidak terlihat oleh keduanya.
Detail/foto di luar akses ditolak 404, dan aksi oleh pelaku yang tidak berwenang
ditolak. Dropdown atau header identitas client tidak memberikan hak akses.

Mutasi memeriksa host Origin terhadap Host dan menolak `Sec-Fetch-Site: cross-site`.
Proxy mempertahankan Host termasuk port. Cookie Secure default false untuk demo
HTTP localhost; konfigurasi HTTPS memakai `AUTH_COOKIE_SECURE=true`.
Pergantian akun yang gagal mempertahankan session lama; mekanismenya ada di
[authentication](authentication.md).

## Upload foto opsional

Hanya JPG/PNG satu frame yang lolos decoder sharp; ekstensi/MIME saja tidak cukup.
Batas 2 MiB per foto, 20 megapixel, 10 foto/request, dan request Nginx 22 MiB.
Gambar di-encode ulang dengan metadata dihapus. Storage key UUID ditentukan
backend, client tidak memasukkan path bebas, dan file tidak dilayani sebagai
direktori statis publik. Mapping file ke item, status, dan akses WO diperiksa.
Kontrak serta batas konsistensi file/database ada di [backend](backend.md#foto-sparepart-opsional).
