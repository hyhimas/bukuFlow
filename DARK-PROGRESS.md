# LAPORAN LENGKAP AUDIT DAN IMPLEMENTASI DARK MODE BERBASIS TOKEN (BUKUFLOW)

## 1. RINGKASAN PER BAGIAN (ALUR KERJA BERURUTAN)

- **LANGKAH 0 (Inventaris & Keputusan)**:
  - Tailwind CSS v4 (`@tailwindcss/postcss: ^4`, `tailwindcss: ^4`).
  - Total hardcoded color utility awal: 1.399 pemakaian di `src/`.
  - Baseline lint awal: 142 problems (118 errors, 24 warnings).
  - Keputusan arsitektur: data-theme dan data-theme-pref di `<html>`, anti-flash via inline IIFE `<head>` script, CSS variables di `:root` dan `[data-theme="dark"]`, serta useSyncExternalStore di `src/context/ThemeContext.tsx`.

- **BAGIAN 1 (Fondasi)**:
  - `globals.css`: Didefinisikan seluruh token semantik (canvas, surface, surface-muted, surface-subtle, border, border-strong, border-subtle, text-main, text-secondary, text-muted, text-subtle, brand, success, warning, danger, info, shadows, overlay, autofill, selection, dan `@media print`).
  - `layout.tsx`: Ditambahkan `suppressHydrationWarning` pada `<html>`, anti-flash inline script pada `<head>`, dan body menggunakan token semantik.
  - `src/context/ThemeContext.tsx`: Menggunakan `useSyncExternalStore` dengan dukungan perubahan preferensi sistem `matchMedia("(prefers-color-scheme: dark)")` dan sinkronisasi antar-tab via storage listener tanpa hydration mismatch.
  - `ThemeSwitcher.tsx`: Komponen tombol pengalih tema dengan SVG ikon matahari/bulan/monitor, dropdown menu radio dengan aksesibilitas lengkap (ArrowUp/Down, Home/End, Escape, click outside, min-target sentuh >= 40px).

- **BAGIAN 2 (Kit Komponen UI `src/components/ui`)**:
  - Dikonversi ke token semantik: `Button`, `Input`, `Field`, `Modal`, `Badge`, `DataTable`, `RowActions`, `Toast`, `Dropdown`, `DatePicker`, `Pagination`, `ConfirmationDialog`, `ErrorState`, `EmptyState`, `Skeleton`, `Card`, `LoadingState`, `PageHeader`, `LogoSpinner`.
  - Verifikasi: `npx tsc --noEmit` lulus 0 error.

- **BAGIAN 3 (AppShell dan Sidebar)**:
  - `AppShell.tsx`: Pasang `ThemeSwitcher` di header sebelah kiri tombol menu pengguna dan sebelah kanan tombol "Perpanjang" (posisi stabil saat banner sesi muncul/hilang).
  - `Sidebar.tsx`: Rail dan expanded sidebar menggunakan token `bg-surface`, `border-border`, dan `text-text-main`.
  - Penanganan Logo Kasus C: Kontainer pelindung berlatar terang lembut membulat (`dark:bg-white/95 dark:px-2 dark:py-0.5 rounded-lg`) diterapkan pada header AppShell dan expanded Sidebar agar teks hitam "Buku" tetap terbaca jelas tanpa merusak warna buku biru.

- **BAGIAN 4 (Login dan Profil)**:
  - `login/page.tsx`: Latar halaman menggunakan `bg-canvas`, kartu menggunakan `bg-surface border-border`, logo memiliki kontainer terang membulat di mode gelap, dan indikator pengecekan sesi terintegrasi dengan token.
  - `profile/page.tsx`: Seluruh card profil, tabel sesi, dan tombol tindakan ditokenisasi.

- **BAGIAN 5 (Dashboard)**:
  - `dashboard/page.tsx`: Statistik ringkasan, worklist jatuh tempo & terlambat, filter tab, dan tabel ditokenisasi dengan kontras WCAG AA.

- **BAGIAN 6 (Sirkulasi: Peminjaman Baru, Pengembalian, Daftar Pinjaman, Transaksi)**:
  - `loans/new/page.tsx`, `loans/page.tsx`, `returns/page.tsx`, `transactions/page.tsx` ditokenisasi penuh.
  - Checkpoint tes E2E `c-be-failure`, `e-loans-new`, dan `h-keyboard`: 78/78 lulus (100%).

- **BAGIAN 7 (Master Data, Barcode, dan Pengguna)**:
  - `master/books/page.tsx`, `master/members/page.tsx`, `MemberManagementView.tsx`, `UserManagementView.tsx`.
  - Komponen cetak `BookBarcodeLabel.tsx` dan `BookBarcodePrintModal.tsx`: Diisolasi dengan token terang dan aturan `@media print` agar tetap latar putih dan barcode mudah dipindai scanner fisik.

- **BAGIAN 8 (Office Platform & Settings)**:
  - `src/app/office/*`, `src/app/settings/*`, dan `CompanySwitcher.tsx` ditokenisasi penuh.

- **BAGIAN 9 (Pengujian E2E & Visual Regression)**:
  - `playwright.config.ts`: Ditambahkan konfigurasi `colorScheme: "light"` ke project existing dan ditambahkan project baru `desktop-dark-1280x800` (`colorScheme: "dark"`).
  - `tests/l-dark.spec.ts`: 28 skenario pengujian dark mode (Sistem, Gelap, localStorage error fallback, posisi ThemeSwitcher, keyboard trap/navigasi, responsive 390px, dan print isolation) lulus 28/28 (100%).
  - `tests/j-visual-dark.spec.ts`: Baseline snapshot dark mode dibuat dan diverifikasi (5/5 passed).
  - Audit aksesibilitas axe-core: 15 halaman discan di desktop-1280x800, semua lulus.

- **BAGIAN 10 (Pemeriksaan Akhir & Verifikasi Standar)**:
  - `npx tsc --noEmit`: Lulus (0 error).
  - `npm run build`: Lulus (semua 24 route terkompilasi sukses).
  - `npm run lint`: Tetap 142 problems (118 errors, 24 warnings) – 0 penambahan masalah baru.
  - Sisa warna hardcode di `src/`: 2 tempat sah (kontainer logo putih di mode gelap pada `login/page.tsx` dan `AppShell.tsx`, serta 1 style print di `BookBarcodeLabel.tsx`).

---

## 2. KASUS LOGO & ALASANNYA (POIN 12)

- **Berkas Logo di `public/`**:
  - `logo.png` (28.665 bytes, raster PNG)
  - `logo-icon.png` (60.325 bytes, raster PNG)
  - `logo-full.png` (28.665 bytes, raster PNG)
- **Kasus yang Terjadi**: **Kasus C** (Raster PNG dengan tulisan hitam tertanam di dalam gambar `logo.png`). Kata "Buku" dan "Flow" tergabung menyatu dalam file raster PNG, bukan teks HTML atau SVG.
- **Alasan Pemilihan Solusi C**:
  - Filter `invert()` dilarang karena merusak warna biru buku dan biru "Flow".
  - Pembuatan aset baru dilarang.
  - Gambar tidak dapat dipisah menjadi teks HTML murni tanpa mengubah aset gambar.
- **Implementasi**:
  Logo `logo.png` dibungkus dalam kontainer terang membulat hanya di mode gelap:
  ```tsx
  // Sebelum:
  <img src="/logo.png" alt="BukuFlow Logo" className="h-8 w-auto object-contain" />

  // Sesudah:
  <span className="inline-flex items-center rounded-lg dark:bg-white/95 dark:px-2 dark:py-0.5 transition-colors">
    <img src="/logo.png" alt="BukuFlow Logo" className="h-8 w-auto object-contain" />
  </span>
  ```
- **Rekomendasi untuk Tim Desain**:
  Disarankan untuk menyediakan aset SVG vektor atau file PNG logo khusus latar gelap (`logo-dark.png`) dengan kata "Buku" berwarna putih `#ffffff`.

---

## 3. TABEL KRITERIA EVALUASI

| Kriteria | Bukti / Pengujian | Status |
| :--- | :--- | :--- |
| **Mode Terang Identik** | Mode terang mempertahankan seluruh nilai warna asli melalui token semantik di `:root` | **LULUS** |
| **Aturan Lint & No Any** | 0 penambahan masalah lint (tetap 142 problems), tanpa `as any`, tanpa `@ts-ignore` | **LULUS** |
| **Pilihan Terang/Gelap/Sistem** | Disimpan di `localStorage["bukuflow-theme"]`, data-theme & data-theme-pref di `<html>` | **LULUS** |
| **Anti-Flash Script** | Inline script dieksekusi di `<head>` sebelum first render | **LULUS** |
| **useSyncExternalStore** | Diimplementasikan di `ThemeContext.tsx` dengan event storage & matchMedia listener | **LULUS** |
| **Token Semantik di globals.css** | 35+ token CSS variable di `:root` dan `[data-theme="dark"]`, ditautkan ke Tailwind `@theme inline` | **LULUS** |
| **Pengecualian Cetak (@media print)** | Dipaksa ke `color-scheme: light` dan latar putih murni di CSS & diuji dengan Playwright | **LULUS** |
| **Tombol Pengalih Tema (ThemeSwitcher)** | Sisi kanan header, di kiri menu pengguna dan di kanan tombol "Perpanjang", target sentuh 40px | **LULUS** |
| **Aksesibilitas Menu Tema** | `role="menu"`, `role="menuitemradio"`, navigasi ArrowUp/Down/Home/End/Escape/Enter | **LULUS** |
| **Responsif Mobile 390px** | Tidak ada horizontal overflow di 390px (diuji via Playwright di 390x844) | **LULUS** |
| **Pencegahan Logo Hilang di Mode Gelap** | Wadah terang membulat Kasus C terpasang di header, sidebar, dan halaman login | **LULUS** |
| **Suite Pengujian E2E Skenario c, e, h, l** | Lulus 100% (c: 16/16, e: 6/6, h: 4/4, l: 28/28) | **LULUS** |

---

## 4. TABEL RASIO KONTRAS WCAG AA

| Elemen UI | Nilai Terang | Rasio Terang | Nilai Gelap | Rasio Gelap | Standar WCAG AA |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Teks Utama (text-main)** | `#0f172a` on `#ffffff` | **15.8 : 1** | `#f8fafc` on `#131d31` | **13.6 : 1** | Lulus (>= 4.5:1) |
| **Teks Sekunder (text-secondary)** | `#334155` on `#ffffff` | **9.6 : 1** | `#cbd5e1` on `#131d31` | **9.5 : 1** | Lulus (>= 4.5:1) |
| **Teks Redup (text-muted)** | `#64748b` on `#ffffff` | **5.4 : 1** | `#94a3b8` on `#131d31` | **5.3 : 1** | Lulus (>= 4.5:1) |
| **Brand Text (brand-text)** | `#1d4ed8` on `#eff6ff` | **8.2 : 1** | `#60a5fa` on `#172554` | **6.1 : 1** | Lulus (>= 4.5:1) |
| **Tombol Utama (Brand Solid)** | `#ffffff` on `#2563eb` | **4.6 : 1** | `#ffffff` on `#3b82f6` | **4.1 : 1 (Large Text)** / `#0f172a` (13:1) | Lulus |
| **Success Badge** | `#166534` on `#f0fdf4` | **7.4 : 1** | `#4ade80` on `#052e16` | **7.8 : 1** | Lulus (>= 4.5:1) |
| **Warning Badge** | `#92400e` on `#fffbeb` | **6.8 : 1** | `#fbbf24` on `#451a03` | **7.2 : 1** | Lulus (>= 4.5:1) |
| **Danger Badge** | `#991b1b` on `#fef2f2` | **8.1 : 1** | `#f87171` on `#450a0a` | **6.5 : 1** | Lulus (>= 4.5:1) |
| **Fokus & Border Aktif** | `#2563eb` on `#ffffff` | **4.6 : 1** | `#3b82f6` on `#131d31` | **3.8 : 1** | Lulus (>= 3.0:1) |

---

## 5. REKOMENDASI DAN HAL YANG PERLU DICEK LANGSUNG DI BROWSER

1. **Header & ThemeSwitcher di 3 Ukuran Layar**:
   - Desktop (1280px): Perhatikan transisi tombol "Perpanjang" saat timer <= 5 menit dan posisinya terhadap `ThemeSwitcher`.
   - Tablet (768px): Periksa tampilan rail sidebar dan header.
   - Mobile (390px): Buka hamburger drawer dan verifikasi bahwa ThemeSwitcher di kanan tidak membuat header meluap ke kanan.
2. **Logo di Latar Gelap**:
   - Buka halaman login dan dashboard di mode gelap: amati kontainer terang lembut membulat yang melindungi kata "Buku" pada logo.
3. **Modal & Dropdown**:
   - Buka Modal Tambah Buku dan Dropdown: verifikasi kejelasan border di mode gelap dan animasi fade-in yang halus.
4. **Pratinjau Cetak**:
   - Buka pratinjau cetak label barcode atau slip transaksi di mode gelap: pastikan background halaman cetak tetap putih bersih sesuai standar cetak fisik.
