# Paket penyerahan technical test

Paket berupa ZIP source code. README utama memuat cara menjalankan, tech stack,
asumsi, struktur project, dan akun demo sesuai kebutuhan penyerahan.

## Isi

- Backend NestJS: source, lima migration, seed, konfigurasi, dan test.
- Frontend React/Vite: source, logo, konfigurasi, dan test.
- Docker Compose, Dockerfile, .env.example, README, dan dokumentasi teknis.

node_modules, build output, environment privat, database/volume, upload pengguna,
token session, hasil tes sementara, dan folder kerja tidak disertakan. Akun demo
serta schema dibuat otomatis; penerima tidak perlu memulihkan dump database.

## Verifikasi paket

ZIP diekstrak ke folder baru dan dijalankan dengan Docker Compose menggunakan
project serta port pengujian terpisah. Build backend/frontend berhasil dan tiga
service healthy. Lima migration terpasang otomatis. Health backend langsung dan
proxy frontend berhasil; CSP hadir. Login ketiga akun demo, daftar awal kosong,
logout/pencabutan session, dan penolakan akses tanpa login telah diperiksa.

Kedua jalur workflow lengkap sebelumnya lulus melalui UI Docker dengan API asli;
96 automated test juga lulus. Lihat [laporan hardening](HARDENING.md) dan
[panduan utama](../README.md). Project/volume tes dibersihkan; snapshot data utama
tetap identik. Paket disiapkan untuk dikirim oleh kandidat.
