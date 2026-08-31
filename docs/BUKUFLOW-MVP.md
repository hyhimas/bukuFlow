# BukuFlow MVP

Dokumen ini adalah dokumentasi resmi implementasi frontend MVP BukuFlow berdasarkan source code aktual di repository. Dokumen ini tidak menambahkan klaim fitur di luar implementasi.

Catatan audit: file `TASK FRONTEND BUKUFLOW - MAGANG.md` tersedia dan digunakan sebagai dasar evaluasi. File PRD, Design Requirements, dan Alur Penggunaan Sistem tidak ditemukan di repository saat audit lokal, sehingga detail di dokumen ini tetap dibatasi pada task yang tersedia dan source code aktual.

## 1. Scope MVP

BukuFlow adalah frontend MVP untuk pencatatan operasional perpustakaan.

Scope yang didukung source code:

- Login dummy.
- Dashboard.
- Pencatatan peminjaman.
- Pencatatan pengembalian.
- Riwayat transaksi.
- Mock API dan mock data in-memory.
- Dummy session berbasis `localStorage`.

Di luar scope implementasi saat ini:

- Backend.
- API route backend.
- FastAPI.
- MongoDB.
- CRUD master buku.
- CRUD master anggota di luar flow pembuatan anggota saat peminjaman.

## 2. Struktur Project Relevan

- `src/app/login/page.tsx`: halaman login dummy.
- `src/app/dashboard/page.tsx`: dashboard.
- `src/app/loans/new/page.tsx`: form peminjaman.
- `src/app/returns/page.tsx`: form pengembalian.
- `src/app/transactions/page.tsx`: riwayat transaksi.
- `src/app/layout.tsx`: root layout dan metadata.
- `src/lib/auth.ts`: helper dummy session.
- `src/lib/mock-api.ts`: abstraction mock API.
- `src/lib/mock-data.ts`: data dummy in-memory.
- `src/lib/types.ts`: tipe data domain.
- `src/components/ui/Button.tsx`: button reusable.
- `src/components/ui/Input.tsx`: input reusable.
- `src/components/ui/Card.tsx`: card reusable.
- `src/components/ui/Badge.tsx`: badge status reusable.

## 3. Dummy Login

Credential yang tersedia di `mock-data.ts` dan dipakai oleh `login` di `mock-api.ts`:

| Role | Email | Password |
| --- | --- | --- |
| `COMPANY_ADMIN` | `admin@bukuflow.id` | `admin123` |
| `STAFF` | `staff@bukuflow.id` | `admin123` |

Role `MEMBER` tersedia pada tipe `UserRole`, tetapi tidak digunakan untuk login MVP.

Credential demo hanya ditampilkan di halaman login ketika `process.env.NODE_ENV === "development"`.

## 4. Dummy Session

Session dummy berada di `src/lib/auth.ts`.

```ts
const SESSION_KEY = "bukuflow_session";

export interface Session {
  user: User;
}
```

Function session:

- `getSession()`: membaca session dari `localStorage`.
- `setSession(user)`: menyimpan `{ user }` ke `localStorage`.
- `clearSession()`: menghapus session dari `localStorage`.

Dashboard memanggil `getSession()`. Jika session tidak ada, user diarahkan ke `/login`. Logout di dashboard memanggil `clearSession()` lalu `router.replace("/login")`.

## 5. Mock API

Mock API berada di `src/lib/mock-api.ts` dan dipanggil dari halaman UI. Implementasi saat ini tidak memanggil FastAPI, MongoDB, atau API route backend.

Function yang tersedia:

- `login`
- `getDashboard`
- `searchMembers`
- `createMember`
- `searchBooks`
- `getBookCopies`
- `getActiveLoans`
- `createLoan`
- `getTransactions`
- `getReturnLoans`
- `returnLoanItems`

Catatan penting: abstraction mock API memang ada karena halaman memanggil function di `mock-api.ts`. Namun beberapa function masih membaca company dari `mockCompany` statis, bukan dari session aktif. Jadi penggantian ke backend bisa dilakukan dari data layer, tetapi integrasi production tetap membutuhkan penyesuaian autentikasi, company scope, dan user context.

## 6. Mock Data

Mock data berada di `src/lib/mock-data.ts`.

Data yang tersedia:

- `mockCompany`
- `mockCompany2`
- `mockCompanySettings`
- `mockCompanySettings2`
- `mockUsers`
- `mockMembers`
- `mockBooks`
- `mockBookCopies`
- `mockLoans`
- `mockLoanItems`
- `mockAuditLogs`

Data company kedua tersedia di mock data, tetapi function mock API operasional saat ini memfilter ke `mockCompany` atau `company-001`.

## 7. Type Data

Tipe domain berada di `src/lib/types.ts`.

Tipe status:

```ts
export type UserRole =
  | "SUPER_ADMIN"
  | "COMPANY_ADMIN"
  | "STAFF"
  | "MEMBER";

export type BookStatus =
  | "AVAILABLE"
  | "BORROWED"
  | "INACTIVE";

export type BookCopyStatus =
  | "AVAILABLE"
  | "BORROWED"
  | "INACTIVE"
  | "LOST";

export type LoanStatus =
  | "ACTIVE"
  | "OVERDUE"
  | "COMPLETED"
  | "CANCELLED";

export type LoanItemStatus =
  | "BORROWED"
  | "RETURNED";
```

Entity utama yang tersedia:

```ts
export interface User {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  username: string;
  passwordHash?: string;
  role: UserRole;
  status: UserStatus;
  externalUserId?: string;
  externalSource?: string;
  identitySyncStatus?: string;
  lastSyncedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  companyId: string;
  memberNumber: string;
  name: string;
  memberType?: string;
  identityNumber: string;
  phone: string;
  email?: string;
  status: MemberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  companyId: string;
  code: string;
  isbn?: string;
  title: string;
  author?: string;
  publisher?: string;
  publicationYear?: number;
  category?: string;
  coverUrl?: string;
  status: BookStatus;
  totalCopies: number;
  availableCopies: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookCopy {
  id: string;
  companyId: string;
  bookId: string;
  code: string;
  status: BookCopyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  companyId: string;
  loanNumber: string;
  memberId: string;
  borrowedBy: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt?: string;
  status: LoanStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanItem {
  id: string;
  companyId: string;
  loanId: string;
  bookId: string;
  bookCopyId: string;
  returnedAt?: string;
  status: LoanItemStatus;
  createdAt: string;
  updatedAt: string;
}
```

Composite response:

```ts
export interface ReturnLoanItem {
  loanItem: LoanItem;
  book: Book;
  bookCopy: BookCopy;
}

export interface ReturnLoanData {
  loan: Loan;
  member: Member;
  items: ReturnLoanItem[];
}

export interface TransactionLoanItem {
  loanItem: LoanItem;
  book: Book;
  bookCopy: BookCopy;
}

export interface TransactionData {
  loan: Loan;
  member: Member;
  user: User;
  items: TransactionLoanItem[];
}
```

## 8. BookCopy

Implementasi memisahkan `Book` dan `BookCopy`.

- `Book.id` adalah identitas judul buku.
- `BookCopy.id` adalah identitas copy fisik.
- `BookCopy.bookId` menghubungkan copy ke judul buku.
- `LoanItem.bookCopyId` menyimpan copy yang dipinjam.

Status `BookCopy` aktual:

- `AVAILABLE`
- `BORROWED`
- `INACTIVE`
- `LOST`

Pada peminjaman, hanya copy dengan status `AVAILABLE` yang dapat dipilih. Copy dengan status selain `AVAILABLE` dibuat disabled di UI dan juga ditolak lagi oleh `createLoan`.

Pada pengembalian, `returnLoanItems` mengubah `LoanItem.status` menjadi `RETURNED`, mengisi `LoanItem.returnedAt`, dan mengubah `BookCopy.status` menjadi `AVAILABLE`.

## 9. Flow Peminjaman

Route: `/loans/new`.

Yang didukung source code:

- Cari anggota melalui `searchMembers`.
- Tampilkan hasil anggota.
- Jika anggota tidak ditemukan, tampilkan opsi membuat anggota baru.
- Buat anggota baru melalui `createMember`.
- Validasi nama, nomor HP, dan NIK untuk anggota baru.
- Email anggota opsional dan divalidasi hanya jika diisi.
- Cari buku melalui `searchBooks`.
- Pilih judul buku.
- Ambil copy buku melalui `getBookCopies`.
- Tampilkan total copy, copy tersedia, kode copy, dan status copy.
- Pilih satu atau lebih copy `AVAILABLE`.
- Validasi minimal satu copy.
- Validasi tanggal peminjaman dan jatuh tempo.
- Tampilkan ringkasan peminjaman.
- Submit melalui `createLoan`.
- Tampilkan nomor transaksi setelah sukses.
- Navigasi kembali ke `/transactions`.

Catatan implementasi:

- `createLoan` membuat `Loan` baru.
- `createLoan` membuat satu `LoanItem` untuk setiap `BookCopy` yang dipilih.
- `createLoan` mengubah copy yang dipilih menjadi `BORROWED`.
- `createLoan` mengurangi `Book.availableCopies`.
- `borrowedBy` saat create loan masih statis ke `user-002`, bukan berdasarkan session login.

## 10. Flow Pengembalian

Route: `/returns`.

Yang didukung source code:

- Ambil transaksi aktif dan terlambat melalui `getReturnLoans`.
- Tampilkan nomor transaksi.
- Tampilkan anggota.
- Tampilkan status transaksi.
- Tampilkan jatuh tempo.
- Tampilkan daftar buku dan kode copy yang belum dikembalikan.
- Pilih satu atau lebih item untuk dikembalikan.
- Submit melalui `returnLoanItems`.
- Tampilkan success state.
- Pengembalian sebagian didukung.
- Jika semua item sudah kembali, loan berubah menjadi `COMPLETED`.
- Copy yang dikembalikan berubah menjadi `AVAILABLE`.
- `Book.availableCopies` bertambah.

Catatan implementasi:

- UI hanya menampilkan `LoanItem` dengan status `BORROWED`, sehingga copy yang sudah returned tidak muncul lagi untuk dipilih.
- Search pengembalian mendukung nomor transaksi, nama anggota, judul buku, dan kode copy.
- Setelah submit sukses, transaksi dipindahkan dari daftar jika statusnya tidak lagi aktif atau terlambat.

## 11. Riwayat

Route: `/transactions`.

Yang didukung source code:

- Data diambil dari `getTransactions`.
- Menampilkan nomor transaksi.
- Menampilkan anggota.
- Menampilkan judul buku dan kode copy.
- Menampilkan petugas.
- Menampilkan tanggal peminjaman.
- Menampilkan jatuh tempo.
- Menampilkan tanggal pengembalian jika tersedia.
- Menampilkan status transaksi dengan label teks.
- Search nomor transaksi, anggota, judul buku, dan kode copy.
- Filter status `ACTIVE`, `OVERDUE`, dan `COMPLETED`.
- Filter tanggal berdasarkan `borrowedAt`.
- Search dan filter dapat digunakan bersamaan.
- Pagination lokal dengan `PAGE_SIZE = 5`.
- Tabel digunakan mulai breakpoint `md`.

Catatan implementasi:

- Data riwayat sudah berbentuk `TransactionData[]`.
- `getTransactions` hanya mengembalikan data `company-001`.
- Hak akses role di riwayat belum dibedakan berdasarkan session user. Admin dan staff akan membaca dataset mock API yang sama.

## 12. Request/Response Mock API Aktual

Shape berikut mengikuti source code aktual.

```ts
export interface LoginResponse {
  user: User;
  company: Company;
  companySettings: CompanySettings;
}

login(email: string, password: string): Promise<LoginResponse>
```

```ts
export interface DashboardResponse {
  booksAvailable: number;
  booksBorrowed: number;
  activeLoans: number;
  overdueLoans: number;
  recentLoans: Loan[];
}

getDashboard(): Promise<DashboardResponse>
```

```ts
searchMembers(query: string): Promise<Member[]>

createMember(
  data: Pick<
    Member,
    | "name"
    | "memberType"
    | "identityNumber"
    | "phone"
    | "email"
    | "status"
  >,
): Promise<Member>
```

```ts
searchBooks(query: string): Promise<Book[]>

getBookCopies(bookId: string): Promise<BookCopy[]>
```

```ts
export interface CreateLoanData {
  memberId: string;
  bookId: string;
  bookCopyIds: string[];
  borrowedAt: string;
  dueAt: string;
}

createLoan(data: CreateLoanData): Promise<Loan>
```

```ts
getActiveLoans(): Promise<Loan[]>
```

```ts
getTransactions(): Promise<TransactionData[]>
```

`TransactionData` aktual:

```ts
export interface TransactionData {
  loan: Loan;
  member: Member;
  user: User;
  items: {
    loanItem: LoanItem;
    book: Book;
    bookCopy: BookCopy;
  }[];
}
```

```ts
getReturnLoans(): Promise<ReturnLoanData[]>

returnLoanItems(
  loanId: string,
  loanItemIds: string[],
): Promise<Loan>
```

`ReturnLoanData` aktual:

```ts
export interface ReturnLoanData {
  loan: Loan;
  member: Member;
  items: {
    loanItem: LoanItem;
    book: Book;
    bookCopy: BookCopy;
  }[];
}
```

## 13. UI/UX

Yang didukung source code:

- Label, navigasi, error, dan feedback utama menggunakan Bahasa Indonesia.
- Warna dominan memakai slate/neutral terang, surface putih, primary biru, success hijau, warning kuning, danger merah, dan neutral slate.
- Status transaksi ditampilkan menggunakan label teks di dalam `Badge`.
- Komponen UI reusable tersedia untuk `Button`, `Input`, `Card`, dan `Badge`.
- Loading state tersedia pada button dan beberapa area halaman.
- Empty state tersedia pada dashboard, peminjaman, pengembalian, dan riwayat.
- Error state tersedia pada login, dashboard, peminjaman, pengembalian, dan riwayat.

Catatan implementasi:

- Dashboard admin memiliki link administrasi ke `/settings/users` dan `/settings/company`, tetapi route tersebut belum tersedia di source code.
- Halaman `/` masih halaman default bawaan Next dan bukan bagian dari route MVP yang diaudit.

## 14. Responsive Behavior

Scope responsive dokumentasi ini hanya desktop dan tablet.

Yang didukung source code:

- Container memakai `max-w-*` dan padding responsive.
- Dashboard memakai grid `sm` dan `lg`.
- Form peminjaman dan pengembalian memakai layout satu kolom lalu dua kolom pada breakpoint lebih besar.
- Riwayat memakai tabel mulai breakpoint `md`.
- Tabel riwayat berada di wrapper `overflow-x-auto`, sehingga overflow table dibatasi di area tabel.

Status verifikasi responsive:

- Struktur CSS responsive: COMPLETE berdasarkan audit source.
- Visual desktop dan tablet: NOT VERIFIED karena tidak ada screenshot/browser automation aktual yang dijalankan pada viewport desktop/tablet.

## 15. Accessibility

Yang didukung source code:

- Root HTML memakai `lang="id"`.
- Input reusable memiliki label.
- Field password memiliki label terlihat.
- Button memiliki teks aksi.
- Error login memakai `role="alert"`.
- Error form utama memakai `role="alert"`.
- Success peminjaman memakai `role="status"` dan `aria-live="polite"`.
- Focus-visible tersedia pada button, link/card interaktif tertentu, dan input.
- Disabled state tersedia pada button dan checkbox copy yang tidak tersedia.
- Status tidak hanya dibedakan dengan warna karena memiliki label teks.

Belum diverifikasi:

- Audit keyboard navigation end-to-end.
- Audit contrast dengan tooling khusus.
- Audit screen reader penuh.

## 16. Performance Consideration

Yang didukung source code:

- Tidak ada library tambahan untuk optimasi kecil.
- Mock API memakai delay kecil untuk simulasi request.
- Filtering riwayat memakai `useMemo`.
- Pagination riwayat dihitung lokal.
- Reset pagination dilakukan di event handler, bukan synchronous state update di `useEffect`.

Catatan:

- Dataset mock masih kecil, sehingga tidak ada optimasi besar yang diperlukan.
- Beberapa operasi mutasi mock data dilakukan langsung pada array in-memory, sesuai scope MVP tanpa backend.

## 17. Testing

Quality check yang benar-benar dijalankan setelah perubahan terakhir:

| Command | Status |
| --- | --- |
| `npm run typecheck` | VERIFIED PASS |
| `npm run lint` | VERIFIED PASS |
| `npm run build` | VERIFIED PASS |

Sanity check HTTP yang benar-benar dijalankan pada server lokal `http://localhost:3000`:

| Route | Status |
| --- | --- |
| `/login` | VERIFIED 200 OK |
| `/dashboard` | VERIFIED 200 OK |
| `/loans/new` | VERIFIED 200 OK |
| `/returns` | VERIFIED 200 OK |
| `/transactions` | VERIFIED 200 OK |

Belum dilakukan:

- Testing klik/form login end-to-end di browser.
- Testing klik/form peminjaman end-to-end di browser.
- Testing klik/form pengembalian end-to-end di browser.
- Screenshot desktop.
- Screenshot tablet.

## 18. Acceptance Criteria

Status:

- COMPLETE: didukung oleh source code.
- NOT COMPLETE: belum didukung atau hanya sebagian.
- VERIFIED: sudah dibuktikan dengan command atau HTTP check aktual.
- NOT VERIFIED: belum dibuktikan dengan testing aktual, walaupun source code terlihat mendukung.

### Login

| Criteria | Implementasi | Verifikasi | Catatan |
| --- | --- | --- | --- |
| Admin login sebagai `COMPANY_ADMIN` | COMPLETE | NOT VERIFIED | Credential tersedia di mock data dan logic login mendukung. Belum diuji submit form browser. |
| Staff login sebagai `STAFF` | COMPLETE | NOT VERIFIED | Credential tersedia di mock data dan logic login mendukung. Belum diuji submit form browser. |
| Credential salah ditolak | COMPLETE | NOT VERIFIED | `login` throw error jika user/password tidak cocok. |
| Password hidden default | COMPLETE | VERIFIED | HTML `/login` menampilkan input password `type="password"`. |
| Session bertahan saat berpindah halaman | COMPLETE | NOT VERIFIED | Session memakai `localStorage`; belum diuji navigasi browser. |
| Logout menghapus session dan kembali ke login | COMPLETE | NOT VERIFIED | Dashboard memanggil `clearSession()` dan `router.replace("/login")`; belum diuji klik browser. |

### Dashboard

| Criteria | Implementasi | Verifikasi | Catatan |
| --- | --- | --- | --- |
| Data dashboard berasal dari mock API | COMPLETE | NOT VERIFIED | Source memakai `getDashboard`; route HTTP 200. |
| Quick access peminjaman dan pengembalian benar | COMPLETE | NOT VERIFIED | Link menuju `/loans/new` dan `/returns`; belum diuji klik. |
| Loading state | COMPLETE | NOT VERIFIED | Ada state loading. |
| Error state | COMPLETE | NOT VERIFIED | Ada state error. |
| Empty state aktivitas | COMPLETE | NOT VERIFIED | Ada empty state untuk recent loans kosong. |
| Responsive desktop/tablet | COMPLETE | NOT VERIFIED | Struktur CSS responsive ada; belum ada screenshot desktop/tablet. |
| Status tidak hanya warna | COMPLETE | NOT VERIFIED | Status memakai label teks. |
| Role behavior | NOT COMPLETE | NOT VERIFIED | Dashboard membedakan label admin/staff, tetapi shortcut administrasi admin mengarah ke route yang belum dibuat. |

### Peminjaman

| Criteria | Implementasi | Verifikasi | Catatan |
| --- | --- | --- | --- |
| Search member | COMPLETE | NOT VERIFIED | Source memakai `searchMembers`. |
| Search book | COMPLETE | NOT VERIFIED | Source memakai `searchBooks`. |
| Member baru | COMPLETE | NOT VERIFIED | Source memakai `createMember`. |
| Member masuk mock data | COMPLETE | NOT VERIFIED | `createMember` melakukan `mockMembers.push(member)`. |
| Total copy | COMPLETE | NOT VERIFIED | UI menampilkan `book.totalCopies`. |
| Available copy | COMPLETE | NOT VERIFIED | UI menampilkan `book.availableCopies`. |
| Multiple copy | COMPLETE | NOT VERIFIED | State `selectedCopyIds` mendukung banyak copy. |
| Hanya `AVAILABLE` yang bisa dipilih | COMPLETE | NOT VERIFIED | UI dan `createLoan` mengecek status copy. |
| `BORROWED` tidak bisa dipilih | COMPLETE | NOT VERIFIED | Semua status selain `AVAILABLE` disabled/ditolak. |
| `INACTIVE` tidak bisa dipilih | COMPLETE | NOT VERIFIED | Semua status selain `AVAILABLE` disabled/ditolak. |
| `LOST` tidak bisa dipilih | COMPLETE | NOT VERIFIED | Type mendukung `LOST`; semua status selain `AVAILABLE` disabled/ditolak. |
| Minimal satu copy | COMPLETE | NOT VERIFIED | UI dan API memvalidasi minimal satu copy. |
| Due date validation | COMPLETE | NOT VERIFIED | UI dan API memvalidasi `dueAt < borrowedAt`. |
| Race/change availability error | COMPLETE | NOT VERIFIED | `createLoan` menolak copy yang berubah tidak tersedia. |
| Double submit dicegah | COMPLETE | NOT VERIFIED | `submitLoading` mencegah submit ulang. |
| Copy menjadi `BORROWED` | COMPLETE | NOT VERIFIED | `createLoan` mengubah status selected copy. |
| Nomor transaksi | COMPLETE | NOT VERIFIED | Success state menampilkan `loanNumber`. |
| Loading/error/success/empty | COMPLETE | NOT VERIFIED | State tersedia di source. |

### Pengembalian

| Criteria | Implementasi | Verifikasi | Catatan |
| --- | --- | --- | --- |
| Active transaction | COMPLETE | NOT VERIFIED | `getReturnLoans` mengambil `ACTIVE` dan `OVERDUE`. |
| Overdue transaction | COMPLETE | NOT VERIFIED | Status `OVERDUE` ditampilkan sebagai terlambat. |
| Nomor transaksi | COMPLETE | NOT VERIFIED | Ditampilkan di list dan detail. |
| Anggota | COMPLETE | NOT VERIFIED | Ditampilkan di list dan detail. |
| Buku/copy | COMPLETE | NOT VERIFIED | Detail menampilkan judul buku dan kode copy. |
| Copy selection | COMPLETE | NOT VERIFIED | Checkbox memakai `loanItem.id`. |
| Already returned tidak bisa dipilih | COMPLETE | NOT VERIFIED | Hanya item `BORROWED` yang dikembalikan oleh `getReturnLoans`. |
| Partial return | COMPLETE | NOT VERIFIED | `returnLoanItems` menerima beberapa `loanItemIds`, tidak harus semua. |
| Copy menjadi `AVAILABLE` | COMPLETE | NOT VERIFIED | `returnLoanItems` mengubah copy menjadi `AVAILABLE`. |
| Full return menjadi `COMPLETED` | COMPLETE | NOT VERIFIED | Jika tidak ada item `BORROWED`, loan menjadi `COMPLETED`. |
| Empty state | COMPLETE | NOT VERIFIED | Ada empty state transaksi aktif kosong. |
| Error state | COMPLETE | NOT VERIFIED | Ada error state load dan submit. |
| Success state | COMPLETE | NOT VERIFIED | Ada success state setelah pengembalian. |
| Double submit dicegah | COMPLETE | NOT VERIFIED | Button loading men-disable button. |

### Riwayat

| Criteria | Implementasi | Verifikasi | Catatan |
| --- | --- | --- | --- |
| Nomor transaksi | COMPLETE | NOT VERIFIED | Ditampilkan di tabel. |
| Anggota | COMPLETE | NOT VERIFIED | Ditampilkan di tabel. |
| Judul buku | COMPLETE | NOT VERIFIED | Ditampilkan lewat `getBookList`. |
| Kode copy | COMPLETE | NOT VERIFIED | Ditampilkan lewat `bookCopy.code`. |
| Petugas | COMPLETE | NOT VERIFIED | Ditampilkan dari `TransactionData.user`. |
| Borrowed date | COMPLETE | NOT VERIFIED | Ditampilkan dari `loan.borrowedAt`. |
| Due date | COMPLETE | NOT VERIFIED | Ditampilkan dari `loan.dueAt`. |
| Returned date | COMPLETE | NOT VERIFIED | Ditampilkan dari `loan.returnedAt` jika ada. |
| Status | COMPLETE | NOT VERIFIED | Ditampilkan dengan label. |
| Search transaction | COMPLETE | NOT VERIFIED | Search mencakup `loan.loanNumber`. |
| Search member | COMPLETE | NOT VERIFIED | Search mencakup `member.name`. |
| Search book | COMPLETE | NOT VERIFIED | Search mencakup `book.title`. |
| Search copy | COMPLETE | NOT VERIFIED | Search mencakup `bookCopy.code`. |
| Filter status | COMPLETE | NOT VERIFIED | Select status tersedia. |
| Filter tanggal | COMPLETE | NOT VERIFIED | Filter start/end date tersedia. |
| Search + filter bersamaan | COMPLETE | NOT VERIFIED | Logic filter menggabungkan semua kondisi. |
| Pagination/load more | COMPLETE | NOT VERIFIED | Pagination lokal tersedia. |
| Loading | COMPLETE | NOT VERIFIED | Ada loading state. |
| Error | COMPLETE | NOT VERIFIED | Ada error state. |
| Empty | COMPLETE | NOT VERIFIED | Ada empty state hasil kosong. |
| Desktop table | COMPLETE | NOT VERIFIED | Table tersedia mulai `md`. |
| Role-based riwayat staff/admin | NOT COMPLETE | NOT VERIFIED | `getTransactions` tidak membaca session role; data difilter statis ke `company-001`. |

### UI/UX, Accessibility, Responsive, Quality

| Criteria | Implementasi | Verifikasi | Catatan |
| --- | --- | --- | --- |
| Bahasa Indonesia | COMPLETE | NOT VERIFIED | Source halaman MVP memakai label/pesan Indonesia. |
| Palette sesuai requirement | COMPLETE | NOT VERIFIED | Class Tailwind memakai slate, white, blue, green, yellow, red. |
| Spacing konsisten | COMPLETE | NOT VERIFIED | Struktur class konsisten, belum diaudit screenshot. |
| Typography konsisten | COMPLETE | NOT VERIFIED | Class text konsisten, belum diaudit screenshot. |
| Button jelas | COMPLETE | NOT VERIFIED | Button memakai teks aksi. |
| Input jelas | COMPLETE | NOT VERIFIED | Input reusable punya label. |
| Focus-visible | COMPLETE | NOT VERIFIED | Class focus-visible tersedia di komponen dan link penting. |
| Keyboard navigation | COMPLETE | NOT VERIFIED | Elemen interaktif memakai button/link/input; belum diuji keyboard end-to-end. |
| Status tidak hanya warna | COMPLETE | NOT VERIFIED | Badge berisi label teks. |
| Accessibility dasar | COMPLETE | NOT VERIFIED | Ada label, `lang="id"`, alert/status; audit a11y tooling belum dilakukan. |
| Responsive desktop | COMPLETE | NOT VERIFIED | Struktur layout mendukung desktop; screenshot belum dibuat. |
| Responsive tablet | COMPLETE | NOT VERIFIED | Struktur layout mendukung tablet; screenshot belum dibuat. |
| Tidak ada horizontal overflow halaman utama | COMPLETE | NOT VERIFIED | Table punya wrapper overflow internal; belum diuji viewport aktual. |
| `npm run typecheck` | COMPLETE | VERIFIED | Command berhasil. |
| `npm run lint` | COMPLETE | VERIFIED | Command berhasil. |
| `npm run build` | COMPLETE | VERIFIED | Command berhasil. |

## 19. Status Implementasi

Ringkasan status:

- Implementasi route MVP tersedia.
- Mock API tersedia dan dipakai oleh halaman utama.
- BookCopy sudah digunakan untuk peminjaman, pengembalian, dan riwayat.
- Quality command `typecheck`, `lint`, dan `build` sudah berhasil.
- Testing browser interaktif belum dilakukan.
- Screenshot desktop/tablet belum dibuat.

Hal yang belum selesai atau belum sepenuhnya sesuai:

- Role-based access riwayat belum membaca session user.
- `borrowedBy` pada loan baru masih statis ke `user-002`.
- Dashboard admin memiliki link administrasi ke route yang belum tersedia.
- Halaman `/` masih default bawaan Next dan bukan halaman BukuFlow.

## 20. Catatan Penggantian Mock API ke Backend

Komponen UI sudah memanggil function di `src/lib/mock-api.ts`, sehingga terdapat abstraction data layer yang dapat menjadi titik penggantian ke backend.

Namun penggantian backend belum bisa dianggap tanpa pekerjaan tambahan. Hal yang perlu disesuaikan pada tahap backend:

- Mengganti implementasi function mock API dengan HTTP client.
- Mengirim session/token atau user context ke request.
- Mengganti company scope statis `mockCompany` menjadi scope dari user/session.
- Menangani error backend dengan shape yang konsisten.
- Menjaga response adapter agar UI tetap menerima shape seperti `LoginResponse`, `DashboardResponse`, `ReturnLoanData[]`, dan `TransactionData[]`.
