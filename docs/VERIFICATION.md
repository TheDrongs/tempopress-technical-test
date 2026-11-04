# Step 8 - Verifikasi Aplikasi Final

Catatan versi: laporan ini memverifikasi baseline sebelum authentication dan
pagination. Revisi berikutnya sudah diuji ulang; lihat
[Authentication dan Pagination](AUTHENTICATION.md) untuk hasil terbaru.

Tanggal: 4 November 2026. Hasil: **lulus** untuk versi yang diverifikasi pada
tahap ini. Perubahan fitur setelah tanggal pemeriksaan perlu diverifikasi kembali
sesuai bagian yang berubah.

## Lingkungan dan perlindungan data

Compose dijalankan dari root dengan konfigurasi project yang sama seperti README,
menggunakan project pengujian `tempopress-step8`. Port host dipisahkan agar
frontend/backend development pengguna tetap berjalan:

| Service | Port pengujian | Hasil |
| --- | --- | --- |
| Frontend Nginx | localhost:5318 | Healthy; halaman dan proxy API dapat diakses |
| Backend NestJS | localhost:3308 | Healthy; PostgreSQL connected |
| PostgreSQL | localhost:5548 | Healthy; volume database terpisah |

Volume `tempopress-step8_postgres_data` dan
`tempopress-step8_sparepart_uploads` memiliki label project pengujian tersebut.
Keduanya terpisah dari volume aplikasi utama. Snapshot baca saja pada empat tabel
bisnis aplikasi utama dibandingkan menggunakan SHA-256 sebelum/sesudah pengujian.
Seluruh record tetap identik: tiga user, empat WO, dua pengajuan, dan dua item.

## Setup dan container

- [x] Build frontend dan backend menggunakan Dockerfile berhasil.
- [x] Startup dari volume baru menghasilkan tiga migration, tiga user demo, dan
  nol WO. Migration dan seed berjalan otomatis sebelum HTTP server menerima trafik.
- [x] Setup CLI diulang: nol migration baru, tiga sudah diterapkan, nol user baru.
- [x] Ketiga service healthy; health langsung dan melalui proxy Nginx HTTP 200.
- [x] Akses menggunakan localhost berhasil; reload child route detail melalui
  Nginx tetap memuat aplikasi.
- [x] Ketiga container dibuat ulang dengan volume tetap terpasang. Data dan foto
  tetap tersedia; ketiga service kembali healthy.

Perintah Compose yang digunakan dari PowerShell:

```powershell
$env:POSTGRES_PORT = '5548'
$env:BACKEND_PORT = '3308'
$env:FRONTEND_PORT = '5318'
docker compose -p tempopress-step8 up --build -d --wait
docker compose -p tempopress-step8 exec -T backend node dist/database/setup/cli.js setup
docker compose -p tempopress-step8 up -d --force-recreate --wait
docker compose -p tempopress-step8 ps
```

Port pada README tetap merupakan port normal aplikasi. Variabel di atas hanya
untuk sesi pengujian terpisah; project utama tidak dihentikan atau diganti.

## Automated test

| Pemeriksaan | Hasil |
| --- | --- |
| Build Docker backend dan frontend | Lulus |
| Lint backend dan frontend | Lulus |
| Health API | 2 test lulus |
| Integrasi PostgreSQL dan HTTP NestJS | 50 test lulus |
| Unit frontend | 12 test lulus |
| Browser frontend dengan fixture API | 9 test lulus |

Total **73 automated test** lulus. Test browser dengan fixture API dipisahkan
dari pemeriksaan UI dengan API asli di bagian berikut. Suite backend mencakup
transaksi, migration/seed, constraint/relasi, workflow, konkurensi, rollback,
foto, serta visibilitas dan kepemilikan penugasan. Schema test dibersihkan.

Perintah dari `backend/`:

```powershell
$env:PGPORT = '5548'
npm run lint
npm test
npm run test:database
```

Perintah dari `frontend/`:

```powershell
npm run lint
npm test
npm run test:e2e -- --workers=2
```

Pada lingkungan Codex Windows, test backend dan Chrome memerlukan izin di luar
sandbox untuk cache Vitest, koneksi PostgreSQL lokal, dan browser. Setelah izin
diberikan, seluruh suite di atas berhasil. Ini kebutuhan lingkungan pengujian,
bukan perubahan cara menjalankan project dari terminal pengguna.

## UI Docker dengan API dan PostgreSQL asli

Tidak memakai fixture HTTP untuk pemeriksaan ini. Dua WO dibuat pada database
pengujian, dan seluruh progresnya dijalankan melalui browser:

| Jalur | Urutan | Hasil |
| --- | --- | --- |
| Tanpa sparepart | Draft → submit → assignment → persiapan tanpa sparepart → start Mechanic → completion Admin | COMPLETED |
| Dengan sparepart | Draft → submit → assignment → pengajuan dengan foto/tanpa foto → approval SPV → start Mechanic → completion Admin | COMPLETED |

Terdapat **13 aksi tulis UI berhasil**, masing-masing diikuti popup sukses di atas
detail blur, kemudian kembali ke list setelah popup ditutup. Pemeriksaan meliputi:

- [x] Draft tidak terlihat oleh SPV/Mechanic; akses detail langsung ditolak 404.
- [x] Pengiriman memilih SPV tujuan saat terdapat beberapa SPV.
- [x] Panel tugas berubah sesuai role dan status setelah aksi berhasil, serta
  tersembunyi ketika tidak ada pekerjaan terkait.
- [x] Form judul kosong menampilkan validasi field.
- [x] Badge detail berawalan `Status :`, font 14.4px; deskripsi berada dalam
  kotak informasi WO. Footer tetap memiliki divider tanpa tombol Tutup tambahan.
- [x] Pengajuan berisi dua item: satu PNG dan satu tanpa foto.
- [x] Isi file yang bukan gambar ditolak; input form tetap terisi dan WO tetap
  ASSIGNED. Pengajuan valid setelah itu berhasil melalui proxy Nginx.
- [x] SPV membuka preview foto dan menyimpan approval note. Nama pemberi approval
  serta catatan tersimpan pada data detail.
- [x] WO completed tetap menampilkan hasil yang sama setelah reload detail.
- [x] Viewport desktop 1440 × 1100 dan mobile 390 × 844 diperiksa. Halaman tidak
  melebar melebihi viewport; ikon X detail tetap dapat dijangkau.
- [x] Tidak ada error JavaScript halaman selama kedua jalur dijalankan.

## Penolakan aksi dan integritas

Pemeriksaan melalui API Docker melengkapi pembatasan tombol UI:

- Header identitas hilang/malformed dan user tidak ditemukan ditolak.
- Pembuatan WO oleh SPV dan assignment oleh Admin ditolak 403.
- SPV lain tidak dapat menugaskan atau menyetujui pengajuan milik SPV tujuan.
- Mechanic lain tidak dapat memulai WO atau membaca detail di luar penugasannya.
- Start sebelum assignment atau sebelum approval ditolak 409.
- Completion oleh Mechanic ditolak 403; end date sebelum start date ditolak 400.
- Approval berulang dan start sesudah COMPLETED ditolak 409.

Identitas tetap simulasi `X-User-Id` sesuai baseline tanpa authentication. Endpoint
foto tetap asset publik sesuai kontrak yang didokumentasikan, dan tidak berubah
menjadi fitur login atau audit log.

## Persistensi dan hasil akhir

Sebelum/sesudah `--force-recreate`, seluruh row pada tabel pengujian dibandingkan
dengan SHA-256, termasuk timestamp dan metadata migration. Hasil identik:

| Tabel | Record pengujian |
| --- | --- |
| users | 5: tiga seed dan dua user tambahan untuk uji kepemilikan |
| work_orders | 2; keduanya COMPLETED |
| sparepart_requests | 1; APPROVED |
| sparepart_items | 2; satu dengan foto |
| _schema_migrations | 3 |

Hash foto identik melalui backend langsung, proxy frontend, dan localhost:
`6a566f8998aef5b3fb5d77c97b6c52c6399c384f26b5e2ccdb7b08e5928f5fb6`.
Tidak ada schema integrasi tersisa pada database pengujian.

Review struktur mengonfirmasi HTTP controller meneruskan input ke service;
aturan role/status berada pada service; query parameterized berada pada repository.
Transaksi dan row lock tetap dipakai pada perubahan progres. Tidak ada perubahan
kode aplikasi yang diperlukan dari hasil pemeriksaan tahap ini.

Container dan volume pengujian dibersihkan setelah seluruh hasil dicatat. Data
dan proses development aplikasi utama dipertahankan. Artefak diagnostik lokal
berada di `tmp/step8-*` dan tidak termasuk source yang akan diserahkan.

**Berikutnya Step 9:** finalisasi dokumentasi dan paket penyerahan sesuai
implementasi yang sudah diverifikasi. Audit log proses masih berupa usulan
diskusi dan tidak termasuk implementasi yang dinyatakan lulus di sini.
