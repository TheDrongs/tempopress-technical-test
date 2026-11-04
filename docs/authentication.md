# Authentication

Autentikasi adalah bonus yang dipilih dalam implementasi. Tujuannya memastikan
role berasal dari akun terverifikasi, bukan sekadar pilihan dropdown. Tidak ada
registrasi atau pengelolaan akun di luar kebutuhan demo.

## Akun demo

| Role | Username | Password |
| --- | --- | --- |
| ADMIN | `admin` | `admin123` |
| SPV | `spv` | `spv123` |
| MECHANIC | `mekanik` | `mekanik123` |

Akun dibuat otomatis melalui seed. Password disimpan sebagai hash scrypt dengan
salt acak; setup ulang tidak menimpa kredensial yang sudah dikustomisasi.

## Endpoint

| Endpoint | Akses/input | Hasil |
| --- | --- | --- |
| POST `/api/auth/login` | Public; username/password | 200, user summary dan cookie |
| GET `/api/auth/me` | Session aktif | 200, id/name/role |
| POST `/api/auth/switch` | Session aktif; username/password/expectedRole | 200, user tujuan dan cookie baru |
| POST `/api/auth/logout` | Session aktif | 204, session dicabut dan cookie dihapus |

Selain health dan login, endpoint bisnis serta foto memerlukan session valid.
Login salah/session hilang, kedaluwarsa, atau tidak valid menghasilkan 401.
Role diambil ulang dari database; `X-User-Id` tidak menentukan identitas.

## Siklus session

1. Login memverifikasi hash password lalu membuat token acak 256-bit.
2. Cookie `tempopress_session` memakai HttpOnly, SameSite=Lax, Path=/api, dan
   masa berlaku delapan jam. Token mentah hanya dikirim melalui cookie;
   `auth_sessions.token_hash` menyimpan SHA-256 token.
3. Global AuthGuard memeriksa session/user sebelum menjalankan API privat.
   Service memeriksa role, status, dan penugasan untuk aksi bisnis.
4. Frontend memanggil `/auth/me` saat dimuat ulang. Password/token tidak disimpan
   di localStorage/Zustand. Respons privat tidak di-cache.
5. Logout mencabut token terkait; expiry membersihkan state/cache dan mengarah
   ke login. Session kedaluwarsa dibersihkan saat login berikutnya.

Cookie Secure default false untuk localhost HTTP. Pada HTTPS, atur
`AUTH_COOKIE_SECURE=true`; konfigurasi ini diteruskan Compose dari `.env`.

## Pergantian role melalui popup

Dropdown di bawah username membuka popup login. Username demo tujuan diisi
sebagai bantuan dan password kosong; pengguna tetap harus memasukkan kredensial.

```json
{"username":"spv","password":"spv123","expectedRole":"SPV"}
```

`expectedRole` hanya ADMIN/SPV/MECHANIC. Password salah menghasilkan 401 dan
role akun tidak cocok menghasilkan 403; keduanya tidak mencabut session lama.
Pembatalan popup juga mempertahankan session. Session lama harus masih valid.

Setelah kredensial serta role tujuan valid, backend mencabut token lama dan
menyimpan token baru dalam satu transaksi. Kegagalan insert di-rollback;
dua switch bersamaan tidak dapat memakai session lama yang sama. Cookie diganti
hanya setelah berhasil. Frontend membersihkan cache WO, menutup popup, dan
membuka `/work-orders` pada panel akun baru. Respons 401 request akun lama
tidak boleh menghapus session baru; request memakai penanda generasi session.

UI menampilkan nama/role dan warna sidebar sesuai akun aktif. Hak akses tidak
berasal dari warna, tombol, atau dropdown: backend tetap memverifikasinya.
Lihat [workflow](workflow.md) untuk peran setiap akun dan [security](security.md)
untuk kontrol origin, input, serta akses foto.
