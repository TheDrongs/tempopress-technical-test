# Frontend Work Order - Step 6 dan 7

Diimplementasikan pada 4 November 2026. React + Vite memakai Tailwind CSS 4,
komponen lokal pola shadcn/ui (Button/Dialog/Input/Select/Feedback), Radix Dialog,
Axios, Zustand, dan React Router. Konfigurasi komponen berada di
frontend/components.json. Halaman menampilkan data PostgreSQL melalui backend API.

## Struktur

```text
frontend/src/
├── App.tsx
├── main.tsx
├── index.css
├── api/
│   ├── http.ts
│   └── users.api.ts
├── stores/
│   └── user.store.ts
├── types/
│   └── user.types.ts
├── lib/
│   ├── utils.ts
│   └── use-form-validation.ts
├── components/ui/
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── feedback.tsx
│   └── input.tsx
└── work-orders/
    ├── WorkOrderListPage.tsx
    ├── WorkOrderDetailPage.tsx
    ├── work-order.types.ts
    ├── work-order.utils.ts
    ├── work-order.tasks.ts
    ├── work-order.messages.ts
    ├── api/
    │   └── work-order.api.ts
    ├── stores/
    │   └── work-order.store.ts
    └── components/
        ├── WorkOrderForm.tsx
        ├── WorkOrderActions.tsx
        ├── WorkOrderTaskPanel.tsx
        ├── StatusBadge.tsx
        ├── ActionSuccessDialog.tsx
        ├── SparepartFields.tsx
        ├── SparepartRequestCard.tsx
        └── PhotoPreview.tsx
```

Komponen ui dipakai lintas fitur. Komponen bisnis, tipe, API, dan store WO berada
bersama dalam folder work-orders sesuai struktur yang disepakati.

## Halaman dan modal

/auth/LoginPage berada pada route /login. Pengguna tanpa session diarahkan ke
login; setelah berhasil, URL detail tujuan dapat dipulihkan dan tetap diperiksa
backend. Lihat [authentication](AUTHENTICATION.md).

Pagination berada di footer tabel untuk semua role: default lima baris, pilihan
5/10/20, tombol sebelumnya/berikutnya, dan Page X of Y. Pergantian akun atau ukuran
halaman kembali ke halaman pertama; jumlah tugas dihitung dari seluruh daftar.
Pagination frontend memakai daftar yang sudah difilter backend.

- `/` mengarah ke `/work-orders`.
- `/work-orders` menampilkan list, empty/loading/error state, tombol muat ulang,
  serta tombol create untuk Admin. Heading mengikuti role: Work Orders - Admin
  Panel, Work Orders - SPV Panel, atau Work Orders - Mechanic Panel.
- `/work-orders/:workOrderId` adalah child route list. WorkOrderDetailPage
  ditampilkan sebagai modal di atas list yang tetap terpasang. URL dapat dibuka
  langsung dan di-refresh melalui fallback Vite/Nginx.
- Create menggunakan modal dengan draft form lokal. Setelah berhasil, dialog
  create ditutup dan detail WO tampil dalam kondisi blur. Popup Sukses membuat
  Draft WO tampil di depan detail setelah data detail dimuat (atau read gagal).
  Tombol Tutup, ikon X, dan Escape pada popup menutup keduanya dan kembali ke list.
  Penanda sukses pada navigasi dikonsumsi sekali; membuka detail lagi atau refresh
  tidak mengulang popup. Submit Work Order dijalankan pengguna dari detail setelah itu.
- Detail menampilkan form persiapan untuk Admin pada ASSIGNED, serta informasi
  dan tindakan sesuai role/status pada tahap lain.
- Semua mutasi sukses memakai ActionSuccessDialog di depan detail blur: create,
  kirim ke SPV, assignment, persiapan dengan/tanpa sparepart, approval, mulai
  bekerja, dan completion. Menutup popup selalu menutup detail dan kembali ke list.
  Pesan mengikuti tindakan yang berhasil; kegagalan operasi tetap mempertahankan
  form agar dapat diperbaiki dan dicoba ulang.
- Foto dibuka melalui dialog preview di atas detail. Menutup preview mengembalikan
  fokus ke detail; menutup detail kembali ke list.

Dialog memiliki judul/deskripsi yang dapat diakses pembaca layar, focus trap,
tombol tutup, dan Escape. Ketika mutasi berlangsung, tombol, pilihan pengguna,
dan penutupan dialog diblokir. Body modal dapat di-scroll, dengan footer tetap
terlihat. Tabel menggunakan scroll horizontal di layar kecil; halaman utama
tetap mengikuti lebar viewport.
Pada footer form assignment/completion, input berada pada baris tersendiri;
tombol aksi utama berada di kanan bawah. Footer detail tidak menampilkan teks
keterangan status, teks tujuan SPV tunggal, atau tombol Tutup. Divider tetap
ada; detail ditutup melalui ikon X di header atau Escape. Jika SPV lebih dari
satu, selector SPV tujuan tetap tersedia agar submit memiliki penerima.

Badge status pada modal detail memakai awalan Status : dan font 0.9rem
(20% lebih besar dari badge tabel 0.75rem). Deskripsi berada di dalam kotak
informasi WO, di bawah metadata dan membentang sepanjang kedua kolom.

Panel informasi di antara header halaman dan tabel merangkum WO yang memerlukan
perhatian pengguna aktif, beserta jumlah per jenis tugas. Admin: draft yang belum
dikirim, persiapan, dan penyelesaian. SPV: penugasan mechanic dan persetujuan
sparepart. Mechanic: WO siap dikerjakan dan sedang dikerjakan miliknya. Completed
dan tahap yang menunggu role lain tidak dihitung. Jumlah approval dihitung per WO,
bukan per item sparepart. Panel hanya tampil bila jumlahnya lebih dari nol dan
list pengguna aktif berhasil dimuat; disembunyikan saat loading, mutasi, atau error.

## Validasi field

Aturan required dan batas nilai tetap mengikuti kontrak backend; deskripsi/foto
tetap opsional. Semua field diperiksa bersama ketika form disubmit.

- Satu field invalid: border merah, getaran singkat pada field tersebut, dan
  pesan merah kecil tepat di bawahnya. Submit ulang mengulang animasi.
- Lebih dari satu field invalid: semua border terkait merah, tanpa getaran,
  dengan satu pesan umum Harap lengkapi Form terlebih dahulu. Pesan per-field
  tidak ditampilkan bersamaan dengan pesan umum.
- Koreksi field membersihkan error field tersebut. Fokus diarahkan ke field
  invalid pertama; aria-invalid dan aria-describedby menghubungkan pesan.
- Pola berlaku pada judul, pilihan kebutuhan sparepart, daftar items, nama/jumlah
  item, foto, pilihan mechanic, dan waktu selesai. Validasi foto langsung di
  pemilihan file menggunakan pola yang sama; pilihan foto lama dipertahankan jika
  file baru ditolak dan pengguna dapat membatalkan pilihan yang invalid.
- Kegagalan server/koneksi tetap tampil sebagai feedback operasi. Animasi
  mengikuti preferensi reduced motion perangkat.

## Pembagian tanggung jawab

| Bagian | Tugas |
| --- | --- |
| api/http.ts | Axios same-origin /api, timeout, header pelaku, pesan error |
| users.api.ts | Memuat user demo |
| user.store.ts | Session user, login/logout, daftar assignment, loading/error |
| work-order.api.ts | Kontrak setiap endpoint dan serialisasi JSON/multipart |
| work-order.store.ts | List/detail, loading/error terpisah, mutasi dan refresh |
| State React lokal | Isi form, pilihan File, URL preview, catatan approval, tanggal selesai |
| React Router | ID detail dan navigasi list/modal |

Identitas login dimuat dari GET /api/auth/me. Session disimpan dalam cookie
HttpOnly; token/password tidak disimpan pada localStorage atau Zustand. Store user
menangani initialize, login, logout, data assignment, serta error/loading. Cache WO
dan request aktif dikosongkan ketika logout atau session kedaluwarsa; respons
lama tidak boleh memulihkan data akun sebelumnya.

Axios mengirim cookie same-origin. actorId pada fungsi API digunakan oleh store
untuk mengasosiasikan cache dan respons dengan akun pemanggil; parameter ini tidak
menjadi header identitas. Setelah mutasi berhasil, list/detail dimuat ulang dan
refresh gagal dipisahkan dari write yang sudah berhasil. Lock mutasi di
store mencegah double submit. Semua perubahan role/status tetap divalidasi backend.
Pergantian pengguna langsung mengosongkan cache list lama; render juga memeriksa
actor pemilik cache sehingga draft/data pengguna sebelumnya tidak berkedip saat
request baru berjalan. List/detail API sudah difilter backend sesuai penugasan.

Admin dapat melihat semua WO. SPV melihat non-draft yang dikirim kepadanya;
Mechanic melihat non-draft yang ditugaskan kepadanya, termasuk riwayat completed.
Jika hanya satu SPV, tujuan dipilih otomatis tanpa teks tambahan. Bila beberapa SPV
tersedia, selector SPV tujuan wajib dipilih sebelum submit. Pilihan ini disimpan
sebagai assignedSpvId; assignment mechanic dan approval dibatasi ke SPV tersebut.

## Tindakan sesuai workflow

| Role | Status awal | Tindakan UI | Hasil |
| --- | --- | --- | --- |
| Admin | - | Buat Work Order | DRAFT |
| Admin | DRAFT | Submit Work Order | SUBMITTED |
| SPV | SUBMITTED | Pilih dan tugaskan mechanic | ASSIGNED |
| Admin | ASSIGNED | Lengkapi persiapan tanpa sparepart | READY_TO_WORK |
| Admin | ASSIGNED | Lengkapi persiapan dengan items/foto opsional | WAITING_SPAREPART_APPROVAL |
| SPV | WAITING_SPAREPART_APPROVAL | Catatan opsional dan Setujui Pengajuan | READY_TO_WORK jika semua pengajuan disetujui |
| Mechanic yang ditugaskan | READY_TO_WORK | Mulai Bekerja | WORKING, start date dari server |
| Admin | WORKING | Isi waktu selesai dan Selesaikan Work Order | COMPLETED |

Waktu selesai memakai input lokal perangkat dan dikirim sebagai ISO 8601 UTC.
Validasi memastikan tidak lebih awal dari startDate, termasuk presisi milidetik.
COMPLETED ditampilkan sebagai informasi tanpa aksi progres berikutnya.

## Foto opsional

Satu JPG/PNG opsional per item, maksimal 2 MiB dan maksimal 10 foto per pengajuan.
File bisa dipilih, diganti, dihapus, dan diperbesar sebelum submit. Item tanpa foto
tetap valid. URL object preview dimiliki form dan dibersihkan ketika file diganti,
item dihapus, atau form ditutup. Mengubah pilihan kebutuhan sparepart sementara
tetap mempertahankan draft; hanya jalur yang dipilih yang dikirim.

Jika terdapat foto, Axios mengirim FormData dengan items berupa JSON dan
photos.<photoKey> yang cocok dengan key item stabil. Content-Type/boundary
ditentukan browser. Tanpa foto, endpoint pengajuan memakai JSON yang sudah ada.
Persiapan tanpa sparepart memakai endpoint /update, bukan membuat request kosong.

SPV melihat thumbnail yang dapat diperbesar dan label Tanpa foto. Gambar hilang
menampilkan placeholder. Setelah submit, gambar dibaca sebagai bagian data
pengajuan. Decoder/format/dimensi serta izin akhir tetap diperiksa backend.
Detail storage dan endpoint berada di [Foto Opsional Sparepart](SPAREPART_PHOTOS.md).

## Menjalankan

Dari root: `docker compose up --build -d --wait`, lalu buka
http://localhost:5173/work-orders. Untuk Vite lokal, jalankan npm ci dan npm run dev
dari frontend. Proxy /api mengarah ke localhost:3000; API_PROXY_TARGET dapat
mengubah target Vite. Backend dan database perlu berjalan untuk pemakaian aplikasi.

Login menggunakan akun pada README utama. Header menampilkan nama/role dan
tombol Keluar. Dropdown di bawah username membuka popup login untuk role berikutnya;
password salah/cancel mempertahankan session lama.
Authentication merupakan bonus yang dipilih setelah baseline selesai.

Sidebar menampilkan nama PT Tempopress International Delivery dan subjudul
Technical Test. Warna sidebar mengikuti role pengguna aktif: Admin hijau, SPV
biru, dan Mechanic cokelat muda dengan teks gelap agar tetap terbaca.

## Jika simpan WO gagal karena database tidak terhubung

Backend lokal dapat tetap berjalan ketika Docker/PostgreSQL berhenti. Dalam
kondisi ini GET /api/health mengembalikan HTTP 503 dengan database: unavailable,
dan aksi database seperti create dapat mengembalikan HTTP 500.

Untuk mode development lokal, nyalakan Docker Desktop, lalu dari root:

```powershell
docker compose up -d --wait database
Invoke-RestMethod http://localhost:3000/api/health
```

Health sukses mengembalikan database: connected. Backend/frontend yang dijalankan
dengan npm tetap dipakai; tidak perlu menjalankan duplikatnya dalam container.
Jika memakai mode seluruh aplikasi di Docker, gunakan docker compose up --build
-d --wait setelah memastikan port 3000/5173 tidak dipakai proses development.

## Verifikasi

Dari frontend:

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
```

- Build TypeScript strict dan Vite berhasil; lint bersih.
- 16 test Vitest: ringkasan tugas per role/penugasan, lifecycle store, respons usang, penutupan detail, pergantian
  actor, double submit, refresh gagal setelah write sukses, serta JSON/multipart
  dengan pemetaan foto yang benar.
- 13 test Playwright: dua jalur WO, role, deep-link refresh, preview/approval,
  validasi sebelum request, retry list, dialog/viewport mobile, popup sukses dengan
  detail blur dan tiga cara close, validasi satu/multi-field, serta panel/visibilitas
  lintas pengguna dan pilihan SPV tujuan. Setiap aksi pada kedua jalur memeriksa
  popup sukses dan kembali ke list. Assignment dan
  waktu selesai invalid ikut diverifikasi pada alur utama. Tes browser memakai
  fixture API terisolasi, tidak menulis data bisnis PostgreSQL.
- Pemeriksaan read-only pada data existing setelah migration memverifikasi
  Admin mendapat 3 WO, SPV 1, dan Mechanic 1. Dua draft juga ditolak 404 lewat URL
  detail langsung untuk SPV/Mechanic. Posisi footer selesai diperiksa lewat browser.
- Playwright menjalankan Vite pada port 5174, default menggunakan Chrome yang
  sudah terpasang. Gunakan `$env:PLAYWRIGHT_CHANNEL = 'msedge'` untuk Edge.
  Hasil kegagalan disimpan dalam test-results yang diabaikan Git.
- Smoke test terpisah terhadap UI Docker dan API/PostgreSQL asli menyelesaikan
  dua WO, satu tanpa sparepart dan satu dengan foto + item tanpa foto. Mencakup
  penolakan gambar invalid yang mempertahankan form, foto valid, preview SPV,
  catatan approval, start oleh mechanic, dan completion Admin.
- Reload URL detail melalui Nginx, pembacaan gambar, viewport mobile, dan tidak
  adanya page error sudah diverifikasi. Ketiga container healthy. Data/file uji
  dibersihkan; database aplikasi kembali berisi tiga user dan nol data bisnis uji.

Referensi komponen: [Tailwind + Vite](https://tailwindcss.com/docs/installation/using-vite),
[Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog),
[Zustand](https://zustand.docs.pmnd.rs/reference/apis/create), dan
[React Router](https://reactrouter.com/start/declarative/routing).

Revisi terbaru: dropdown role membuka popup autentikasi; session lama tetap aktif
setelah pembatalan/password salah. Counter dan batas field tersedia di semua form.
Lihat [Hardening](HARDENING.md) untuk kontrak serta hasil verifikasi terbaru.
