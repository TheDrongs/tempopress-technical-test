# Workflow Work Order

Sistem menangani WO dengan tiga role: Admin, SPV, dan Mechanic. Login memakai
akun demo; detail ditampilkan sebagai modal pada list. Cara menjalankan aplikasi
ada di [README](../README.md#menjalankan-service).

## Peran dan akses

| Role | Tanggung jawab dan akses |
| --- | --- |
| Admin | Membuat/submit WO, menyiapkan pekerjaan/pengajuan sparepart, memasukkan waktu selesai; melihat semua WO |
| SPV | Meninjau lalu menugaskan mechanic dan menyetujui sparepart; hanya WO non-draft yang dikirim kepadanya |
| Mechanic | Memulai pekerjaan yang sudah siap; hanya WO yang ditugaskan kepadanya, termasuk riwayat selesai |

Satu WO memiliki satu SPV tujuan dan satu mechanic. SPV tunggal dipilih otomatis;
jika beberapa tersedia, Admin memilih tujuan saat submit. Akses list/detail/foto
dan izin aksi ditegakkan backend, termasuk ketika caller memakai API langsung.

## Alur lengkap dan status

| Tahap | Pelaku/aksi | Status WO berikutnya |
| --- | --- | --- |
| Buat | Admin mengisi judul wajib dan deskripsi opsional, lalu menyimpan | DRAFT |
| Submit | Admin membuka draft dan memilih Submit Work Order dengan SPV tujuan | SUBMITTED |
| Tinjau/assign | SPV tujuan meninjau lalu memilih mechanic | ASSIGNED |
| Persiapan tanpa sparepart | Admin meninjau/memperbarui informasi dan menyelesaikan persiapan | READY_TO_WORK |
| Persiapan dengan sparepart | Admin mengirim pengajuan minimal satu item, foto opsional | WAITING_SPAREPART_APPROVAL |
| Approval sparepart | SPV tujuan menyetujui request PENDING dengan catatan opsional | READY_TO_WORK setelah tidak ada request pending |
| Mulai bekerja | Mechanic yang ditugaskan memulai WO siap dikerjakan | WORKING |
| Completion | Admin memasukkan waktu selesai yang valid dan menyelesaikan WO | COMPLETED |

UI **Menunggu Approval SPV** berarti `SUBMITTED`: peninjauan dan penugasan mechanic
adalah langkah SPV berikutnya, tanpa endpoint approval WO tambahan.
Assignment belum berarti pekerjaan dimulai; persiapan Admin tetap diperlukan.

```text
Tanpa sparepart:
DRAFT -> SUBMITTED -> ASSIGNED -> READY_TO_WORK -> WORKING -> COMPLETED

Dengan sparepart:
DRAFT -> SUBMITTED -> ASSIGNED -> WAITING_SPAREPART_APPROVAL
      -> READY_TO_WORK -> WORKING -> COMPLETED
```

Request sparepart memiliki status terpisah: PENDING → APPROVED. Pengajuan
menyimpan pemohon, items, pemberi approval, dan catatan opsional. Database mendukung
beberapa request per WO; flow demo membuat pengajuan saat persiapan ASSIGNED.
Approval memeriksa seluruh request terkait sebelum WO dinyatakan siap.

## Aturan dan asumsi

- Create dan submit adalah aksi terpisah; draft tidak terlihat oleh SPV/Mechanic.
- Admin menyiapkan judul/deskripsi serta keputusan kebutuhan sparepart setelah
  assignment. Tanpa sparepart tidak dibuat request kosong.
- Qty item integer positif. Foto/deskripsi/catatan persetujuan tidak wajib.
- Mechanic tidak dapat mulai sebelum persiapan dan approval yang diperlukan selesai.
- Backend mencatat `start_date` ketika mechanic mulai bekerja. Admin mengisi
  `end_date` yang tidak lebih awal dari start; input lokal dikirim sebagai ISO ber-timezone.
- COMPLETED mengunci aksi progres. Aksi pada status salah atau pengulangan ditolak.
- Tidak ada rejection, revisi approval, penerimaan barang, cancellation, reopen,
  audit log proses khusus, atau modul ERP lain dalam scope demo.

## Tambahan terhadap workflow inti

**Foto opsional** membantu SPV mengenali kebutuhan secara visual dan mempermudah
validasi/UX. Satu JPG/PNG per item, maksimal 2 MiB dan 10 foto per pengajuan;
tanpa foto proses tetap berjalan. Detail ada di [backend](backend.md#foto-sparepart-opsional)
dan [database](database.md#foto-sparepart-opsional).

**Authentication bonus** memastikan role sesuai akun terverifikasi. Dropdown role
memerlukan login melalui popup; gagal/cancel mempertahankan session lama dan
sukses menggantinya. Detail ada di [authentication](authentication.md).

**UX pendukung:** popup sukses di depan detail blur kembali ke list setelah
ditutup; validasi gagal mempertahankan form. Panel perhatian mengikuti tugas role,
dan pagination 5/10/20 memakai daftar yang sudah dibatasi backend.

## Cakupan verifikasi

Kedua jalur sampai COMPLETED diperiksa melalui UI Docker dengan API/PostgreSQL
asli, termasuk foto, preview, persetujuan, session, dan persistensi. Catatan
verifikasi terakhir mencakup 96 automated test: 2 health, 65 integrasi backend,
16 unit frontend, dan 13 browser. Ringkasan ini tidak mengulang riwayat checklist
per tahap; lokasi/perintah suite dijelaskan pada [backend](backend.md) dan
[frontend](frontend.md).
