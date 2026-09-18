import type {
  AuditLog,
  Book,
  BookCopy,
  Company,
  CompanySettings,
  Loan,
  LoanItem,
  Member,
  User,
} from "./types";

const d = (date: string) => date;

/* =========================================================
   COMPANY
========================================================= */

export const mockCompany: Company = {
  id: "company-001",
  code: "BF001",
  name: "Perpustakaan Surakarta",
  logo: "",
  address: "Surakarta, Jawa Tengah",
  status: "ACTIVE",
  timezone: "Asia/Jakarta",
  createdAt: d("2026-08-01T08:00:00+07:00"),
  updatedAt: d("2026-08-01T08:00:00+07:00"),
};

export const mockCompany2: Company = {
  id: "company-002",
  code: "BF002",
  name: "Perpustakaan Semarang",
  logo: "",
  address: "Semarang, Jawa Tengah",
  status: "ACTIVE",
  timezone: "Asia/Jakarta",
  createdAt: d("2026-08-01T08:00:00+07:00"),
  updatedAt: d("2026-08-01T08:00:00+07:00"),
};

/* =========================================================
   COMPANY SETTINGS
========================================================= */

export const mockCompanySettings: CompanySettings = {
  id: "settings-001",
  companyId: "company-001",
  defaultLoanDuration: 7,
  maxActiveLoans: 3,
  dateFormat: "DD/MM/YYYY",
  timezone: "Asia/Jakarta",
  createdAt: d("2026-08-01T08:00:00+07:00"),
  updatedAt: d("2026-08-01T08:00:00+07:00"),
};

export const mockCompanySettings2: CompanySettings = {
  id: "settings-002",
  companyId: "company-002",
  defaultLoanDuration: 7,
  maxActiveLoans: 3,
  dateFormat: "DD/MM/YYYY",
  timezone: "Asia/Jakarta",
  createdAt: d("2026-08-01T08:00:00+07:00"),
  updatedAt: d("2026-08-01T08:00:00+07:00"),
};

/* =========================================================
   USERS
   Password semua akun: admin123
========================================================= */

export const mockUsers: User[] = [
  {
    id: "user-001",
    companyId: "company-001",
    name: "Admin Surakarta",
    email: "admin@bukuflow.id",
    username: "admin",
    passwordHash: "admin123",
    role: "COMPANY_ADMIN",
    status: "ACTIVE",
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-08-01T08:00:00+07:00"),
  },
  {
    id: "user-002",
    companyId: "company-001",
    name: "Staff Surakarta",
    email: "staff@bukuflow.id",
    username: "staff",
    passwordHash: "admin123",
    role: "STAFF",
    status: "ACTIVE",
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-08-01T08:00:00+07:00"),
  },
  {
    id: "user-003",
    companyId: "company-002",
    name: "Admin Semarang",
    email: "admin2@bukuflow.id",
    username: "admin2",
    passwordHash: "admin123",
    role: "COMPANY_ADMIN",
    status: "ACTIVE",
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-08-01T08:00:00+07:00"),
  },
  {
    id: "user-004",
    companyId: "company-002",
    name: "Staff Semarang",
    email: "staff2@bukuflow.id",
    username: "staff2",
    passwordHash: "admin123",
    role: "STAFF",
    status: "ACTIVE",
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-08-01T08:00:00+07:00"),
  },
];

/* =========================================================
   MEMBERS
========================================================= */

export const mockMembers: Member[] = [
  {
    id: "member-001",
    companyId: "company-001",
    memberNumber: "MBR-001",
    name: "Budi Santoso",
    memberType: "UMUM",
    identityNumber: "3372010101010001",
    phone: "081234567890",
    email: "budi@example.com",
    status: "ACTIVE",
    createdAt: d("2026-08-02T08:00:00+07:00"),
    updatedAt: d("2026-08-02T08:00:00+07:00"),
  },
  {
    id: "member-002",
    companyId: "company-001",
    memberNumber: "MBR-002",
    name: "Andi Pratama",
    memberType: "UMUM",
    identityNumber: "3372010303030003",
    phone: "081234567892",
    email: "andi@example.com",
    status: "ACTIVE",
    createdAt: d("2026-08-03T08:00:00+07:00"),
    updatedAt: d("2026-08-03T08:00:00+07:00"),
  },
  {
    id: "member-003",
    companyId: "company-001",
    memberNumber: "MBR-003",
    name: "Dewi Lestari",
    memberType: "MAHASISWA",
    identityNumber: "3372010404040004",
    phone: "081234567893",
    email: "dewi@example.com",
    status: "ACTIVE",
    createdAt: d("2026-08-04T08:00:00+07:00"),
    updatedAt: d("2026-08-04T08:00:00+07:00"),
  },
  {
    id: "member-004",
    companyId: "company-001",
    memberNumber: "MBR-004",
    name: "Fajar Nugroho",
    memberType: "UMUM",
    identityNumber: "3372010505050005",
    phone: "081234567894",
    email: "fajar@example.com",
    status: "ACTIVE",
    createdAt: d("2026-08-05T08:00:00+07:00"),
    updatedAt: d("2026-08-05T08:00:00+07:00"),
  },
  {
    id: "member-005",
    companyId: "company-001",
    memberNumber: "MBR-005",
    name: "Salsa Putri",
    memberType: "PELAJAR",
    identityNumber: "3372010606060006",
    phone: "081234567895",
    email: "salsa@example.com",
    status: "ACTIVE",
    createdAt: d("2026-08-06T08:00:00+07:00"),
    updatedAt: d("2026-08-06T08:00:00+07:00"),
  },
  {
    id: "member-006",
    companyId: "company-001",
    memberNumber: "MBR-006",
    name: "Rizky Maulana",
    memberType: "UMUM",
    identityNumber: "3372010707070007",
    phone: "081234567896",
    email: "rizky@example.com",
    status: "INACTIVE",
    createdAt: d("2026-08-07T08:00:00+07:00"),
    updatedAt: d("2026-08-07T08:00:00+07:00"),
  },
  {
    id: "member-007",
    companyId: "company-002",
    memberNumber: "MBR-001",
    name: "Siti Aminah",
    memberType: "UMUM",
    identityNumber: "3372010202020002",
    phone: "081234567891",
    email: "siti@example.com",
    status: "ACTIVE",
    createdAt: d("2026-08-02T08:00:00+07:00"),
    updatedAt: d("2026-08-02T08:00:00+07:00"),
  },
  {
    id: "member-008",
    companyId: "company-002",
    memberNumber: "MBR-002",
    name: "Dimas Saputra",
    memberType: "UMUM",
    identityNumber: "3372010808080008",
    phone: "081234567897",
    email: "dimas@example.com",
    status: "ACTIVE",
    createdAt: d("2026-08-03T08:00:00+07:00"),
    updatedAt: d("2026-08-03T08:00:00+07:00"),
  },
  {
    id: "member-009",
    companyId: "company-002",
    memberNumber: "MBR-003",
    name: "Nadia Permata",
    memberType: "MAHASISWA",
    identityNumber: "3372010909090009",
    phone: "081234567898",
    email: "nadia@example.com",
    status: "ACTIVE",
    createdAt: d("2026-08-04T08:00:00+07:00"),
    updatedAt: d("2026-08-04T08:00:00+07:00"),
  },
];

/* =========================================================
   BOOKS
   Kode buku dibuat singkat dan mudah diingat.
   Kode copy dibentuk otomatis dari kode buku + nomor urut.
========================================================= */

export const mockBooks: Book[] = [
  {
    id: "book-001",
    companyId: "company-001",
    code: "LP",
    isbn: "9789793062792",
    title: "Laskar Pelangi",
    author: "Andrea Hirata",
    publisher: "Bentang Pustaka",
    publicationYear: 2005,
    category: "Novel",
    coverUrl: "",
    status: "AVAILABLE",
    totalCopies: 4,
    availableCopies: 2,
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-09-12T14:00:00+07:00"),
  },
  {
    id: "book-002",
    companyId: "company-001",
    code: "BM",
    isbn: "9786020326351",
    title: "Bumi",
    author: "Tere Liye",
    publisher: "Gramedia",
    publicationYear: 2014,
    category: "Novel",
    coverUrl: "",
    status: "AVAILABLE",
    totalCopies: 5,
    availableCopies: 2,
    createdAt: d("2026-08-02T08:00:00+07:00"),
    updatedAt: d("2026-09-12T14:00:00+07:00"),
  },
  {
    id: "book-003",
    companyId: "company-001",
    code: "N5",
    isbn: "9786020326344",
    title: "Negeri 5 Menara",
    author: "Ahmad Fuadi",
    publisher: "Gramedia",
    publicationYear: 2009,
    category: "Novel",
    coverUrl: "",
    status: "AVAILABLE",
    totalCopies: 3,
    availableCopies: 3,
    createdAt: d("2026-08-03T08:00:00+07:00"),
    updatedAt: d("2026-08-03T08:00:00+07:00"),
  },
  {
    id: "book-004",
    companyId: "company-001",
    code: "FT",
    isbn: "9786020614557",
    title: "Filosofi Teras",
    author: "Henry Manampiring",
    publisher: "Kompas",
    publicationYear: 2018,
    category: "Pengembangan Diri",
    coverUrl: "",
    status: "AVAILABLE",
    totalCopies: 4,
    availableCopies: 3,
    createdAt: d("2026-08-04T08:00:00+07:00"),
    updatedAt: d("2026-09-12T14:00:00+07:00"),
  },
  {
    id: "book-005",
    companyId: "company-001",
    code: "AH",
    isbn: "9786020633176",
    title: "Atomic Habits",
    author: "James Clear",
    publisher: "Gramedia",
    publicationYear: 2018,
    category: "Pengembangan Diri",
    coverUrl: "",
    status: "AVAILABLE",
    totalCopies: 6,
    availableCopies: 3,
    createdAt: d("2026-08-05T08:00:00+07:00"),
    updatedAt: d("2026-09-12T14:00:00+07:00"),
  },
  {
    id: "book-006",
    companyId: "company-001",
    code: "PW",
    isbn: "9786024246945",
    title: "Pemrograman Web Modern",
    author: "Budi Raharjo",
    publisher: "Informatika",
    publicationYear: 2022,
    category: "Teknologi",
    coverUrl: "",
    status: "BORROWED",
    totalCopies: 3,
    availableCopies: 0,
    createdAt: d("2026-08-06T08:00:00+07:00"),
    updatedAt: d("2026-09-12T14:00:00+07:00"),
  },
  {
    id: "book-007",
    companyId: "company-001",
    code: "DJ",
    isbn: "9786024247003",
    title: "Dasar Pemrograman JavaScript",
    author: "Rizky Adi",
    publisher: "Informatika",
    publicationYear: 2023,
    category: "Teknologi",
    coverUrl: "",
    status: "AVAILABLE",
    totalCopies: 3,
    availableCopies: 1,
    createdAt: d("2026-08-07T08:00:00+07:00"),
    updatedAt: d("2026-08-15T08:00:00+07:00"),
  },
  {
    id: "book-008",
    companyId: "company-002",
    code: "AH",
    isbn: "9786020326283",
    title: "Atomic Habits",
    author: "James Clear",
    publisher: "Gramedia",
    publicationYear: 2018,
    category: "Pengembangan Diri",
    coverUrl: "",
    status: "BORROWED",
    totalCopies: 3,
    availableCopies: 2,
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-09-10T10:00:00+07:00"),
  },
  {
    id: "book-009",
    companyId: "company-002",
    code: "BS",
    isbn: "9786020627182",
    title: "Bicara Itu Ada Seninya",
    author: "Oh Su Hyang",
    publisher: "Bhuana Ilmu Populer",
    publicationYear: 2018,
    category: "Komunikasi",
    coverUrl: "",
    status: "AVAILABLE",
    totalCopies: 3,
    availableCopies: 3,
    createdAt: d("2026-08-07T08:00:00+07:00"),
    updatedAt: d("2026-08-07T08:00:00+07:00"),
  },
];

/* =========================================================
   BOOK COPIES
   Format: {KODE-BUKU}-{NNN}
========================================================= */

export const mockBookCopies: BookCopy[] = [
  // LP
  {
    id: "book-copy-001",
    companyId: "company-001",
    bookId: "book-001",
    code: "LP-001",
    status: "BORROWED",
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-08-10T09:00:00+07:00"),
  },
  {
    id: "book-copy-002",
    companyId: "company-001",
    bookId: "book-001",
    code: "LP-002",
    status: "BORROWED",
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-08-26T11:00:00+07:00"),
  },
  {
    id: "book-copy-003",
    companyId: "company-001",
    bookId: "book-001",
    code: "LP-003",
    status: "AVAILABLE",
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-09-05T15:00:00+07:00"),
  },
  {
    id: "book-copy-004",
    companyId: "company-001",
    bookId: "book-001",
    code: "LP-004",
    status: "AVAILABLE",
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-08-01T08:00:00+07:00"),
  },

  // BM
  {
    id: "book-copy-005",
    companyId: "company-001",
    bookId: "book-002",
    code: "BM-001",
    status: "BORROWED",
    createdAt: d("2026-08-02T08:00:00+07:00"),
    updatedAt: d("2026-08-25T10:00:00+07:00"),
  },
  {
    id: "book-copy-006",
    companyId: "company-001",
    bookId: "book-002",
    code: "BM-002",
    status: "BORROWED",
    createdAt: d("2026-08-02T08:00:00+07:00"),
    updatedAt: d("2026-08-26T11:00:00+07:00"),
  },
  {
    id: "book-copy-007",
    companyId: "company-001",
    bookId: "book-002",
    code: "BM-003",
    status: "BORROWED",
    createdAt: d("2026-08-02T08:00:00+07:00"),
    updatedAt: d("2026-08-20T10:00:00+07:00"),
  },
  {
    id: "book-copy-008",
    companyId: "company-001",
    bookId: "book-002",
    code: "BM-004",
    status: "AVAILABLE",
    createdAt: d("2026-08-02T08:00:00+07:00"),
    updatedAt: d("2026-08-02T08:00:00+07:00"),
  },
  {
    id: "book-copy-009",
    companyId: "company-001",
    bookId: "book-002",
    code: "BM-005",
    status: "AVAILABLE",
    createdAt: d("2026-08-02T08:00:00+07:00"),
    updatedAt: d("2026-08-02T08:00:00+07:00"),
  },

  // N5
  {
    id: "book-copy-010",
    companyId: "company-001",
    bookId: "book-003",
    code: "N5-001",
    status: "AVAILABLE",
    createdAt: d("2026-08-03T08:00:00+07:00"),
    updatedAt: d("2026-08-03T08:00:00+07:00"),
  },
  {
    id: "book-copy-011",
    companyId: "company-001",
    bookId: "book-003",
    code: "N5-002",
    status: "AVAILABLE",
    createdAt: d("2026-08-03T08:00:00+07:00"),
    updatedAt: d("2026-08-03T08:00:00+07:00"),
  },
  {
    id: "book-copy-012",
    companyId: "company-001",
    bookId: "book-003",
    code: "N5-003",
    status: "AVAILABLE",
    createdAt: d("2026-08-03T08:00:00+07:00"),
    updatedAt: d("2026-08-03T08:00:00+07:00"),
  },

  // FT
  {
    id: "book-copy-013",
    companyId: "company-001",
    bookId: "book-004",
    code: "FT-001",
    status: "BORROWED",
    createdAt: d("2026-08-04T08:00:00+07:00"),
    updatedAt: d("2026-08-05T09:00:00+07:00"),
  },
  {
    id: "book-copy-014",
    companyId: "company-001",
    bookId: "book-004",
    code: "FT-002",
    status: "AVAILABLE",
    createdAt: d("2026-08-04T08:00:00+07:00"),
    updatedAt: d("2026-08-04T08:00:00+07:00"),
  },
  {
    id: "book-copy-015",
    companyId: "company-001",
    bookId: "book-004",
    code: "FT-003",
    status: "AVAILABLE",
    createdAt: d("2026-08-04T08:00:00+07:00"),
    updatedAt: d("2026-08-04T08:00:00+07:00"),
  },
  {
    id: "book-copy-016",
    companyId: "company-001",
    bookId: "book-004",
    code: "FT-004",
    status: "AVAILABLE",
    createdAt: d("2026-08-04T08:00:00+07:00"),
    updatedAt: d("2026-08-04T08:00:00+07:00"),
  },

  // AH company 1
  {
    id: "book-copy-017",
    companyId: "company-001",
    bookId: "book-005",
    code: "AH-001",
    status: "BORROWED",
    createdAt: d("2026-08-05T08:00:00+07:00"),
    updatedAt: d("2026-09-10T09:00:00+07:00"),
  },
  {
    id: "book-copy-018",
    companyId: "company-001",
    bookId: "book-005",
    code: "AH-002",
    status: "BORROWED",
    createdAt: d("2026-08-05T08:00:00+07:00"),
    updatedAt: d("2026-09-12T11:00:00+07:00"),
  },
  {
    id: "book-copy-019",
    companyId: "company-001",
    bookId: "book-005",
    code: "AH-003",
    status: "BORROWED",
    createdAt: d("2026-08-05T08:00:00+07:00"),
    updatedAt: d("2026-09-12T11:00:00+07:00"),
  },
  {
    id: "book-copy-020",
    companyId: "company-001",
    bookId: "book-005",
    code: "AH-004",
    status: "AVAILABLE",
    createdAt: d("2026-08-05T08:00:00+07:00"),
    updatedAt: d("2026-08-05T08:00:00+07:00"),
  },
  {
    id: "book-copy-021",
    companyId: "company-001",
    bookId: "book-005",
    code: "AH-005",
    status: "AVAILABLE",
    createdAt: d("2026-08-05T08:00:00+07:00"),
    updatedAt: d("2026-08-05T08:00:00+07:00"),
  },
  {
    id: "book-copy-022",
    companyId: "company-001",
    bookId: "book-005",
    code: "AH-006",
    status: "AVAILABLE",
    createdAt: d("2026-08-05T08:00:00+07:00"),
    updatedAt: d("2026-08-05T08:00:00+07:00"),
  },

  // PW
  {
    id: "book-copy-023",
    companyId: "company-001",
    bookId: "book-006",
    code: "PW-001",
    status: "BORROWED",
    createdAt: d("2026-08-06T08:00:00+07:00"),
    updatedAt: d("2026-09-12T11:00:00+07:00"),
  },
  {
    id: "book-copy-024",
    companyId: "company-001",
    bookId: "book-006",
    code: "PW-002",
    status: "BORROWED",
    createdAt: d("2026-08-06T08:00:00+07:00"),
    updatedAt: d("2026-09-12T11:00:00+07:00"),
  },
  {
    id: "book-copy-025",
    companyId: "company-001",
    bookId: "book-006",
    code: "PW-003",
    status: "BORROWED",
    createdAt: d("2026-08-06T08:00:00+07:00"),
    updatedAt: d("2026-09-12T11:00:00+07:00"),
  },

  // DJ
  {
    id: "book-copy-026",
    companyId: "company-001",
    bookId: "book-007",
    code: "DJ-001",
    status: "BORROWED",
    createdAt: d("2026-08-07T08:00:00+07:00"),
    updatedAt: d("2026-09-12T11:00:00+07:00"),
  },
  {
    id: "book-copy-027",
    companyId: "company-001",
    bookId: "book-007",
    code: "DJ-002",
    status: "INACTIVE",
    createdAt: d("2026-08-07T08:00:00+07:00"),
    updatedAt: d("2026-08-15T08:00:00+07:00"),
  },
  {
    id: "book-copy-028",
    companyId: "company-001",
    bookId: "book-007",
    code: "DJ-003",
    status: "LOST",
    createdAt: d("2026-08-07T08:00:00+07:00"),
    updatedAt: d("2026-08-15T08:00:00+07:00"),
  },

  // AH company 2
  {
    id: "book-copy-029",
    companyId: "company-002",
    bookId: "book-008",
    code: "AH-001",
    status: "BORROWED",
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-09-10T10:00:00+07:00"),
  },
  {
    id: "book-copy-030",
    companyId: "company-002",
    bookId: "book-008",
    code: "AH-002",
    status: "AVAILABLE",
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-08-01T08:00:00+07:00"),
  },
  {
    id: "book-copy-031",
    companyId: "company-002",
    bookId: "book-008",
    code: "AH-003",
    status: "AVAILABLE",
    createdAt: d("2026-08-01T08:00:00+07:00"),
    updatedAt: d("2026-08-01T08:00:00+07:00"),
  },

  // BS
  {
    id: "book-copy-032",
    companyId: "company-002",
    bookId: "book-009",
    code: "BS-001",
    status: "AVAILABLE",
    createdAt: d("2026-08-07T08:00:00+07:00"),
    updatedAt: d("2026-08-07T08:00:00+07:00"),
  },
  {
    id: "book-copy-033",
    companyId: "company-002",
    bookId: "book-009",
    code: "BS-002",
    status: "AVAILABLE",
    createdAt: d("2026-08-07T08:00:00+07:00"),
    updatedAt: d("2026-08-07T08:00:00+07:00"),
  },
  {
    id: "book-copy-034",
    companyId: "company-002",
    bookId: "book-009",
    code: "BS-003",
    status: "AVAILABLE",
    createdAt: d("2026-08-07T08:00:00+07:00"),
    updatedAt: d("2026-08-07T08:00:00+07:00"),
  },
];

/* =========================================================
   LOANS
========================================================= */

export const mockLoans: Loan[] = [
  {
    id: "loan-001",
    companyId: "company-001",
    loanNumber: "BF001-2026-000001",
    memberId: "member-001",
    borrowedBy: "user-002",
    borrowedAt: d("2026-08-10T09:00:00+07:00"),
    dueAt: d("2026-08-17T09:00:00+07:00"),
    returnedAt: undefined,
    status: "OVERDUE",
    notes: "",
    createdAt: d("2026-08-10T09:00:00+07:00"),
    updatedAt: d("2026-08-10T09:00:00+07:00"),
  },
  {
    id: "loan-002",
    companyId: "company-001",
    loanNumber: "BF001-2026-000002",
    memberId: "member-002",
    borrowedBy: "user-002",
    borrowedAt: d("2026-08-25T10:00:00+07:00"),
    dueAt: d("2026-09-01T10:00:00+07:00"),
    returnedAt: undefined,
    status: "OVERDUE",
    notes: "",
    createdAt: d("2026-08-25T10:00:00+07:00"),
    updatedAt: d("2026-08-25T10:00:00+07:00"),
  },
  {
    id: "loan-003",
    companyId: "company-001",
    loanNumber: "BF001-2026-000003",
    memberId: "member-003",
    borrowedBy: "user-002",
    borrowedAt: d("2026-08-26T11:00:00+07:00"),
    dueAt: d("2026-09-02T11:00:00+07:00"),
    returnedAt: undefined,
    status: "OVERDUE",
    notes: "",
    createdAt: d("2026-08-26T11:00:00+07:00"),
    updatedAt: d("2026-08-26T11:00:00+07:00"),
  },
  {
    id: "loan-004",
    companyId: "company-001",
    loanNumber: "BF001-2026-000004",
    memberId: "member-004",
    borrowedBy: "user-002",
    borrowedAt: d("2026-08-05T09:00:00+07:00"),
    dueAt: d("2026-08-12T09:00:00+07:00"),
    returnedAt: undefined,
    status: "OVERDUE",
    notes: "",
    createdAt: d("2026-08-05T09:00:00+07:00"),
    updatedAt: d("2026-08-05T09:00:00+07:00"),
  },
  {
    id: "loan-005",
    companyId: "company-001",
    loanNumber: "BF001-2026-000005",
    memberId: "member-005",
    borrowedBy: "user-002",
    borrowedAt: d("2026-08-01T09:00:00+07:00"),
    dueAt: d("2026-08-08T09:00:00+07:00"),
    returnedAt: d("2026-08-07T14:00:00+07:00"),
    status: "COMPLETED",
    notes: "",
    createdAt: d("2026-08-01T09:00:00+07:00"),
    updatedAt: d("2026-08-07T14:00:00+07:00"),
  },
  {
    id: "loan-006",
    companyId: "company-001",
    loanNumber: "BF001-2026-000006",
    memberId: "member-001",
    borrowedBy: "user-002",
    borrowedAt: d("2026-08-03T10:00:00+07:00"),
    dueAt: d("2026-08-10T10:00:00+07:00"),
    returnedAt: d("2026-08-09T15:00:00+07:00"),
    status: "COMPLETED",
    notes: "",
    createdAt: d("2026-08-03T10:00:00+07:00"),
    updatedAt: d("2026-08-09T15:00:00+07:00"),
  },
  {
    id: "loan-007",
    companyId: "company-001",
    loanNumber: "BF001-2026-000007",
    memberId: "member-002",
    borrowedBy: "user-002",
    borrowedAt: d("2026-08-08T13:00:00+07:00"),
    dueAt: d("2026-08-15T13:00:00+07:00"),
    returnedAt: d("2026-08-14T16:00:00+07:00"),
    status: "COMPLETED",
    notes: "",
    createdAt: d("2026-08-08T13:00:00+07:00"),
    updatedAt: d("2026-08-14T16:00:00+07:00"),
  },
  {
    id: "loan-008",
    companyId: "company-001",
    loanNumber: "BF001-2026-000008",
    memberId: "member-001",
    borrowedBy: "user-002",
    borrowedAt: d("2026-09-10T09:00:00+07:00"),
    dueAt: d("2026-09-20T09:00:00+07:00"),
    returnedAt: undefined,
    status: "ACTIVE",
    notes: "Peminjaman aktif.",
    createdAt: d("2026-09-10T09:00:00+07:00"),
    updatedAt: d("2026-09-10T09:00:00+07:00"),
  },
  {
    id: "loan-009",
    companyId: "company-001",
    loanNumber: "BF001-2026-000009",
    memberId: "member-002",
    borrowedBy: "user-002",
    borrowedAt: d("2026-09-08T10:00:00+07:00"),
    dueAt: d("2026-09-18T10:00:00+07:00"),
    returnedAt: undefined,
    status: "ACTIVE",
    notes: "Sebagian buku sudah dikembalikan.",
    createdAt: d("2026-09-08T10:00:00+07:00"),
    updatedAt: d("2026-09-12T14:00:00+07:00"),
  },
  {
    id: "loan-010",
    companyId: "company-001",
    loanNumber: "BF001-2026-000010",
    memberId: "member-003",
    borrowedBy: "user-002",
    borrowedAt: d("2026-08-20T10:00:00+07:00"),
    dueAt: d("2026-08-27T10:00:00+07:00"),
    returnedAt: undefined,
    status: "OVERDUE",
    notes: "Sebagian buku sudah dikembalikan, satu copy masih terlambat.",
    createdAt: d("2026-08-20T10:00:00+07:00"),
    updatedAt: d("2026-09-05T15:00:00+07:00"),
  },
  {
    id: "loan-011",
    companyId: "company-001",
    loanNumber: "BF001-2026-000011",
    memberId: "member-004",
    borrowedBy: "user-002",
    borrowedAt: d("2026-09-12T11:00:00+07:00"),
    dueAt: d("2026-09-22T11:00:00+07:00"),
    returnedAt: undefined,
    status: "ACTIVE",
    notes: "Peminjaman beberapa copy.",
    createdAt: d("2026-09-12T11:00:00+07:00"),
    updatedAt: d("2026-09-12T11:00:00+07:00"),
  },
  {
    id: "loan-012",
    companyId: "company-002",
    loanNumber: "BF002-2026-000001",
    memberId: "member-007",
    borrowedBy: "user-004",
    borrowedAt: d("2026-09-10T10:00:00+07:00"),
    dueAt: d("2026-09-20T10:00:00+07:00"),
    returnedAt: undefined,
    status: "ACTIVE",
    notes: "",
    createdAt: d("2026-09-10T10:00:00+07:00"),
    updatedAt: d("2026-09-10T10:00:00+07:00"),
  },
];

/* =========================================================
   LOAN ITEMS
========================================================= */

export const mockLoanItems: LoanItem[] = [
  {
    id: "loan-item-001",
    companyId: "company-001",
    loanId: "loan-001",
    bookId: "book-001",
    bookCopyId: "book-copy-001",
    returnedAt: undefined,
    status: "BORROWED",
    createdAt: d("2026-08-10T09:00:00+07:00"),
    updatedAt: d("2026-08-10T09:00:00+07:00"),
  },
  {
    id: "loan-item-002",
    companyId: "company-001",
    loanId: "loan-002",
    bookId: "book-002",
    bookCopyId: "book-copy-005",
    returnedAt: undefined,
    status: "BORROWED",
    createdAt: d("2026-08-25T10:00:00+07:00"),
    updatedAt: d("2026-08-25T10:00:00+07:00"),
  },
  {
    id: "loan-item-003",
    companyId: "company-001",
    loanId: "loan-003",
    bookId: "book-001",
    bookCopyId: "book-copy-002",
    returnedAt: undefined,
    status: "BORROWED",
    createdAt: d("2026-08-26T11:00:00+07:00"),
    updatedAt: d("2026-08-26T11:00:00+07:00"),
  },
  {
    id: "loan-item-004",
    companyId: "company-001",
    loanId: "loan-003",
    bookId: "book-002",
    bookCopyId: "book-copy-006",
    returnedAt: undefined,
    status: "BORROWED",
    createdAt: d("2026-08-26T11:00:00+07:00"),
    updatedAt: d("2026-08-26T11:00:00+07:00"),
  },
  {
    id: "loan-item-005",
    companyId: "company-001",
    loanId: "loan-004",
    bookId: "book-004",
    bookCopyId: "book-copy-013",
    returnedAt: undefined,
    status: "BORROWED",
    createdAt: d("2026-08-05T09:00:00+07:00"),
    updatedAt: d("2026-08-05T09:00:00+07:00"),
  },
  {
    id: "loan-item-006",
    companyId: "company-001",
    loanId: "loan-005",
    bookId: "book-003",
    bookCopyId: "book-copy-010",
    returnedAt: d("2026-08-07T14:00:00+07:00"),
    status: "RETURNED",
    createdAt: d("2026-08-01T09:00:00+07:00"),
    updatedAt: d("2026-08-07T14:00:00+07:00"),
  },
  {
    id: "loan-item-007",
    companyId: "company-001",
    loanId: "loan-006",
    bookId: "book-003",
    bookCopyId: "book-copy-011",
    returnedAt: d("2026-08-09T15:00:00+07:00"),
    status: "RETURNED",
    createdAt: d("2026-08-03T10:00:00+07:00"),
    updatedAt: d("2026-08-09T15:00:00+07:00"),
  },
  {
    id: "loan-item-008",
    companyId: "company-001",
    loanId: "loan-007",
    bookId: "book-004",
    bookCopyId: "book-copy-014",
    returnedAt: d("2026-08-14T16:00:00+07:00"),
    status: "RETURNED",
    createdAt: d("2026-08-08T13:00:00+07:00"),
    updatedAt: d("2026-08-14T16:00:00+07:00"),
  },
  {
    id: "loan-item-009",
    companyId: "company-001",
    loanId: "loan-008",
    bookId: "book-005",
    bookCopyId: "book-copy-017",
    returnedAt: undefined,
    status: "BORROWED",
    createdAt: d("2026-09-10T09:00:00+07:00"),
    updatedAt: d("2026-09-10T09:00:00+07:00"),
  },
  {
    id: "loan-item-010",
    companyId: "company-001",
    loanId: "loan-009",
    bookId: "book-005",
    bookCopyId: "book-copy-018",
    returnedAt: d("2026-09-12T14:00:00+07:00"),
    status: "RETURNED",
    createdAt: d("2026-09-08T10:00:00+07:00"),
    updatedAt: d("2026-09-12T14:00:00+07:00"),
  },
  {
    id: "loan-item-011",
    companyId: "company-001",
    loanId: "loan-009",
    bookId: "book-005",
    bookCopyId: "book-copy-019",
    returnedAt: undefined,
    status: "BORROWED",
    createdAt: d("2026-09-08T10:00:00+07:00"),
    updatedAt: d("2026-09-08T10:00:00+07:00"),
  },
  {
    id: "loan-item-012",
    companyId: "company-001",
    loanId: "loan-010",
    bookId: "book-001",
    bookCopyId: "book-copy-003",
    returnedAt: d("2026-09-05T15:00:00+07:00"),
    status: "RETURNED",
    createdAt: d("2026-08-20T10:00:00+07:00"),
    updatedAt: d("2026-09-05T15:00:00+07:00"),
  },
  {
    id: "loan-item-013",
    companyId: "company-001",
    loanId: "loan-010",
    bookId: "book-002",
    bookCopyId: "book-copy-007",
    returnedAt: undefined,
    status: "BORROWED",
    createdAt: d("2026-08-20T10:00:00+07:00"),
    updatedAt: d("2026-08-20T10:00:00+07:00"),
  },
  {
    id: "loan-item-014",
    companyId: "company-001",
    loanId: "loan-011",
    bookId: "book-006",
    bookCopyId: "book-copy-023",
    returnedAt: undefined,
    status: "BORROWED",
    createdAt: d("2026-09-12T11:00:00+07:00"),
    updatedAt: d("2026-09-12T11:00:00+07:00"),
  },
  {
    id: "loan-item-015",
    companyId: "company-001",
    loanId: "loan-011",
    bookId: "book-007",
    bookCopyId: "book-copy-026",
    returnedAt: undefined,
    status: "BORROWED",
    createdAt: d("2026-09-12T11:00:00+07:00"),
    updatedAt: d("2026-09-12T11:00:00+07:00"),
  },
  {
    id: "loan-item-016",
    companyId: "company-002",
    loanId: "loan-012",
    bookId: "book-008",
    bookCopyId: "book-copy-029",
    returnedAt: undefined,
    status: "BORROWED",
    createdAt: d("2026-09-10T10:00:00+07:00"),
    updatedAt: d("2026-09-10T10:00:00+07:00"),
  },
];

/* =========================================================
   AUDIT LOG
========================================================= */

export const mockAuditLogs: AuditLog[] = [];
/* =========================================================
   DATA TAMBAHAN UNTUK PENGUJIAN
   - Pagination
   - Search & filter
   - Company isolation
   - Semua variasi status
   Data dibuat deterministik agar konsisten setiap sesi.
========================================================= */

const extraMemberNames = [
  "Agus Setiawan",
  "Aulia Rahma",
  "Bagas Prakoso",
  "Bella Anindita",
  "Citra Wulandari",
  "Daffa Ramadhan",
  "Dian Permata",
  "Eka Saputra",
  "Farhan Akbar",
  "Gita Maharani",
  "Hana Safitri",
  "Ilham Kurniawan",
  "Intan Sari",
  "Joko Susilo",
  "Karin Amelia",
  "Lukman Hakim",
  "Maya Anggraini",
  "Naufal Hidayat",
  "Oki Pratama",
  "Putri Ayu",
  "Rafi Maulana",
  "Rani Oktaviani",
  "Satria Nugraha",
  "Tania Putri",
  "Umar Faruk",
  "Vina Lestari",
  "Wahyu Firmansyah",
  "Yuni Kartika",
  "Zaki Ramadhan",
  "Aditya Nugroho",
];

const memberTypes = ["UMUM", "MAHASISWA", "PELAJAR"];

for (let i = 0; i < extraMemberNames.length; i += 1) {
  const number = i + 10;
  const companyId = i < 24 ? "company-001" : "company-002";
  const sequence = i < 24 ? i + 8 : i - 20;
  const isInactive = i % 7 === 0;

  mockMembers.push({
    id: `member-extra-${String(i + 1).padStart(3, "0")}`,
    companyId,
    memberNumber: `MBR-${String(sequence).padStart(3, "0")}`,
    name: extraMemberNames[i],
    memberType: memberTypes[i % memberTypes.length],
    identityNumber: `337201${String(number).padStart(2, "0")}1010${String(number).padStart(4, "0")}`,
    phone: `08123${String(450000 + i).padStart(6, "0")}`,
    email: `${extraMemberNames[i].toLowerCase().replaceAll(" ", ".")}@example.com`,
    status: isInactive ? "INACTIVE" : "ACTIVE",
    createdAt: d(`2026-08-${String(10 + (i % 20)).padStart(2, "0")}T08:00:00+07:00`),
    updatedAt: d(`2026-09-${String(1 + (i % 15)).padStart(2, "0")}T09:00:00+07:00`),
  });
}

const extraBookDefinitions = [
  ["PP", "Pengantar Pemrograman", "Rosa A.S.", "Teknologi"],
  ["DB", "Dasar Basis Data", "Abdul Kadir", "Teknologi"],
  ["JS", "JavaScript untuk Pemula", "Eko Kurniawan", "Teknologi"],
  ["WD", "Web Development Modern", "Fajar Nugraha", "Teknologi"],
  ["UI", "Desain Antarmuka Digital", "Dina Larasati", "Desain"],
  ["UX", "Pengalaman Pengguna", "Arif Rahman", "Desain"],
  ["ML", "Machine Learning Dasar", "Bambang S.", "Teknologi"],
  ["DS", "Data Science Praktis", "Nina Pratiwi", "Data"],
  ["PY", "Python untuk Analisis Data", "Rizal Hakim", "Teknologi"],
  ["AL", "Algoritma dan Struktur Data", "M. Farid", "Teknologi"],
  ["CN", "Computer Networking", "Dedi Irawan", "Jaringan"],
  ["OS", "Sistem Operasi", "Hendra Wijaya", "Teknologi"],
  ["SE", "Software Engineering", "Sari Melati", "Teknologi"],
  ["PM", "Manajemen Proyek TI", "Andi Wijaya", "Manajemen"],
  ["AI", "Artificial Intelligence", "Nadia Putri", "Teknologi"],
  ["CL", "Cloud Computing", "Raka Pratama", "Teknologi"],
  ["CY", "Cyber Security Dasar", "Bima Saputra", "Keamanan"],
  ["GD", "Git dan GitHub", "Yoga Permana", "Teknologi"],
  ["ST", "Statistika untuk Pemula", "Maya Sari", "Data"],
  ["AN", "Analisis Data dengan Pandas", "Rendi Akbar", "Data"],
  ["FR", "Frontend React", "Tio Ramadhan", "Teknologi"],
  ["NX", "Next.js App Router", "Dimas Haryanto", "Teknologi"],
  ["AP", "API Development", "Galih Prakoso", "Teknologi"],
  ["TC", "Testing Aplikasi Web", "Nanda Putri", "Teknologi"],
];

const extraBookIds: string[] = [];

for (let i = 0; i < extraBookDefinitions.length; i += 1) {
  const [code, title, author, category] = extraBookDefinitions[i];
  const companyId = i < 18 ? "company-001" : "company-002";
  const bookId = `book-extra-${String(i + 1).padStart(3, "0")}`;
  extraBookIds.push(bookId);

  const state = i % 6;
  const copyCount = 4;

  mockBooks.push({
    id: bookId,
    companyId,
    code,
    isbn: `978602${String(1000000 + i).padStart(7, "0")}`,
    title,
    author,
    publisher: "BukuFlow Press",
    publicationYear: 2020 + (i % 6),
    category,
    coverUrl: "",
    status:
      state === 4
        ? "INACTIVE"
        : state === 5
          ? "BORROWED"
          : "AVAILABLE",
    totalCopies: copyCount,
    availableCopies:
      state === 4
        ? 0
        : state === 5
          ? 0
          : 3,
    createdAt: d(`2026-08-${String(10 + (i % 18)).padStart(2, "0")}T08:00:00+07:00`),
    updatedAt: d(`2026-09-${String(1 + (i % 15)).padStart(2, "0")}T10:00:00+07:00`),
  });

  for (let copyIndex = 1; copyIndex <= copyCount; copyIndex += 1) {
    let status: BookCopy["status"] = "AVAILABLE";

    if (state === 4) {
      status = "INACTIVE";
    } else if (state === 5) {
      status = "BORROWED";
    } else if (copyIndex === 4 && state === 1) {
      status = "LOST";
    } else if (copyIndex === 4 && state === 2) {
      status = "INACTIVE";
    } else if (copyIndex === 1 && state === 3) {
      status = "BORROWED";
    }

    mockBookCopies.push({
      id: `book-copy-extra-${String(i * copyCount + copyIndex).padStart(3, "0")}`,
      companyId,
      bookId,
      code: `${code}-${String(copyIndex).padStart(3, "0")}`,
      status,
      createdAt: d(`2026-08-${String(10 + (i % 18)).padStart(2, "0")}T08:00:00+07:00`),
      updatedAt: d(`2026-09-${String(1 + (i % 15)).padStart(2, "0")}T10:00:00+07:00`),
    });
  }
}

/* =========================================================
   TRANSAKSI TAMBAHAN
   Status: ACTIVE, OVERDUE, COMPLETED, CANCELLED
   Jumlah cukup banyak untuk pengujian pagination.
========================================================= */

const extraLoanStatuses: Loan["status"][] = [
  "ACTIVE",
  "OVERDUE",
  "COMPLETED",
  "CANCELLED",
  "ACTIVE",
  "OVERDUE",
];

const extraTransactionBooks = mockBooks.filter((book) =>
  extraBookIds.includes(book.id),
);

for (let i = 0; i < 30; i += 1) {
  const companyId = i < 22 ? "company-001" : "company-002";
  const memberPool = mockMembers.filter(
    (member) => member.companyId === companyId,
  );
  const bookPool = extraTransactionBooks.filter(
    (book) => book.companyId === companyId,
  );

  const member = memberPool[i % memberPool.length];
  const book = bookPool[i % bookPool.length];
  const status = extraLoanStatuses[i % extraLoanStatuses.length];

  const loanId = `loan-extra-${String(i + 1).padStart(3, "0")}`;
  const loanNumber = `${
    companyId === "company-001" ? "BF001" : "BF002"
  }-2026-${String(i + 20).padStart(6, "0")}`;

  const borrowedAt = `2026-09-${String(
    1 + (i % 15),
  ).padStart(2, "0")}T${String(9 + (i % 8)).padStart(
    2,
    "0",
  )}:00:00+07:00`;

  const dueAt = `2026-09-${String(
    10 + (i % 15),
  ).padStart(2, "0")}T10:00:00+07:00`;

  const returnedAt =
    status === "COMPLETED"
      ? d(
          `2026-09-${String(
            8 + (i % 8),
          ).padStart(2, "0")}T15:00:00+07:00`,
        )
      : undefined;

  mockLoans.push({
    id: loanId,
    companyId,
    loanNumber,
    memberId: member.id,
    borrowedBy:
      companyId === "company-001" ? "user-002" : "user-004",
    borrowedAt: d(borrowedAt),
    dueAt: d(dueAt),
    returnedAt,
    status,
    notes:
      status === "ACTIVE"
        ? "Peminjaman aktif untuk data pengujian."
        : status === "OVERDUE"
          ? "Peminjaman terlambat untuk data pengujian."
          : status === "COMPLETED"
            ? "Peminjaman selesai untuk data pengujian."
            : "Transaksi dibatalkan untuk data pengujian.",
    createdAt: d(borrowedAt),
    updatedAt: d(dueAt),
  });

  if (status === "ACTIVE" || status === "OVERDUE") {
    const availableCopy = mockBookCopies.find(
      (copy) =>
        copy.companyId === companyId &&
        copy.bookId === book.id &&
        copy.status === "AVAILABLE",
    );

    if (availableCopy) {
      availableCopy.status = "BORROWED";
      availableCopy.updatedAt = d(
        "2026-09-18T10:00:00+07:00",
      );

      mockLoanItems.push({
        id: `loan-item-extra-${String(i + 1).padStart(3, "0")}`,
        companyId,
        loanId,
        bookId: book.id,
        bookCopyId: availableCopy.id,
        returnedAt: undefined,
        status: "BORROWED",
        createdAt: d(borrowedAt),
        updatedAt: d(borrowedAt),
      });
    }
  } else if (status === "COMPLETED") {
    const completedCopy = mockBookCopies.find(
      (copy) =>
        copy.companyId === companyId &&
        copy.bookId === book.id &&
        copy.status === "AVAILABLE",
    );

    if (completedCopy) {
      mockLoanItems.push({
        id: `loan-item-extra-${String(i + 1).padStart(3, "0")}`,
        companyId,
        loanId,
        bookId: book.id,
        bookCopyId: completedCopy.id,
        returnedAt,
        status: "RETURNED",
        createdAt: d(borrowedAt),
        updatedAt: returnedAt ?? d(borrowedAt),
      });
    }
  }
}

