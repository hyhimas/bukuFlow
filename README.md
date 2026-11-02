# BukuFlow — Sistem Manajemen Perpustakaan Modern Multi-Tenant

**BukuFlow** adalah platform manajemen sirkulasi perpustakaan modern berbasis multi-tenant yang dirancang untuk kecepatan transaksi kasir perpustakaan, akurasi perhitungan denda per eksemplar, kepatuhan aksesibilitas internasional (WCAG 2.1 AA), dan kemudahan integrasi perangkat keras (barcode scanner & printer termal).

> **Status Proyek**: Siap Produksi (Frontend 100% selesai, 120+ butir task audit tuntas, 0 error typecheck).

---

## 🛠️ Tech Stack & Ekosistem

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Library UI**: [React 19](https://react.dev/)
- **Bahasa**: [TypeScript 5](https://www.typescriptlang.org/) (Strict Mode)
- **Styling & Token**: [Tailwind CSS v4](https://tailwindcss.com/) dengan Semantic CSS Variables
- **HTTP Client**: [Axios](https://axios-http.com/) dengan Interceptor JWT, Session Renewal, dan Auto-Logout
- **Barcode & Label Generator**: `jsbarcode`, `qrcode`, `html5-qrcode` (kamera scanner)
- **Pengujian E2E & Unit**: [Playwright Test](https://playwright.dev/) & `@axe-core/playwright` (Aksesibilitas)
- **Ekspor Data**: `xlsx` (Ekspor Riwayat Transaksi ke Excel)

---

## 🚀 Panduan Memulai Cepat (*Quick Start*)

### 1. Prasyarat Sistem
- **Node.js**: Versi `20.x` atau lebih baru
- **Package Manager**: `npm` atau `pnpm`

### 2. Konfigurasi Variabel Lingkungan
Buat berkas `.env.local` pada direktori *root*:
```env
NEXT_PUBLIC_API_URL=https://api.office.teknologikartu.com/bukuflow
```

### 3. Instalasi Dependensi
```bash
npm install
```

### 4. Menjalankan Server Pengembangan
```bash
npm run dev
```
Aplikasi dapat diakses melalui peramban di: `http://localhost:3000`

### 5. Pengecekan Tipe Data (Typecheck) & Build Produksi
```bash
# Validasi TypeScript
npm run typecheck

# Build produksi
npm run build

# Menjalankan build produksi
npm start
```

---

## 👥 Hierarki Role & Hak Akses (RBAC)

BukuFlow mendukung arsitektur multi-tenant dengan pembagian hak akses terisolasi:

| Role | Cakupan Akses | Halaman Utama |
|---|---|---|
| **`SUPER_ADMIN`** | Pengelola Kantor Pusat (Office). Mengelola seluruh instansi mitra, konfigurasi lisensi, master buku global, dan pengguna tingkat instansi. | `/office/dashboard`<br>`/office/companies`<br>`/office/books`<br>`/office/loans` |
| **`COMPANY_ADMIN`** | Kepala Perpustakaan / Administrator Sekolah. Mengelola buku dan eksemplar instansi, staf perpustakaan, anggota, konfigurasi tarif denda & durasi pinjam. | `/dashboard`<br>`/master/books`<br>`/master/members`<br>`/settings/users`<br>`/settings/company` |
| **`STAFF`** | Petugas Sirkulasi Harian. Menangani peminjaman buku kilat, pengembalian buku, denda, dan pencetakan struk. | `/dashboard`<br>`/loans/new`<br>`/returns`<br>`/transactions` |

---

## ✨ Fitur-Fitur Kunci yang Telah Dibangun

### 1. Sirkulasi Peminjaman Kilat (< 15 Detik & Bebas Mouse)
- Terintegrasi langsung dengan pemindai barcode fisik USB/Bluetooth (< 30ms auto-submit).
- Dukungan navigasi keyboard penuh:
  - Tekan `/` di mana saja untuk memfokuskan pencarian.
  - Tekan `Ctrl + Enter` untuk eksekusi pencatatan peminjaman.
- Validasi instan: Kuota maksimal peminjaman anggota dan pembatasan anggota yang memiliki pinjaman menunggak (*overdue*).

### 2. Pengembalian Fleksibel & Perhitungan Denda Proporsional Per-Eksemplar
- Sesuai standar perpustakaan modern, denda dihitung **adil per eksemplar buku** berdasarkan tanggal pengembalian masing-masing (bukan meratakan seluruh transaksi).
- Logika matematis tersentralisasi di `src/lib/circulation.ts`:
  - `hari_terlambat = max(0, tanggal_kembali - tanggal_jatuh_tempo)`
  - `denda_eksemplar = hari_terlambat × tarif_denda_per_hari`
- Mendukung **Pengembalian Sebagian (*Partial Return*)**: Buku yang dikembalikan lebih awal berhenti menghitung denda, sedangkan buku yang belum kembali tetap berjalan.
- Mendukung **Mode Kotak Pengembalian (*Book Drop / Past Date*)**: Petugas dapat memilih tanggal fisik buku diterima di kotak pengembalian lampau (kemarin/akhir pekan) dengan kalkulasi denda yang akurat.

### 3. Cetak Barcode Label & Struk Termal Kasir
- **Cetak Struk Termal**: Diformat khusus kertas kasir 58mm / 80mm via dialog cetak browser (`@media print`), memuat nomor pinjam, nama anggota, rincian buku, tanggal jatuh tempo, dan rincian denda.
- **Cetak Label Barcode Buku**: Pilihan format stiker label 3×2 cm dan layout grid multi-eksemplar lengkap dengan kode ISBN / Call Number.

### 4. Laporan & Riwayat Transaksi
- Filter rentang tanggal pinjam, tanggal jatuh tempo, tanggal kembali, dan status (`ACTIVE`, `OVERDUE`, `COMPLETED`).
- Paginasi standar **10 data per halaman** untuk optimalisasi performa.
- Tombol **Ekspor Excel (`.xlsx`)** instan dengan opsi periode (7 hari, 1 bulan, 1 tahun, atau kustom).

### 5. Desain & Aksesibilitas Internasional (WCAG 2.1 AA)
- **Aksesibilitas Keyboard**: Dilengkapi tautan loncat (*Skip to Content*) `#main-content`, penahan fokus modal (*focus trap*), dan tombol Escape untuk menutup dialog/drawer.
- **Rasio Kontras Tinggi**: Seluruh teks telah memenuhi rasio kontras $\ge 4.5:1$ (bebas dari teks buram `text-slate-400`).
- **Target Sentuh**: Seluruh tombol paginasi dan aksi memenuhi target sentuh minimum $\ge 40$px.
- **Dark Mode Penuh**: Didukung token variabel semantik CSS `[data-theme="dark"]` dengan tombol pengalih tema instan di bilah navigasi.
- **Ikon Mata Password**: Fitur lihat/sembunyikan kata sandi dengan ikon Heroicons v2 proporsional pada Login, Modal Perpanjang Sesi, dan Tambah Pengguna.

---

## 📁 Struktur Direktori Proyek

```text
src/
├── app/                        # Next.js App Router (Halaman & Rute)
│   ├── dashboard/              # Dasbor staf & admin instansi (Worklist denda & 10 transaksi terakhir)
│   ├── loans/                  # Sirkulasi peminjaman (/loans/new untuk form kilat)
│   ├── returns/                # Sirkulasi pengembalian & denda
│   ├── transactions/           # Riwayat transaksi & ekspor Excel
│   ├── master/                 # Master data buku & anggota instansi
│   ├── settings/               # Konfigurasi instansi & manajemen pengguna
│   ├── office/                 # Panel Superadmin Multi-Tenant (Instansi, Buku Pusat, Laporan)
│   ├── login/                  # Autentikasi & proteksi sesi
│   └── globals.css             # Semantic Design Tokens (Light & Dark theme)
├── components/                 # Komponen Antarmuka Reusable
│   ├── barcode/                # Generator label barcode canvas & modal cetak
│   ├── members/                # Manajemen anggota (Staff & Office View)
│   ├── office/                 # Komponen khusus panel pusat (CompanySwitcher, dll)
│   ├── ui/                     # Desain Sistem: Button, Input, Modal, DataTable, AppShell, dll
│   └── users/                  # Manajemen pengguna staf & admin
├── hooks/                      # Custom React Hooks (useHotkeys, dll)
├── context/                    # React Context (ThemeContext)
└── lib/                        # Modul Logika & Integrasi
    ├── api.ts                  # Axios Client, Interceptor, & API Endpoints
    ├── auth.ts                 # Manajemen Token JWT, Sesi, & LocalStorage
    ├── authorization.ts        # Guard Rute & Hak Akses Role
    ├── circulation.ts          # Formula Kalkulasi Sirkulasi & Denda Per-Eksemplar
    └── types.ts                # TypeScript Interfaces & Data Models
```

---

## 📌 Catatan Teknis untuk Pengembang Penerus (*Handover Notes*)

Bagi pengembang yang akan melanjutkan atau memelihara repositori ini:

1. **Logika Denda Per Eksemplar (`src/lib/circulation.ts`)**:
   - Jika ada perubahan aturan denda dari instansi (misal hari libur nasional tidak dihitung denda), modifikasi terpusat pada fungsi `calculateOverdueDays()` di berkas ini. Komponen UI akan otomatis mengikuti.

2. **Dukungan Integrasi Endpoint Backend yang Ditunggu**:
   - **Lookup Barcode Eksemplar Tunggal**: Saat ini halaman `/loans/new` melakukan lookup eksemplar menggunakan cache katalog buku lokal. Jika backend FastAPI nanti telah menyediakan endpoint `GET /book-copies?code={barcode}`, integrasi dapat langsung diarahkan pada fungsi `handleScanCode` di `src/app/loans/new/page.tsx`.
   - **Format Cetak Fisik Kartu Anggota**: Modul cetak barcode kartu anggota sudah tersedia di `src/components/barcode/BookBarcodePrintModal.tsx`. Pengembang berikutnya hanya perlu menyesuaikan tata letak CSS jika mentor telah menetapkan jenis blangko kartu fisik (kartu PVC ID-card atau stiker).

3. **Manajemen Sesi Otomatis**:
   - Sesi token JWT diperiksa otomatis oleh `AppShell.tsx`. Peringatan perpanjang sesi muncul 5 menit sebelum sesi berakhir. Petugas dapat memperpanjang sesi langsung di tempat (*in-place*) tanpa me-refresh atau kehilangan data formulir yang sedang diketik.

---

## 🧪 Pengujian Otomatis (*Testing*)

Proyek ini telah dilengkapi dengan rangkaian pengujian otomatis unit & *End-to-End* (Playwright):

```bash
# Menjalankan pengujian logika kalkulasi denda & sirkulasi
npx playwright test tests/circulation.test.ts

# Menjalankan seluruh pengujian E2E (Roles, Keyboard, Alur Sirkulasi)
npm run test:e2e
```

---

**BukuFlow** — *Dikembangkan dengan dedikasi untuk efisiensi, akurasi, dan kenyamanan pustakawan.*
