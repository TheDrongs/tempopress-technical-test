# Foto opsional per item sparepart

Tambahan yang diminta pengguna pada 4 November 2026, di luar requirement awal
technical test. Poin 1–5 mencakup aturan, database, Docker/storage, upload backend,
dan akses gambar. Poin 6–7 kini juga tersedia: form upload, thumbnail review SPV,
dan preview foto pada frontend. Lihat [Frontend Work Order](FRONTEND.md).

## Aturan

- Satu foto opsional per item. Pengajuan tanpa foto dan campuran item tetap valid.
- JPG/JPEG atau PNG, maksimal 2 MiB (2.097.152 byte) per foto, maksimal 20 megapixel.
- Hanya gambar satu frame. Backend memeriksa isi dengan decoder sharp, lalu
  melakukan re-encode dan menghapus metadata; tidak hanya memeriksa ekstensi/MIME.
  Hasil re-encode juga harus maksimal 2 MiB.
- Maksimal 10 foto per request. Ini batas teknis upload, bukan batas jumlah item
  untuk pengajuan JSON tanpa foto. Batas total Nginx 22 MiB termasuk multipart.
- Admin mengirim foto bersama pengajuan pada status ASSIGNED. Approval/status WO
  tetap memakai workflow yang sudah ada.
- Tidak ada endpoint mengganti atau menghapus foto setelah submit. Mengganti atau
  menghapus pilihan sebelum submit ditangani form frontend.

## Penyimpanan dan database

Migration `002_add_sparepart_item_image.sql` menambah `sparepart_items.image_path`
bertipe TEXT nullable. Data existing tetap ada dengan image_path NULL. Tetap empat
tabel bisnis, total 30 kolom pada tahap foto. Migration 003 untuk SPV tujuan
kemudian menjadikan total 31 kolom. Migration 001 tidak diubah.

Nilai database adalah storage key relatif seperti:

```text
spareparts/67acd966-929d-4028-ad74-bfa36f067d0a.png
```

File aslinya berada di `/app/uploads/spareparts/` dalam container backend. Named
volume `sparepart_uploads` dipasang ke `/app/uploads`. Tidak ada service tambahan;
Compose tetap menjalankan database, backend, dan frontend. Direktori volume sudah
disiapkan agar user node pada image backend dapat menulis.

Tanpa Docker, default folder adalah `uploads` relatif terhadap working directory
backend. Environment `UPLOADS_DIRECTORY` dapat mengubah lokasinya. Compose secara
eksplisit memakai `/app/uploads`; contoh konfigurasi lokal ada di
`backend/.env.example`. Folder uploads diabaikan Git dan build context Docker.
Untuk proses lokal, set environment sebelum start, misalnya
`$env:UPLOADS_DIRECTORY = 'C:\tid-tempopress-test\backend\uploads'` di PowerShell.
File .env tidak dimuat otomatis oleh aplikasi; .env.example hanya contoh nilai.

`docker compose down` mempertahankan named volumes. `docker compose down -v`
menghapus volume database dan foto. Backup/restore perlu menyertakan kedua volume
secara konsisten; backup PostgreSQL saja tidak menyertakan file gambar.

## Upload pada endpoint pengajuan yang sama

```http
POST /api/work-orders/:id/request-sparepart
Cookie: tempopress_session=<session dari login Admin>
```

Kontrak JSON lama `{ "items": [{ "name": "Kampas rem", "qty": 2 }] }` tetap
didukung tanpa foto. Untuk foto, gunakan multipart/form-data:

| Field | Isi |
| --- | --- |
| title | String opsional, aturan DTO lama |
| description | String opsional, aturan DTO lama |
| items | String JSON array dari items |
| photos.<photoKey> | File untuk item dengan photoKey yang cocok |

Contoh nilai field items:

```json
[
  { "name": "Kampas rem", "qty": 2, "photoKey": "pad-1" },
  { "name": "Minyak rem", "qty": 1 }
]
```

Field file-nya adalah `photos.pad-1`. photoKey berupa 1–64 karakter huruf, angka,
underscore, atau tanda minus. Penanda ini hanya korelasi pada request, tidak
disimpan sebagai ID atau path. Setiap penanda harus unik dan memiliki tepat satu
file. File tanpa pasangan, penanda tanpa file, dan file ganda ditolak. Urutan
items maupun file tidak menentukan pasangannya. Client tidak boleh mengirim
imagePath atau imageUrl sebagai input.

Contoh PowerShell 7 (ganti ID WO dan lokasi file):

```powershell
Invoke-RestMethod 'http://localhost:5173/api/auth/login' -Method Post -ContentType 'application/json' -Body '{"username":"admin","password":"admin123"}' -SessionVariable admin
$workOrderId = '<UUID WO berstatus ASSIGNED>'
$form = @{
  items = '[{"name":"Kampas rem","qty":2,"photoKey":"pad-1"},{"name":"Minyak rem","qty":1}]'
  'photos.pad-1' = Get-Item -LiteralPath 'C:\photos\kampas-rem.jpg'
}
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:5173/api/work-orders/$workOrderId/request-sparepart" `
  -WebSession $admin `
  -Form $form
```

Untuk FormData di browser/Axios nanti, jangan menetapkan Content-Type secara
manual: browser perlu menambahkan multipart boundary.

Response pengajuan/detail/approval menambahkan dua field per item:

```json
{
  "id": "<UUID item>",
  "name": "Kampas rem",
  "qty": 2,
  "imagePath": "spareparts/<UUID file>.png",
  "imageUrl": "/api/sparepart-items/<UUID item>/image"
}
```

Field lain pada item tetap tersedia. Tanpa foto, imagePath dan imageUrl bernilai
null. URL relatif yang dikirim API dapat dipakai melalui origin backend atau
proxy /api frontend; path absolut disk tidak diekspos.

## Akses gambar

```http
GET /api/sparepart-items/:id/image
```

Mengembalikan bytes PNG/JPEG dengan Content-Type yang sesuai, Content-Disposition
inline, dan X-Content-Type-Options nosniff. UUID item dicari di database; client
tidak dapat memasukkan path filesystem. Endpoint memerlukan session login dan memeriksa akses WO induk. Gambar
same-origin dapat dipakai langsung pada <img src> karena browser mengirim cookie
session otomatis. Session hilang/kedaluwarsa menghasilkan 401; akun yang tidak
berhak membaca WO mendapatkan 404. Tidak ada endpoint file upload statis atau directory listing.

Error: 400 untuk metadata/mapping/isi gambar tidak valid; 413 untuk file lebih
besar dari 2 MiB (atau request melebihi batas Nginx); 403 untuk role upload yang
salah; 409 untuk status WO salah; 404 untuk item/foto yang tidak ada. Gagal tulis
disk atau database menghasilkan 500 tanpa membuka pesan internal pada respons.

## Konsistensi dan verifikasi

File di-buffer dalam memori dengan batas ukuran/jumlah sebelum validasi. Tidak
ditulis ke disk sebelum identitas, DTO, pairing, isi gambar, dan status WO valid.
Status dicek sambil mengunci baris WO, sehingga submit bersamaan hanya membuat
satu pengajuan. File ditulis sebelum referensinya disimpan dalam transaksi.

Jika penulisan atau transaksi gagal, file yang telah ditulis dibersihkan. File
parsial dari write yang gagal juga dibersihkan; kegagalan cleanup dicatat/diangkat
sebagai error. Filesystem dan PostgreSQL tidak memiliki satu transaksi bersama:
penghentian paksa proses atau gangguan disk dapat memerlukan rekonsiliasi manual.

Pengujian integrasi menggunakan PostgreSQL asli dan direktori sementara terpisah.
Mencakup tanpa foto, campuran JPG/PNG, pairing meskipun urutan berbeda, preview,
approval, validasi isi/ukuran/jumlah, role/status, submit bersamaan, rollback dan
cleanup, restart aplikasi, serta foto hilang. Test schema mencakup upgrade data
lama dan constraint path. Jalankan dari backend:

```powershell
npm run build
npm run lint
npm test
npm run test:database
```

Referensi implementasi: [NestJS file upload](https://docs.nestjs.com/techniques/file-upload)
dan [sharp constructor](https://sharp.pixelplumbing.com/api-constructor/).

Contoh PowerShell berikut memerlukan login Admin dengan -SessionVariable admin
seperti pada [contoh API](API.md#mencoba-dari-powershell).

## Checklist tambahan

- [x] 1. Aturan foto opsional dan batas teknis.
- [x] 2. Migration database, tipe, dan query repository.
- [x] 3. Volume upload, izin tulis backend, dan batas proxy Nginx.
- [x] 4. Pengajuan multipart, validasi, pairing, dan cleanup saat gagal.
- [x] 5. Endpoint gambar dan imageUrl pada respons item.
- [x] 6. UI pemilihan foto, preview, ganti/hapus sebelum submit, dan Axios.
- [x] 7. Thumbnail dan viewer pada tampilan review SPV.

Pengujian backend dan dokumentasi poin 1–5 sudah disertakan. Frontend memiliki
13 unit test dan 11 test browser. Smoke test UI terhadap API asli juga
memverifikasi upload, preview SPV, approval, dan penyelesaian WO.

Hasil verifikasi 4 November 2026: build/lint lulus, 44 test integrasi dan dua test
health lulus. Upload PNG 1.773.461 byte melalui Nginx berhasil; pengajuan campuran
dan approval SPV berhasil. Setelah container backend dibuat ulang, hash file yang
diambil melalui backend langsung dan proxy tetap sama. Ketiga service healthy.
Data dan file uji dibersihkan, menyisakan tiga user demo dan nol data bisnis/foto.
