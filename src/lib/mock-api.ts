import {
  mockBooks,
  mockBookCopies,
  mockLoanItems,
  mockLoans,
  mockMembers,
  ensureMockStoreHydrated,
  persistMockState,
} from "./mock-store";

import {
  mockCompany,
  mockCompanySettings,
  mockCompanySettings2,
  mockUsers,
} from "./mock-data";

import type {
  Book,
  BookCopy,
  Company,
  CompanySettings,
  Loan,
  LoanItem,
  Member,
  User,
  ReturnLoanData,
  TransactionData,
} from "./types";

import { getSession } from "./auth";

const MOCK_PASSWORD = "admin123";

/* =========================================================
   UTILITIES
========================================================= */

function delay(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mengambil session user yang sedang login.
 * Semua operasi data yang terkait user menggunakan companyId dari session.
 */
function getCurrentSession() {
  const session = getSession();

  if (!session) {
    throw new Error("Sesi pengguna tidak ditemukan.");
  }

  return session;
}

/**
 * Mengambil company aktif berdasarkan companyId user.
 */
function getCurrentCompany(): Company {
  const { user } = getCurrentSession();

  if (user.companyId === mockCompany.id) {
    return mockCompany;
  }

  if (user.companyId === "company-002") {
    return {
      id: "company-002",
      code: "BF002",
      name: "Perpustakaan Semarang",
      logo: "",
      address: "Semarang, Jawa Tengah",
      status: "ACTIVE",
      timezone: "Asia/Jakarta",
      createdAt: "2026-08-01T08:00:00+07:00",
      updatedAt: "2026-08-01T08:00:00+07:00",
    };
  }

  throw new Error("Data company pengguna tidak ditemukan.");
}


/**
 * Menghitung jumlah copy berdasarkan status BookCopy.
 *
 * AVAILABLE  = benar-benar bisa dipinjam
 * BORROWED   = sedang dipinjam
 * INACTIVE   = tidak digunakan
 * LOST       = hilang
 */
function getBookCopyCounts(
  bookId: string,
  companyId: string,
) {
  const copies = mockBookCopies.filter(
    (copy) =>
      copy.bookId === bookId &&
      copy.companyId === companyId,
  );

  return {
    totalCopies: copies.length,

    availableCopies: copies.filter(
      (copy) => copy.status === "AVAILABLE",
    ).length,

    borrowedCopies: copies.filter(
      (copy) => copy.status === "BORROWED",
    ).length,

    inactiveCopies: copies.filter(
      (copy) => copy.status === "INACTIVE",
    ).length,

    lostCopies: copies.filter(
      (copy) => copy.status === "LOST",
    ).length,
  };
}

/**
 * Sinkronisasi data agregat Book berdasarkan BookCopy.
 *
 * Jadi Book.availableCopies tidak lagi dipercaya
 * sebagai sumber utama.
 *
 * Sumber sebenarnya adalah mockBookCopies.
 */
function syncBookAvailability(book: Book) {
  const counts = getBookCopyCounts(
    book.id,
    book.companyId,
  );

  book.totalCopies = counts.totalCopies;
  book.availableCopies =
    counts.availableCopies;

  if (book.status !== "INACTIVE") {
    book.status =
      counts.availableCopies > 0
        ? "AVAILABLE"
        : "BORROWED";
  }

  book.updatedAt =
    new Date().toISOString();

  return counts;
}


function syncAllBooks() {
  mockBooks.forEach((book) => {
    syncBookAvailability(book);
  });
}


function syncLoanStatuses() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let changed = false;

  mockLoans.forEach((loan) => {
    if (loan.status !== "ACTIVE") {
      return;
    }

    const dueDate = new Date(
      `${loan.dueAt.slice(0, 10)}T00:00:00`,
    );

    if (Number.isNaN(dueDate.getTime())) {
      return;
    }

    if (dueDate < today) {
      loan.status = "OVERDUE";
      loan.updatedAt = new Date().toISOString();
      changed = true;
    }
  });

  if (changed) {
    persistMockState();
  }
}
/* =========================================================
   LOGIN
========================================================= */

export interface LoginResponse {
  user: User;
  company: Company;
  companySettings: CompanySettings;
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  ensureMockStoreHydrated();
  await delay();

  const user = mockUsers.find(
    (item) =>
      item.email?.toLowerCase() ===
        email.trim().toLowerCase() &&
      item.status === "ACTIVE",
  );

  if (!user || password !== MOCK_PASSWORD) {
    throw new Error(
      "Email atau password yang kamu masukkan salah.",
    );
  }

  const company =
    user.companyId === mockCompany.id
      ? mockCompany
      : user.companyId === "company-002"
        ? {
            id: "company-002",
            code: "BF002",
            name: "Perpustakaan Semarang",
            logo: "",
            address: "Semarang, Jawa Tengah",
            status: "ACTIVE" as const,
            timezone: "Asia/Jakarta",
            createdAt:
              "2026-08-01T08:00:00+07:00",
            updatedAt:
              "2026-08-01T08:00:00+07:00",
          }
        : undefined;

  const companySettings =
    user.companyId ===
    mockCompanySettings.companyId
      ? mockCompanySettings
      : user.companyId ===
          mockCompanySettings2.companyId
        ? mockCompanySettings2
        : undefined;

  if (!company || !companySettings) {
    throw new Error(
      "Data company pengguna tidak ditemukan.",
    );
  }

  return {
    user,
    company,
    companySettings,
  };
}

/* =========================================================
   DASHBOARD
========================================================= */

export interface DashboardResponse {
  booksAvailable: number;
  booksBorrowed: number;
  activeLoans: number;
  overdueLoans: number;
  recentLoans: Array<Loan & { memberName: string }>;
}

export async function getDashboard(): Promise<DashboardResponse> {
  ensureMockStoreHydrated();
  await delay();

  const companyId = getCurrentSession().user.companyId;

  syncLoanStatuses();
  syncAllBooks();

  const companyBooks = mockBooks.filter(
    (book) =>
      book.companyId === companyId,
  );

  const companyLoans = mockLoans.filter(
    (loan) =>
      loan.companyId === companyId,
  );

  return {
    /**
     * Jumlah copy yang AVAILABLE.
     */
    booksAvailable: companyBooks.reduce(
      (total, book) =>
        total + book.availableCopies,
      0,
    ),

    /**
     * Jumlah copy yang sedang BORROWED.
     *
     * LOST dan INACTIVE tidak dihitung
     * sebagai sedang dipinjam.
     */
    booksBorrowed: companyBooks.reduce(
      (total, book) => {
        const counts = getBookCopyCounts(
          book.id,
          book.companyId,
        );

        return (
          total + counts.borrowedCopies
        );
      },
      0,
    ),

    activeLoans: companyLoans.filter(
      (loan) => loan.status === "ACTIVE" || loan.status === "OVERDUE",
    ).length,

    overdueLoans: companyLoans.filter(
      (loan) => loan.status === "OVERDUE",
    ).length,

   recentLoans: [...companyLoans]
  .sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() -
      new Date(a.updatedAt).getTime(),
  )
  .slice(0, 5)
  .map((loan) => {
    const member = mockMembers.find(
      (item) =>
        item.id === loan.memberId &&
        item.companyId === loan.companyId,
    );

    return {
      ...loan,
      memberName: member?.name ?? "-",
    };
  }),
  };
}

/* =========================================================
   MEMBER
========================================================= */

export async function searchMembers(
  query: string,
): Promise<Member[]> {
  ensureMockStoreHydrated();
  await delay(300);

  const companyId = getCurrentSession().user.companyId;

  const keyword =
    query.trim().toLowerCase();

  if (!keyword) {
    return [];
  }

  return mockMembers.filter(
    (member) =>
      member.companyId ===
        companyId &&
      (
        member.name
          .toLowerCase()
          .includes(keyword) ||
        member.memberNumber
          .toLowerCase()
          .includes(keyword) ||
        member.identityNumber.includes(
          keyword,
        ) ||
        member.phone.includes(keyword)
      ),
  );
}

export async function createMember(
  data: Pick<
    Member,
    | "name"
    | "memberType"
    | "identityNumber"
    | "phone"
    | "email"
    | "status"
  >,
): Promise<Member> {
  ensureMockStoreHydrated();
  await delay();

  const companyId = getCurrentSession().user.companyId;

  // Defense-in-depth validation. Tidak mengubah kontrak data existing.
  const name = data.name.trim();
  const identityNumber = data.identityNumber.trim();
  const phone = data.phone.trim();
  const email = data.email?.trim() || undefined;

  if (name.length < 2) {
    throw new Error("Nama anggota wajib diisi minimal 2 karakter.");
  }

  if (!/^\d{16}$/.test(identityNumber)) {
    throw new Error("NIK harus terdiri dari 16 digit angka.");
  }

  if (!/^\d{10,15}$/.test(phone)) {
    throw new Error("Nomor HP harus terdiri dari 10-15 digit angka.");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Format email tidak valid.");
  }

  const duplicateNik = mockMembers.some(
    (member) =>
      member.companyId === companyId &&
      member.identityNumber === identityNumber,
  );

  if (duplicateNik) {
    throw new Error("NIK tersebut sudah terdaftar sebagai anggota.");
  }

  const now = new Date().toISOString();

  const nextMemberNumber =
    mockMembers.filter(
      (member) =>
        member.companyId === companyId,
    ).length + 1;

  const member: Member = {
    id: `member-${Date.now()}`,
    companyId: companyId,
    memberNumber: `MBR-${String(
      nextMemberNumber,
    ).padStart(3, "0")}`,
    name,
    memberType: data.memberType,
    identityNumber,
    phone,
    email,
    status: data.status,
    createdAt: now,
    updatedAt: now,
  };

  mockMembers.push(member);
  persistMockState();

  return member;
}

/* =========================================================
   BOOK
========================================================= */

/**
 * Mengambil semua buku company yang
 * mempunyai minimal satu copy AVAILABLE.
 */
export async function getAvailableBooks(): Promise<Book[]> {
  ensureMockStoreHydrated();
  await delay(300);

  const companyId = getCurrentSession().user.companyId;

  syncAllBooks();

  return mockBooks
    .filter(
      (book) =>
        book.companyId ===
          companyId &&
        book.status !== "INACTIVE" &&
        book.availableCopies > 0,
    )
    .map((book) => ({
      ...book,
    }));
}

/**
 * Search buku.
 *
 * Query kosong:
 *   semua buku aktif, termasuk yang tidak memiliki copy AVAILABLE.
 *
 * Query ada:
 *   filter berdasarkan judul, kode, ISBN.
 *   Buku dengan availableCopies = 0 tetap dapat ditemukan.
 */
export async function searchBooks(
  query: string,
): Promise<Book[]> {
  ensureMockStoreHydrated();
  await delay(300);

  syncAllBooks();

  const companyId = getCurrentSession().user.companyId;

  const keyword =
    query.trim().toLowerCase();

  // Search harus tetap menampilkan semua buku aktif,
  // termasuk buku yang availableCopies sudah 0.
  // Buku yang tidak memiliki copy tersedia tetap ditampilkan di UI
  // agar user tidak membuat data buku baru yang sebenarnya sudah ada.
  const books =
    mockBooks.filter(
      (book) =>
        book.companyId ===
          companyId &&
        book.status !== "INACTIVE",
    );

  if (!keyword) {
    return books.map(
      (book) => ({
        ...book,
      }),
    );
  }

  return books
    .filter(
      (book) =>
        book.title
          .toLowerCase()
          .includes(keyword) ||
        book.code
          .toLowerCase()
          .includes(keyword) ||
        book.isbn
          ?.toLowerCase()
          .includes(keyword),
    )
    .map((book) => ({
      ...book,
    }));
}


export interface CreateBookData {
  title: string;
  isbn?: string;
  author?: string;
  publisher?: string;
  publicationYear?: number;
  category?: string;
  totalCopies: number;
}

export async function createBook(
  data: CreateBookData,
): Promise<Book> {
  ensureMockStoreHydrated();
  await delay();

  const companyId = getCurrentSession().user.companyId;

  // Defense-in-depth validation.
  // Field yang optional di CreateBookData tetap optional di API.
  const title = data.title.trim();
  const isbn = data.isbn?.trim() || undefined;
  const author = data.author?.trim() || undefined;
  const publisher = data.publisher?.trim() || undefined;
  const category = data.category?.trim() || undefined;

  if (title.length < 2) {
    throw new Error("Judul buku wajib diisi minimal 2 karakter.");
  }

  if (!author) {
    throw new Error("Penulis wajib diisi.");
  }

  if (!isbn) {
    throw new Error("ISBN wajib diisi.");
  }

  if (!/^[0-9Xx-]+$/.test(isbn)) {
    throw new Error("Format ISBN tidak valid.");
  }

  if (!publisher) {
    throw new Error("Penerbit wajib diisi.");
  }

  // publicationYear sengaja tidak divalidasi sebagai required di API,
  // karena field tersebut masih optional pada CreateBookData.
  if (data.publicationYear !== undefined) {
    if (
      !Number.isInteger(data.publicationYear) ||
      data.publicationYear < 1000 ||
      data.publicationYear > new Date().getFullYear()
    ) {
      throw new Error("Tahun terbit tidak valid.");
    }
  }

  if (!category) {
    throw new Error("Kategori wajib diisi.");
  }

  if (!Number.isInteger(data.totalCopies) || data.totalCopies < 1) {
    throw new Error("Jumlah copy minimal 1.");
  }

  const now = new Date().toISOString();
  const bookId = `book-${Date.now()}`;

  // Kode buku selalu dibuat dari nomor BK terbesar yang saat ini ada.
  const highestBookNumber = mockBooks.reduce((max, book) => {
    const match = /^BK-(\d+)$/.exec(book.code.trim());

    if (!match) {
      return max;
    }

    const number = Number(match[1]);

    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);

  const nextBookNumber = highestBookNumber + 1;
  const code = `BK-${String(nextBookNumber).padStart(3, "0")}`;

  const book: Book = {
    id: bookId,
    companyId,
    code,
    isbn,
    title,
    author,
    publisher,
    publicationYear: data.publicationYear,
    category,
    coverUrl: undefined,
    status: "AVAILABLE",
    totalCopies: data.totalCopies,
    availableCopies: data.totalCopies,
    createdAt: now,
    updatedAt: now,
  };

  mockBooks.push(book);

  for (let index = 1; index <= data.totalCopies; index += 1) {
    const copy: BookCopy = {
      id: `book-copy-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      companyId,
      bookId,
      code: `${code}-${String(index).padStart(2, "0")}`,
      status: "AVAILABLE",
      createdAt: now,
      updatedAt: now,
    };

    mockBookCopies.push(copy);
  }

  syncBookAvailability(book);
  persistMockState();

  return { ...book };
}


export async function getBookCopies(
  bookId: string,
): Promise<BookCopy[]> {
  ensureMockStoreHydrated();
  await delay(300);

  const companyId = getCurrentSession().user.companyId;

  return mockBookCopies
    .filter(
      (copy) =>
        copy.bookId === bookId &&
        copy.companyId ===
          companyId,
    )
    .map((copy) => ({
      ...copy,
    }));
}

/* =========================================================
   LOAN
========================================================= */

export async function getActiveLoans(): Promise<Loan[]> {
 ensureMockStoreHydrated();
  await delay();

  const companyId = getCurrentSession().user.companyId;

  syncLoanStatuses();
  return mockLoans.filter(
    (loan) =>
      loan.companyId ===
        companyId &&
      (
        loan.status === "ACTIVE" ||
        loan.status === "OVERDUE"
      ),
  );
}

export interface CreateLoanData {
  memberId: string;
  items: Array<{
    bookId: string;
    bookCopyIds: string[];
  }>;
  borrowedAt: string;
  dueAt: string;
}

/**
 * Generate nomor transaksi berdasarkan PRD:
 * [company_code]-[tahun]-[nomor_urut]
 */
function generateLoanNumber(
  company: Company,
  borrowedAt: string,
): string {
  const year = new Date(borrowedAt).getFullYear();
  const prefix = `${company.code}-${year}-`;

  const lastNumber = mockLoans
    .filter(
      (loan) =>
        loan.companyId === company.id &&
        loan.loanNumber.startsWith(prefix),
    )
    .map((loan) => Number(loan.loanNumber.slice(prefix.length)))
    .filter((number) => Number.isFinite(number))
    .reduce((max, number) => Math.max(max, number), 0);

  return `${prefix}${String(lastNumber + 1).padStart(6, "0")}`;
}

export async function createLoan(
  data: CreateLoanData,
): Promise<Loan> {
  ensureMockStoreHydrated();
  await delay();

  const company = getCurrentCompany();
  const companyId = company.id;

  syncAllBooks();

  if (data.items.length === 0) {
    throw new Error("Minimal satu buku wajib dipilih.");
  }

  const member = mockMembers.find(
    (item) =>
      item.id === data.memberId &&
      item.companyId === companyId &&
      item.status === "ACTIVE",
  );

  if (!member) {
    throw new Error("Anggota tidak ditemukan atau tidak aktif.");
  }

  if (data.dueAt < data.borrowedAt) {
    throw new Error(
      "Tanggal jatuh tempo tidak boleh sebelum tanggal peminjaman.",
    );
  }

  // Validasi seluruh buku dan copy terlebih dahulu agar transaksi tidak
  // tersimpan sebagian ketika salah satu pilihan tidak valid.
  const validatedItems = data.items.map((item) => {
    const book = mockBooks.find(
      (candidate) =>
        candidate.id === item.bookId &&
        candidate.companyId === companyId,
    );

    if (!book) {
      throw new Error("Buku tidak ditemukan.");
    }

    if (item.bookCopyIds.length === 0) {
      throw new Error(`Minimal satu copy wajib dipilih untuk buku ${book.title}.`);
    }

    const uniqueCopyIds = new Set(item.bookCopyIds);
    if (uniqueCopyIds.size !== item.bookCopyIds.length) {
      throw new Error(`Copy buku ${book.title} tidak boleh dipilih lebih dari satu kali.`);
    }

    const selectedCopies = mockBookCopies.filter(
      (copy) =>
        item.bookCopyIds.includes(copy.id) &&
        copy.bookId === book.id &&
        copy.companyId === companyId,
    );

    if (selectedCopies.length !== item.bookCopyIds.length) {
      throw new Error(`Copy buku ${book.title} tidak ditemukan.`);
    }

    const unavailableCopy = selectedCopies.find(
      (copy) => copy.status !== "AVAILABLE",
    );

    if (unavailableCopy) {
      throw new Error(`Copy ${unavailableCopy.code} tidak tersedia.`);
    }

    const counts = getBookCopyCounts(book.id, book.companyId);

    if (selectedCopies.length > counts.availableCopies) {
      throw new Error(
        `Jumlah copy buku ${book.title} melebihi copy yang tersedia.`,
      );
    }

    return { book, selectedCopies };
  });

  const now = new Date().toISOString();
  const loanNumber = generateLoanNumber(company, data.borrowedAt);

  const loan: Loan = {
    id: `loan-${Date.now()}`,
    companyId,
    loanNumber,
    memberId: data.memberId,
    borrowedBy: getCurrentSession().user.id,
    borrowedAt: data.borrowedAt,
    dueAt: data.dueAt,
    returnedAt: undefined,
    status: "ACTIVE",
    notes: undefined,
    createdAt: now,
    updatedAt: now,
  };

  mockLoans.push(loan);

  let itemIndex = 0;

  for (const { book, selectedCopies } of validatedItems) {
    selectedCopies.forEach((copy) => {
      copy.status = "BORROWED";
      copy.updatedAt = now;

      const loanItem: LoanItem = {
        id: `loan-item-${Date.now()}-${itemIndex++}-${Math.random()
          .toString(36)
          .slice(2)}`,
        companyId,
        loanId: loan.id,
        bookId: book.id,
        bookCopyId: copy.id,
        returnedAt: undefined,
        status: "BORROWED",
        createdAt: now,
        updatedAt: now,
      };

      mockLoanItems.push(loanItem);
    });

    syncBookAvailability(book);
  }

  persistMockState();

  return loan;
}

/* =========================================================
   TRANSACTIONS
========================================================= */

export async function getTransactions(): Promise<
  TransactionData[]
> {
  ensureMockStoreHydrated();
  await delay();

  const companyId = getCurrentSession().user.companyId;

  syncLoanStatuses();
  syncAllBooks();

  return mockLoans
    .filter(
      (loan) =>
        loan.companyId ===
        companyId,
    )
    .map((loan) => {
      const member =
        mockMembers.find(
          (item) =>
            item.id ===
              loan.memberId &&
            item.companyId ===
              loan.companyId,
        );

      const user =
        mockUsers.find(
          (item) =>
            item.id ===
              loan.borrowedBy &&
            item.companyId ===
              loan.companyId,
        );

      const items =
        mockLoanItems
          .filter(
            (item) =>
              item.loanId ===
                loan.id &&
              item.companyId ===
                loan.companyId,
          )
          .map((loanItem) => {
            const book =
              mockBooks.find(
                (item) =>
                  item.id ===
                    loanItem.bookId &&
                  item.companyId ===
                    loan.companyId,
              );

            const bookCopy =
              mockBookCopies.find(
                (item) =>
                  item.id ===
                    loanItem.bookCopyId &&
                  item.bookId ===
                    loanItem.bookId &&
                  item.companyId ===
                    loan.companyId,
              );

            return {
              loanItem,
              book: book!,
              bookCopy: bookCopy!,
            };
          })
          .filter(
            (item) =>
              item.book &&
              item.bookCopy,
          );

      return {
        loan,
        member: member!,
        user: user!,
        items,
      };
    })
    .filter(
      (item) =>
        item.member &&
        item.user &&
        item.items.length > 0,
    );
}

/* =========================================================
   RETURN
========================================================= */

export async function returnLoanItems(
  loanId: string,
  loanItemIds: string[],
): Promise<Loan> {
  ensureMockStoreHydrated();
  await delay();

  const companyId = getCurrentSession().user.companyId;
  syncLoanStatuses();

  /* -----------------------------------------
     CARI LOAN
  ----------------------------------------- */

  const loan =
    mockLoans.find(
      (item) =>
        item.id === loanId &&
        item.companyId ===
          companyId,
    );

  if (!loan) {
    throw new Error(
      "Transaksi tidak ditemukan.",
    );
  }

  /* -----------------------------------------
     CARI ITEM
  ----------------------------------------- */

  const selectedItems =
    mockLoanItems.filter(
      (item) =>
        item.loanId === loanId &&
        item.companyId ===
          companyId &&
        loanItemIds.includes(
          item.id,
        ) &&
        item.status ===
          "BORROWED",
    );

  if (
    selectedItems.length === 0
  ) {
    throw new Error(
      "Tidak ada buku yang dapat dikembalikan.",
    );
  }

  const now =
    new Date().toISOString();

  /* -----------------------------------------
     RETURN COPY
  ----------------------------------------- */

  selectedItems.forEach(
    (item) => {
      item.status =
        "RETURNED";

      item.returnedAt =
        now;

      item.updatedAt =
        now;

      /* -------------------------------------
         UPDATE BOOK COPY
      ------------------------------------- */

      const copy =
        mockBookCopies.find(
          (bookCopy) =>
            bookCopy.id ===
              item.bookCopyId &&
            bookCopy.bookId ===
              item.bookId &&
            bookCopy.companyId ===
              companyId,
        );

      if (copy) {
        copy.status =
          "AVAILABLE";

        copy.updatedAt =
          now;
      }

      /* -------------------------------------
         SYNC BOOK
      ------------------------------------- */

      const book =
        mockBooks.find(
          (bookItem) =>
            bookItem.id ===
              item.bookId &&
            bookItem.companyId ===
              companyId,
        );

      if (book) {
        syncBookAvailability(
          book,
        );
      }
    },
  );

  /* -----------------------------------------
     CEK ITEM TERSISA
  ----------------------------------------- */

  const remainingItems =
    mockLoanItems.filter(
      (item) =>
        item.loanId === loanId &&
        item.companyId ===
          companyId &&
        item.status ===
          "BORROWED",
    );

  /* -----------------------------------------
     SEMUA KEMBALI
  ----------------------------------------- */

  if (
    remainingItems.length === 0
  ) {
    loan.status =
      "COMPLETED";

    loan.returnedAt =
      now;
  }

  /* -----------------------------------------
     JIKA MASIH ADA ITEM
  ----------------------------------------- */

  else {
    const isOverdue =
      new Date(
        loan.dueAt,
      ).getTime() <
      new Date(
        now,
      ).getTime();

    loan.status =
      isOverdue
        ? "OVERDUE"
        : "ACTIVE";
  }

  loan.updatedAt =
    now;

  persistMockState();

  return loan;
}

/* =========================================================
   RETURN LOANS
========================================================= */

export async function getReturnLoans(): Promise<
  ReturnLoanData[]
> {
  ensureMockStoreHydrated();
  await delay();

  const companyId = getCurrentSession().user.companyId;

  syncAllBooks();

  return mockLoans
    .filter(
      (loan) =>
        loan.companyId ===
          companyId &&
        (
          loan.status ===
            "ACTIVE" ||
          loan.status ===
            "OVERDUE"
        ),
    )
    .map((loan) => {
      const member =
        mockMembers.find(
          (item) =>
            item.id ===
              loan.memberId &&
            item.companyId ===
              loan.companyId,
        );

      const items =
        mockLoanItems
          .filter(
            (item) =>
              item.loanId ===
                loan.id &&
              item.companyId ===
                companyId &&
              (item.status ===
                "BORROWED" ||
                item.status ===
                  "RETURNED"),
          )
          .map((loanItem) => {
            const book =
              mockBooks.find(
                (item) =>
                  item.id ===
                    loanItem.bookId &&
                  item.companyId ===
                    companyId,
              );

            const bookCopy =
              mockBookCopies.find(
                (item) =>
                  item.id ===
                    loanItem.bookCopyId &&
                  item.bookId ===
                    loanItem.bookId &&
                  item.companyId ===
                    companyId,
              );

            return {
              loanItem,
              book: book!,
              bookCopy: bookCopy!,
            };
          })
          .filter(
            (item) =>
              item.book &&
              item.bookCopy,
          );

      return {
        loan,
        member: member!,
        items,
      };
    })
    .filter(
      (item) =>
        item.member &&
        item.items.length > 0,
    );
}

export async function getMembers(): Promise<Member[]> {
  ensureMockStoreHydrated();
  await delay(300);

  const companyId = getCurrentSession().user.companyId;

  return mockMembers
    .filter(
      (member) =>
        member.companyId === companyId &&
        member.status === "ACTIVE",
    )
    .map((member) => ({
      ...member,
    }));
}
