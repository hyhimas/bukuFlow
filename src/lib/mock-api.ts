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

function delay(ms = 500) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms),
  );
}

export interface LoginResponse {
  user: User;
  company: Company;
  companySettings: CompanySettings;
}

export interface DashboardResponse {
  booksAvailable: number;
  booksBorrowed: number;
  activeLoans: number;
  overdueLoans: number;
  recentLoans: Loan[];
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
      : undefined;

  const companySettings =
    user.companyId === mockCompanySettings.companyId
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

export async function getDashboard(): Promise<DashboardResponse> {
  await delay();

  const companyBooks = mockBooks.filter(
    (book) => book.companyId === mockCompany.id,
  );

  const companyLoans = mockLoans.filter(
    (loan) => loan.companyId === mockCompany.id,
  );

  return {
    booksAvailable: companyBooks.reduce(
      (total, book) =>
        total + book.availableCopies,
      0,
    ),

    booksBorrowed: companyBooks.reduce(
      (total, book) =>
        total +
        (book.totalCopies -
          book.availableCopies),
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
          new Date(b.borrowedAt).getTime() -
          new Date(a.borrowedAt).getTime(),
      )
      .slice(0, 5),
  };
}

export async function searchMembers(
  query: string,
): Promise<Member[]> {
  await delay(300);

  const keyword = query.trim().toLowerCase();

  if (!keyword) {
    return [];
  }

  return mockMembers.filter(
    (member) =>
      member.companyId === mockCompany.id &&
      (
        member.name
          .toLowerCase()
          .includes(keyword) ||
        member.memberNumber
          .toLowerCase()
          .includes(keyword) ||
        member.identityNumber.includes(keyword) ||
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

  const now = new Date().toISOString();

  const member: Member = {
    id: `member-${Date.now()}`,
    companyId: mockCompany.id,
    memberNumber: `MBR-${String(
      mockMembers.length + 1,
    ).padStart(3, "0")}`,
    name: data.name,
    memberType: data.memberType,
    identityNumber: data.identityNumber,
    phone: data.phone,
    email: data.email,
    status: data.status,
    createdAt: now,
    updatedAt: now,
  };

  mockMembers.push(member);

  return member;
}

export async function searchBooks(
  query: string,
): Promise<Book[]> {
  await delay(300);

  const keyword = query.trim().toLowerCase();

  if (!keyword) {
    return [];
  }

  return mockBooks.filter(
    (book) =>
      book.companyId === mockCompany.id &&
      (
        book.title
          .toLowerCase()
          .includes(keyword) ||
        book.code
          .toLowerCase()
          .includes(keyword) ||
        book.isbn
          ?.toLowerCase()
          .includes(keyword)
      ),
  );
}

export async function getBookCopies(
  bookId: string,
): Promise<BookCopy[]> {
  await delay(300);

  return mockBookCopies.filter(
    (copy) =>
      copy.bookId === bookId &&
      copy.companyId === mockCompany.id,
  );
}

export async function getActiveLoans(): Promise<Loan[]> {
  await delay();

  return mockLoans.filter(
    (loan) =>
      loan.companyId === mockCompany.id &&
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

export async function createLoan(
  data: CreateLoanData,
): Promise<Loan> {
  await delay();

  if (data.bookCopyIds.length === 0) {
    throw new Error(
      "Minimal satu copy wajib dipilih.",
    );
  }

  const member = mockMembers.find(
    (item) =>
      item.id === data.memberId &&
      item.companyId === mockCompany.id &&
      item.status === "ACTIVE",
  );

  if (!member) {
    throw new Error(
      "Anggota tidak ditemukan atau tidak aktif.",
    );
  }

  const book = mockBooks.find(
    (item) =>
      item.id === data.bookId &&
      item.companyId === mockCompany.id,
  );

  if (!book) {
    throw new Error("Buku tidak ditemukan.");
  }

  if (data.dueAt < data.borrowedAt) {
    throw new Error(
      "Tanggal jatuh tempo tidak boleh sebelum tanggal peminjaman.",
    );
  }

  const selectedCopies =
    mockBookCopies.filter(
      (copy) =>
        data.bookCopyIds.includes(copy.id) &&
        copy.bookId === data.bookId &&
        copy.companyId === mockCompany.id,
    );

  if (
    selectedCopies.length !==
    data.bookCopyIds.length
  ) {
    throw new Error(
      "Copy buku yang dipilih tidak ditemukan.",
    );
  }

  const unavailableCopy =
    selectedCopies.find(
      (copy) => copy.status !== "AVAILABLE",
    );

  if (unavailableCopy) {
    throw new Error(
      "Salah satu copy buku tidak tersedia.",
    );
  }

  if (
    book.availableCopies <
    selectedCopies.length
  ) {
    throw new Error(
      "Jumlah copy yang tersedia sudah berubah.",
    );
  }

  const now = new Date().toISOString();

  const loan: Loan = {
    id: `loan-${Date.now()}`,
    companyId: mockCompany.id,
    loanNumber: `LOAN-${String(
      mockLoans.length + 1,
    ).padStart(3, "0")}`,
    memberId: data.memberId,
    borrowedBy: "user-002",
    borrowedAt: data.borrowedAt,
    dueAt: data.dueAt,
    returnedAt: undefined,
    status: "ACTIVE",
    notes: undefined,
    createdAt: now,
    updatedAt: now,
  };

  mockLoans.push(loan);

  selectedCopies.forEach((copy) => {
    copy.status = "BORROWED";
    copy.updatedAt = now;

    const loanItem: LoanItem = {
      id: `loan-item-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`,
      companyId: mockCompany.id,
      loanId: loan.id,
      bookId: data.bookId,
      bookCopyId: copy.id,
      returnedAt: undefined,
      status: "BORROWED",
      createdAt: now,
      updatedAt: now,
    };

    mockLoanItems.push(loanItem);
  });

  book.availableCopies -=
    selectedCopies.length;

  if (book.availableCopies === 0) {
    book.status = "BORROWED";
  }

  book.updatedAt = now;

  return loan;
}

export async function getTransactions(): Promise<
  TransactionData[]
> {
  await delay();

  return mockLoans
    .filter(
      (loan) =>
        loan.companyId === mockCompany.id,
    )
    .map((loan) => {
      const member = mockMembers.find(
        (item) =>
          item.id === loan.memberId &&
          item.companyId === loan.companyId,
      );

      const user = mockUsers.find(
        (item) =>
          item.id === loan.borrowedBy &&
          item.companyId === loan.companyId,
      );

      const items = mockLoanItems
        .filter(
          (item) =>
            item.loanId === loan.id &&
            item.companyId === loan.companyId,
        )
        .map((loanItem) => {
          const book = mockBooks.find(
            (item) =>
              item.id === loanItem.bookId &&
              item.companyId === loan.companyId,
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

export async function returnLoanItems(
  loanId: string,
  loanItemIds: string[],
): Promise<Loan> {
  await delay();

  const loan = mockLoans.find(
    (item) =>
      item.id === loanId &&
      item.companyId === mockCompany.id,
  );

  if (!loan) {
    throw new Error(
      "Transaksi tidak ditemukan.",
    );
  }

  const selectedItems =
    mockLoanItems.filter(
      (item) =>
        item.loanId === loanId &&
        item.companyId === mockCompany.id &&
        loanItemIds.includes(item.id) &&
        item.status === "BORROWED",
    );

  if (selectedItems.length === 0) {
    throw new Error(
      "Tidak ada buku yang dapat dikembalikan.",
    );
  }

  const now = new Date().toISOString();

  selectedItems.forEach((item) => {
    item.status = "RETURNED";
    item.returnedAt = now;
    item.updatedAt = now;

    const copy = mockBookCopies.find(
      (bookCopy) =>
        bookCopy.id === item.bookCopyId &&
        bookCopy.bookId === item.bookId &&
        bookCopy.companyId ===
          mockCompany.id,
    );

    if (copy) {
      copy.status = "AVAILABLE";
      copy.updatedAt = now;
    }

    const book = mockBooks.find(
      (bookItem) =>
        bookItem.id === item.bookId &&
        bookItem.companyId ===
          mockCompany.id,
    );

    if (book) {
      book.availableCopies += 1;

      if (book.availableCopies > 0) {
        book.status = "AVAILABLE";
      }

      book.updatedAt = now;
    }
  });

  const remainingItems =
    mockLoanItems.filter(
      (item) =>
        item.loanId === loanId &&
        item.companyId === mockCompany.id &&
        item.status === "BORROWED",
    );

  if (remainingItems.length === 0) {
    loan.status = "COMPLETED";
    loan.returnedAt = now;
  }

  loan.updatedAt = now;

  return loan;
}

export async function getReturnLoans(): Promise<
  ReturnLoanData[]
> {
  await delay();

  return mockLoans
    .filter(
      (loan) =>
        loan.companyId === mockCompany.id &&
        (
          loan.status === "ACTIVE" ||
          loan.status === "OVERDUE"
        ),
    )
    .map((loan) => {
      const member = mockMembers.find(
        (item) =>
          item.id === loan.memberId &&
          item.companyId ===
            loan.companyId,
      );

      const items = mockLoanItems
        .filter(
          (item) =>
            item.loanId === loan.id &&
            item.companyId ===
              mockCompany.id &&
            item.status === "BORROWED",
        )
        .map((loanItem) => {
          const book = mockBooks.find(
            (item) =>
              item.id === loanItem.bookId &&
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
