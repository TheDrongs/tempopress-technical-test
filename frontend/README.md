# Frontend

React + TypeScript + Vite dengan Tailwind, komponen pola shadcn/Radix, Axios,
Zustand, dan React Router. Lihat [README utama](../README.md) untuk setup lengkap
dan [dokumentasi frontend](../docs/frontend.md) untuk struktur dan alur UI.

```sh
npm ci
npm run dev
```

`/work-orders` menampilkan list. `/work-orders/:id` menampilkan modal detail sebagai
child route, termasuk ketika URL dibuka langsung atau di-refresh. Create,
submit, assignment, persiapan, pengajuan foto opsional, approval, start, dan
completion sudah terhubung ke backend melalui proxy /api.

Login dengan akun demo pada README utama; gunakan dropdown di bawah username untuk login role lain melalui popup.
Password salah/cancel mempertahankan session lama; sukses mengganti session. Admin
menyelesaikan WO dengan mengisi waktu selesai setelah mechanic mulai bekerja.
Pagination tersedia untuk semua role: default lima baris, pilihan 5/10/20,
indikator Page X of Y, serta tombol sebelum/berikutnya. Ringkasan tugas tetap
menghitung seluruh daftar yang boleh dilihat. Token session berada di cookie
HttpOnly; tidak disimpan di localStorage. Logout mengosongkan cache WO.

```sh
npm run build
npm run lint
npm test
npm run test:e2e
```

Tes browser memakai Vite port 5174 dan Chrome terpasang. Untuk Edge, set
PLAYWRIGHT_CHANNEL=msedge pada environment. Fixture API pada suite Playwright
terisolasi dari database aplikasi. Smoke test UI dengan API asli juga sudah
dijalankan; data dan file uji telah dibersihkan.
