# Frontend

React + TypeScript + Vite, Tailwind CSS, komponen pola shadcn/Radix, Axios,
Zustand, dan React Router. Data berasal dari API backend dan PostgreSQL.

## Struktur dan tanggung jawab

```text
frontend/src/
├── App.tsx                       # Shell, identitas, dan warna sesuai role
├── auth/                         # LoginPage dan RoleSwitcher
├── api/                          # Axios, auth API, dan users API
├── stores/user.store.ts          # Session dan data user untuk penugasan
├── components/ui/                # Button, dialog, input, feedback, counter
├── lib/                          # Validasi form dan batas karakter
└── work-orders/
    ├── WorkOrderListPage.tsx
    ├── WorkOrderDetailPage.tsx
    ├── api/work-order.api.ts
    ├── stores/work-order.store.ts
    └── components/               # Form, actions, status, sparepart, preview
```

| Bagian | Tanggung jawab |
| --- | --- |
| Axios `/api` | Request same-origin, cookie, timeout, dan pemetaan error |
| Zustand user | Pemulihan session, login/logout/switch, user penugasan |
| Zustand WO | List/detail, loading/error, mutasi, dan refresh data |
| State React lokal | Isi form, file, preview, catatan, dan waktu selesai |
| React Router | URL list/detail serta navigasi modal |

Token dan password tidak disimpan dalam localStorage atau Zustand. Cache WO
dibersihkan ketika session berganti/berakhir; respons akun lama diabaikan.
Mutasi dikunci untuk mencegah double submit. Gagal refresh sesudah write sukses
ditampilkan terpisah agar pengguna tidak mengulang aksi yang sudah tersimpan.

## Halaman dan interaksi

- `/login`: login username/password; route WO memerlukan session valid.
- `/work-orders`: list, panel tugas sesuai role, loading/empty/error/retry,
  dan tombol create khusus Admin. Sidebar Admin hijau, SPV biru, Mechanic cokelat muda.
- `/work-orders/:workOrderId`: child route list yang tampil sebagai modal detail;
  dapat dibuka langsung dan di-refresh melalui fallback Vite/Nginx.
- Detail memuat metadata/deskripsi, badge `Status :`, pengajuan sparepart,
  dan aksi yang tersedia menurut role/status. Ikon X atau Escape menutup detail.
- Setiap mutasi sukses menampilkan popup di depan detail yang diburamkan.
  Menutup popup menutup detail dan kembali ke list; operasi gagal mempertahankan form.
- Dialog memakai focus trap, label aksesibel, body scroll, dan penutupan/tombol
  yang dikunci saat mutasi berlangsung. Layout mendukung desktop dan mobile.

Panel tugas hanya menghitung pekerjaan yang memerlukan aksi role aktif:
Admin untuk draft/persiapan/completion, SPV untuk penugasan/approval sparepart,
dan Mechanic untuk siap/sedang dikerjakan. Tugas dihitung per WO.
Pagination semua role: default 5, pilihan 5/10/20, `Page X of Y`, dan navigasi.
Filter akses dijalankan backend; total/panel menghitung seluruh daftar yang diizinkan.

## Form dan foto opsional

Judul maksimal 50 karakter, deskripsi 100, nama sparepart 30, dan catatan
persetujuan 100. Counter ditampilkan; perhitungan Unicode mengikuti validator backend.
Satu field invalid diberi border merah, getaran, dan pesan kecil. Jika beberapa
field invalid, seluruh border terkait merah tanpa getaran dengan satu pesan umum.
Fokus diarahkan ke field invalid pertama dan animasi mengikuti reduced motion.

Foto **opsional**, satu JPG/PNG per item, maksimal 2 MiB dan 10 foto per pengajuan.
Preview dapat diganti/dihapus sebelum submit; object URL dibersihkan setelah tidak
dipakai. SPV dapat memperbesar thumbnail; item tanpa foto tetap valid.
Tanpa foto API memakai JSON; dengan foto memakai FormData dan `photoKey` per item.
Browser menentukan multipart boundary. Setelah submit tidak ada penggantian foto.
Lihat [backend](backend.md#foto-sparepart-opsional).

## Menjalankan dan pengujian

Jalankan backend/database, lalu dari `frontend/`: `npm ci` dan `npm run dev`.
Frontend tersedia di http://localhost:5173; proxy `/api` ke http://127.0.0.1:3000.
`API_PROXY_TARGET` dapat mengubah target Vite. Mode Docker dan setup lengkap ada
di [README](../README.md#menjalankan-service).

Build/lint: `npm run build`, `npm run lint`. Unit test: `npm test`;
browser: `npm run test:e2e` (Chrome, atau `PLAYWRIGHT_CHANNEL=msedge`).
Suite frontend mencakup 16 unit dan 13 browser test; fixture browser terpisah dari
database aplikasi. Alur bisnis ada di [workflow](workflow.md) dan mekanisme
pergantian akun di [authentication](authentication.md).
