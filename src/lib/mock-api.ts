import {
  mockBooks,
  mockBookCopies,
  mockCompany,
  mockCompanySettings,
  mockCompanySettings2,
  mockLoanItems,
  mockLoans,
  mockMembers,
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

const MOCK_PASSWORD = "admin123";

/* =========================================================
   UTILITIES
========================================================= */

function delay(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/**
 * Sinkronisasi semua buku.
 */
function syncAllBooks() {
  mockBooks.forEach((book) => {
    syncBookAvailability(book);
  });
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
  recentLoans: Loan[];
}

export async function getDashboard(): Promise<DashboardResponse> {
  await delay();

  syncAllBooks();

  const companyBooks = mockBooks.filter(
    (book) =>
      book.companyId === mockCompany.id,
  );

  const companyLoans = mockLoans.filter(
    (loan) =>
      loan.companyId === mockCompany.id,
  );

  return {
    /**
     * Jumlah copy yang benar-benar AVAILABLE.
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
      (loan) => loan.status === "ACTIVE",
    ).length,

    overdueLoans: companyLoans.filter(
      (loan) => loan.status === "OVERDUE",
    ).length,

    recentLoans: [...companyLoans]
      .sort(
        (a, b) =>
          new Date(
            b.borrowedAt,
          ).getTime() -
          new Date(
            a.borrowedAt,
          ).getTime(),
      )
      .slice(0, 5),
  };
}

/* =========================================================
   MEMBER
========================================================= */

export async function searchMembers(
  query: string,
): Promise<Member[]> {
  await delay(300);

  const keyword =
    query.trim().toLowerCase();

  if (!keyword) {
    return [];
  }

  return mockMembers.filter(
    (member) =>
      member.companyId ===
        mockCompany.id &&
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
  await delay();

  const now =
    new Date().toISOString();

  const nextMemberNumber =
    mockMembers.filter(
      (member) =>
        member.companyId ===
        mockCompany.id,
    ).length + 1;

  const member: Member = {
    id: `member-${Date.now()}`,
    companyId: mockCompany.id,
    memberNumber: `MBR-${String(
      nextMemberNumber,
    ).padStart(3, "0")}`,
    name: data.name,
    memberType: data.memberType,
    identityNumber:
      data.identityNumber,
    phone: data.phone,
    email: data.email,
    status: data.status,
    createdAt: now,
    updatedAt: now,
  };

  mockMembers.push(member);

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
  await delay(300);

  syncAllBooks();

  return mockBooks
    .filter(
      (book) =>
        book.companyId ===
          mockCompany.id &&
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
 *   semua buku yang punya copy AVAILABLE.
 *
 * Query ada:
 *   filter berdasarkan judul, kode, ISBN.
 */
export async function searchBooks(
  query: string,
): Promise<Book[]> {
  await delay(300);

  syncAllBooks();

  const keyword =
    query.trim().toLowerCase();

  const availableBooks =
    mockBooks.filter(
      (book) =>
        book.companyId ===
          mockCompany.id &&
        book.status !== "INACTIVE" &&
        book.availableCopies > 0,
    );

  if (!keyword) {
    return availableBooks.map(
      (book) => ({
        ...book,
      }),
    );
  }

  return availableBooks
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

/**
 * Mengambil seluruh copy dari sebuah buku.
 *
 * Copy dengan status BORROWED,
 * INACTIVE, dan LOST tetap dikembalikan
 * supaya UI dapat menampilkan statusnya.
 */
export async function getBookCopies(
  bookId: string,
): Promise<BookCopy[]> {
  await delay(300);

  return mockBookCopies
    .filter(
      (copy) =>
        copy.bookId === bookId &&
        copy.companyId ===
          mockCompany.id,
    )
    .map((copy) => ({
      ...copy,
    }));
}

/* =========================================================
   LOAN
========================================================= */

export async function getActiveLoans(): Promise<Loan[]> {
  await delay();

  return mockLoans.filter(
    (loan) =>
      loan.companyId ===
        mockCompany.id &&
      (
        loan.status === "ACTIVE" ||
        loan.status === "OVERDUE"
      ),
  );
}

export interface CreateLoanData {
  memberId: string;
  bookId: string;
  bookCopyIds: string[];
  borrowedAt: string;
  dueAt: string;
}

/**
 * Generate nomor transaksi berdasarkan PRD:
 *
 * [company_code]-[tahun]-[nomor_urut]
 *
 * Contoh:
 *
 * BF001-2026-000001
 */
function generateLoanNumber(
  company: Company,
  borrowedAt: string,
): string {
  const year = new Date(
    borrowedAt,
  ).getFullYear();

  const prefix =
    `${company.code}-${year}-`;

  const lastNumber = mockLoans
    .filter(
      (loan) =>
        loan.companyId ===
          company.id &&
        loan.loanNumber.startsWith(
          prefix,
        ),
    )
    .map((loan) => {
      const numberPart =
        loan.loanNumber.slice(
          prefix.length,
        );

      const number =
        Number(numberPart);

      return Number.isFinite(number)
        ? number
        : 0;
    })
    .reduce(
      (max, number) =>
        Math.max(max, number),
      0,
    );

  return (
    `${prefix}${String(
      lastNumber + 1,
    ).padStart(6, "0")}`
  );
}

export async function createLoan(
  data: CreateLoanData,
): Promise<Loan> {
  await delay();

  syncAllBooks();

  /* -----------------------------------------
     VALIDASI COPY
  ----------------------------------------- */

  if (data.bookCopyIds.length === 0) {
    throw new Error(
      "Minimal satu copy wajib dipilih.",
    );
  }

  /* -----------------------------------------
     VALIDASI ANGGOTA
  ----------------------------------------- */

  const member = mockMembers.find(
    (item) =>
      item.id === data.memberId &&
      item.companyId ===
        mockCompany.id &&
      item.status === "ACTIVE",
  );

  if (!member) {
    throw new Error(
      "Anggota tidak ditemukan atau tidak aktif.",
    );
  }

  /* -----------------------------------------
     VALIDASI BUKU
  ----------------------------------------- */

  const book = mockBooks.find(
    (item) =>
      item.id === data.bookId &&
      item.companyId ===
        mockCompany.id,
  );

  if (!book) {
    throw new Error(
      "Buku tidak ditemukan.",
    );
  }

  /* -----------------------------------------
     VALIDASI TANGGAL
  ----------------------------------------- */

  if (data.dueAt < data.borrowedAt) {
    throw new Error(
      "Tanggal jatuh tempo tidak boleh sebelum tanggal peminjaman.",
    );
  }

  /* -----------------------------------------
     VALIDASI COPY
  ----------------------------------------- */

  const selectedCopies =
    mockBookCopies.filter(
      (copy) =>
        data.bookCopyIds.includes(
          copy.id,
        ) &&
        copy.bookId ===
          data.bookId &&
        copy.companyId ===
          mockCompany.id,
    );

  if (
    selectedCopies.length !==
    data.bookCopyIds.length
  ) {
    throw new Error(
      "Copy buku yang dipilih tidak ditemukan.",
    );
  }

  /* -----------------------------------------
     SEMUA COPY HARUS AVAILABLE
  ----------------------------------------- */

  const unavailableCopy =
    selectedCopies.find(
      (copy) =>
        copy.status !== "AVAILABLE",
    );

  if (unavailableCopy) {
    throw new Error(
      `Copy ${unavailableCopy.code} tidak tersedia.`,
    );
  }

  /* -----------------------------------------
     VALIDASI JUMLAH COPY
  ----------------------------------------- */

  const counts =
    getBookCopyCounts(
      book.id,
      book.companyId,
    );

  if (
    selectedCopies.length >
    counts.availableCopies
  ) {
    throw new Error(
      "Jumlah copy yang dipilih melebihi copy yang tersedia.",
    );
  }

  /* -----------------------------------------
     BUAT LOAN
  ----------------------------------------- */

  const now =
    new Date().toISOString();

  const loanNumber =
    generateLoanNumber(
      mockCompany,
      data.borrowedAt,
    );

  const loan: Loan = {
    id: `loan-${Date.now()}`,
    companyId:
      mockCompany.id,
    loanNumber,
    memberId:
      data.memberId,
    borrowedBy: "user-002",
    borrowedAt:
      data.borrowedAt,
    dueAt:
      data.dueAt,
    returnedAt:
      undefined,
    status: "ACTIVE",
    notes: undefined,
    createdAt: now,
    updatedAt: now,
  };

  mockLoans.push(loan);

  /* -----------------------------------------
     UPDATE BOOK COPY
  ----------------------------------------- */

  selectedCopies.forEach(
    (copy, index) => {
      copy.status = "BORROWED";
      copy.updatedAt = now;

      const loanItem: LoanItem = {
        id:
          `loan-item-${Date.now()}-${index}-${Math.random()
            .toString(36)
            .slice(2)}`,
        companyId:
          mockCompany.id,
        loanId:
          loan.id,
        bookId:
          data.bookId,
        bookCopyId:
          copy.id,
        returnedAt:
          undefined,
        status:
          "BORROWED",
        createdAt: now,
        updatedAt: now,
      };

      mockLoanItems.push(
        loanItem,
      );
    },
  );

  /* -----------------------------------------
     SINKRONISASI BOOK
  ----------------------------------------- */

  syncBookAvailability(book);

  return loan;
}

/* =========================================================
   TRANSACTIONS
========================================================= */

export async function getTransactions(): Promise<
  TransactionData[]
> {
  await delay();

  syncAllBooks();

  return mockLoans
    .filter(
      (loan) =>
        loan.companyId ===
        mockCompany.id,
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
  await delay();

  /* -----------------------------------------
     CARI LOAN
  ----------------------------------------- */

  const loan =
    mockLoans.find(
      (item) =>
        item.id === loanId &&
        item.companyId ===
          mockCompany.id,
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
          mockCompany.id &&
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
              mockCompany.id,
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
              mockCompany.id,
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
          mockCompany.id &&
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

  return loan;
}

/* =========================================================
   RETURN LOANS
========================================================= */

export async function getReturnLoans(): Promise<
  ReturnLoanData[]
> {
  await delay();

  syncAllBooks();

  return mockLoans
    .filter(
      (loan) =>
        loan.companyId ===
          mockCompany.id &&
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
                mockCompany.id &&
              item.status ===
                "BORROWED",
          )
          .map((loanItem) => {
            const book =
              mockBooks.find(
                (item) =>
                  item.id ===
                    loanItem.bookId &&
                  item.companyId ===
                    mockCompany.id,
              );

            const bookCopy =
              mockBookCopies.find(
                (item) =>
                  item.id ===
                    loanItem.bookCopyId &&
                  item.bookId ===
                    loanItem.bookId &&
                  item.companyId ===
                    mockCompany.id,
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
  await delay(300);

  return mockMembers
    .filter(
      (member) =>
        member.companyId === mockCompany.id &&
        member.status === "ACTIVE",
    )
    .map((member) => ({
      ...member,
    }));
}