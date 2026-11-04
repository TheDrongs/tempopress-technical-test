> Pembaruan 4 November 2026: temuan CSP dan batas panjang input di bawah sudah
> diperbaiki dan diverifikasi. Laporan ini mencatat audit sebelum perbaikan.
> Lihat [hasil hardening terbaru](HARDENING.md).

# Review Input, SQL Injection, dan XSS

Tanggal: 4 November 2026. Cakupan: audit kode input/query/render dan pengujian
payload terarah melalui UI/API Docker. Ini mencatat hasil pada jalur yang diuji,
bukan klaim bahwa seluruh jenis serangan atau konfigurasi deployment telah diuji.
Tidak ada perubahan kode aplikasi pada review ini.

## Proteksi yang sudah tersedia

| Lapisan | Implementasi | Batas makna |
| --- | --- | --- |
| Frontend | Trim input, field wajib, qty, format/ukuran foto, pesan validasi | Membantu UX; dapat dilewati caller API |
| Backend | Global ValidationPipe: transform, whitelist, forbidNonWhitelisted; DTO, UUID, qty, tanggal, role/status | Memvalidasi struktur dan aturan; tidak menghapus markup dari setiap string |
| PostgreSQL | Placeholder $1, $2, array parameter, serta mapping nama kolom yang tetap | Input menjadi nilai data, terpisah dari sintaks SQL |
| React | Teks melalui JSX; tidak ditemukan dangerouslySetInnerHTML/innerHTML/document.write/eval pada src | Teks biasa dirender sebagai teks, tidak diinterpretasikan sebagai HTML |
| Foto | Decoder JPG/PNG, pemeriksaan isi/MIME, re-encode, UUID storage key, nosniff | SVG/HTML tidak diterima sebagai format upload |
| Session | Cookie HttpOnly, SameSite, expiry; role dan penugasan diperiksa backend | Pelengkap; HttpOnly bukan pengganti pencegahan XSS |

Query dinamis yang diperiksa memakai pilihan tetap dari kode, misalnya condition
berdasarkan role dan mapping kolom update. Nilai pengguna tetap melewati parameter.
SQL migration dibaca dari file project, bukan input HTTP. URL foto dihasilkan
backend dari UUID item; caller tidak memasukkan URL gambar atau storage path bebas.

Tidak ada sanitizer HTML seperti DOMPurify pada input teks. Data aplikasi saat
ini berupa plain text. HTML sanitizer dibutuhkan jika suatu saat konten pengguna
sengaja ditampilkan sebagai rich HTML; jalur tersebut belum ada di aplikasi ini.
Trim atau blacklist karakter saja bukan pengganti parameterisasi SQL maupun
output encoding sesuai konteks.

## Pengujian aktual

Compose terpisah: project tempopress-security-test, frontend localhost:5329,
backend localhost:3319, PostgreSQL localhost:5549. Startup volume kosong berisi
tiga user demo dan nol WO. Payload hanya dikirim ke stack pengujian ini.

| Pemeriksaan | Hasil |
| --- | --- |
| Username berisi OR tautology atau percobaan DROP TABLE saat login | 401; tidak mendapat session |
| Judul dan nama sparepart berisi apostrof, titik koma, DROP TABLE, dan komentar SQL | Nilai tersimpan utuh sebagai data; tabel dan jumlah user tetap utuh |
| XSS berbentuk img/onerror pada judul dan nama sparepart | Tampil literal; tidak membuat node HTML atau request gambar injeksi |
| XSS berbentuk svg/onload pada deskripsi | Tampil literal; JavaScript tidak berjalan |
| Penutup textarea dan script pada catatan approval | Tampil literal pada detail sesudah approval |
| Payload dibaca ulang sesudah refresh dan dari akun SPV | Tetap teks biasa; tidak ada eksekusi antar akun |
| UUID tidak valid serta field status/createdBy yang dikirim caller | 400 |
| SVG berisi handler yang disamarkan menjadi image/png dengan nama .png | 400; tidak menyimpan pengajuan dan WO tetap ASSIGNED |

Instrumentasi browser menemukan nol eksekusi marker JavaScript, nol elemen dari
markup injeksi, nol request ke alamat gambar marker, dan nol dialog JavaScript.
Snapshot data utama sebelum/sesudah membuktikan identitas tiga user, empat WO,
dua pengajuan, dan dua item tidak berubah. Environment pengujian dibersihkan.

Pengujian ini merupakan tambahan manual terarah terhadap baseline 85 automated
test yang sebelumnya lulus; tidak mengubah jumlah automated test tersebut.

## Hardening yang belum diterapkan

1. **Content Security Policy.** Header CSP belum dikonfigurasi di Nginx dan tidak
   ditemukan pada respons frontend Docker yang diperiksa. CSP dapat menambah
   pembatasan sumber script dan mengurangi dampak jika terjadi kesalahan render.
   Ketiadaan CSP bukan bukti bahwa payload XSS pada pengujian di atas berhasil.
2. **Batas panjang field teks.** Username/password sudah memiliki MaxLength.
   Judul, deskripsi, nama sparepart, dan catatan approval belum memiliki batas
   panjang field yang konsisten di frontend/backend. Penetapan batas ini membantu
   mengendalikan ukuran data; bukan mekanisme utama pencegahan SQL injection/XSS.

Keduanya dicatat untuk keputusan revisi berikutnya, tanpa menambah scope atau
mengubah isi input secara diam-diam.

## Referensi

- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [node-postgres: Parameterized query](https://node-postgres.com/features/queries)
- [OWASP Cross Site Scripting Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
