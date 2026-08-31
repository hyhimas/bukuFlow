export type CompanyStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED";

export type UserRole =
  | "SUPER_ADMIN"
  | "COMPANY_ADMIN"
  | "STAFF"
  | "MEMBER";

export type UserStatus =
  | "ACTIVE"
  | "INACTIVE";

export type BookStatus =
  | "AVAILABLE"
  | "BORROWED"
  | "INACTIVE";

export type BookCopyStatus =
  | "AVAILABLE"
  | "BORROWED"
  | "INACTIVE"
  | "LOST";

export type MemberStatus =
  | "ACTIVE"
  | "INACTIVE";

export type LoanStatus =
  | "ACTIVE"
  | "OVERDUE"
  | "COMPLETED"
  | "CANCELLED";

export type LoanItemStatus =
  | "BORROWED"
  | "RETURNED";

export interface Company {
  id: string;
  code: string;
  name: string;
  logo?: string;
  address?: string;
  status: CompanyStatus;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string;
  createdAt: string;
}

export interface CompanySettings {
  id: string;
  companyId: string;
  defaultLoanDuration: number;
  maxActiveLoans: number;
  dateFormat: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

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
