import {
  mockAuditLogs as initialMockAuditLogs,
  mockBookCopies as initialMockBookCopies,
  mockBooks as initialMockBooks,
  mockLoanItems as initialMockLoanItems,
  mockLoans as initialMockLoans,
  mockMembers as initialMockMembers,
  mockCompanies as initialMockCompanies,
  mockUsers as initialMockUsers,
} from "./mock-data";

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

const STORAGE_KEY = "bukuflow_mock_store_v1";

interface MockStoreState {
  books: Book[];
  bookCopies: BookCopy[];
  members: Member[];
  loans: Loan[];
  loanItems: LoanItem[];
  auditLogs: AuditLog[];
  companies: Company[];
  users: User[];
  companySettings: Record<string, CompanySettings>;
}

const defaultInitialCompanySettings: Record<string, CompanySettings> = {
  "company-001": {
    id: "settings-001",
    companyId: "company-001",
    defaultLoanDuration: 7,
    maxActiveLoans: 3,
    dailyFineRate: 1000,
    allowRenewal: true,
    maxRenewals: 1,
    dateFormat: "DD/MM/YYYY",
    timezone: "Asia/Jakarta",
    createdAt: "2026-08-01T08:00:00+07:00",
    updatedAt: "2026-08-01T08:00:00+07:00",
  },
  "company-002": {
    id: "settings-002",
    companyId: "company-002",
    defaultLoanDuration: 7,
    maxActiveLoans: 3,
    dailyFineRate: 1000,
    allowRenewal: true,
    maxRenewals: 1,
    dateFormat: "DD/MM/YYYY",
    timezone: "Asia/Jakarta",
    createdAt: "2026-08-01T08:00:00+07:00",
    updatedAt: "2026-08-01T08:00:00+07:00",
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getInitialState(): MockStoreState {
  return {
    books: clone(initialMockBooks),
    bookCopies: clone(initialMockBookCopies),
    members: clone(initialMockMembers),
    loans: clone(initialMockLoans),
    loanItems: clone(initialMockLoanItems),
    auditLogs: clone(initialMockAuditLogs),
    companies: clone(initialMockCompanies),
    users: clone(initialMockUsers),
    companySettings: clone(defaultInitialCompanySettings),
  };
}

function isBrowser() {
  return typeof window !== "undefined";
}

function readStoredState(): MockStoreState | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<MockStoreState>;

    if (
      !Array.isArray(parsed.books) ||
      !Array.isArray(parsed.bookCopies) ||
      !Array.isArray(parsed.members) ||
      !Array.isArray(parsed.loans) ||
      !Array.isArray(parsed.loanItems) ||
      !Array.isArray(parsed.auditLogs)
    ) {
      return null;
    }

    return {
      ...getInitialState(),
      ...parsed,
      companies: Array.isArray(parsed.companies) && parsed.companies.length > 0 ? parsed.companies : clone(initialMockCompanies),
      users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : clone(initialMockUsers),
      companySettings: parsed.companySettings && typeof parsed.companySettings === "object" ? parsed.companySettings : clone(defaultInitialCompanySettings),
    } as MockStoreState;
  } catch {
    return null;
  }
}

export const mockBooks: Book[] = clone(initialMockBooks);
export const mockBookCopies: BookCopy[] = clone(initialMockBookCopies);
export const mockMembers: Member[] = clone(initialMockMembers);
export const mockLoans: Loan[] = clone(initialMockLoans);
export const mockLoanItems: LoanItem[] = clone(initialMockLoanItems);
export const mockAuditLogs: AuditLog[] = clone(initialMockAuditLogs);
export const mockCompanies: Company[] = clone(initialMockCompanies);
export const mockUsers: User[] = clone(initialMockUsers);
export const mockCompanySettingsStore: Record<string, CompanySettings> = clone(defaultInitialCompanySettings);

let hydrated = false;

function replaceArray<T>(target: T[], source: T[]) {
  target.splice(0, target.length, ...clone(source));
}

export function ensureMockStoreHydrated() {
  if (hydrated) {
    return;
  }

  const stored = readStoredState();
  const state = stored ?? getInitialState();

  replaceArray(mockBooks, state.books);
  replaceArray(mockBookCopies, state.bookCopies);
  replaceArray(mockMembers, state.members);
  replaceArray(mockLoans, state.loans);
  replaceArray(mockLoanItems, state.loanItems);
  replaceArray(mockAuditLogs, state.auditLogs);
  replaceArray(mockCompanies, state.companies || initialMockCompanies);
  replaceArray(mockUsers, state.users || initialMockUsers);

  for (const k of Object.keys(mockCompanySettingsStore)) {
    delete mockCompanySettingsStore[k];
  }
  Object.assign(mockCompanySettingsStore, state.companySettings || defaultInitialCompanySettings);

  hydrated = true;

  if (!stored) {
    persistMockState();
  }
}

export function persistMockState() {
  if (!isBrowser()) {
    return;
  }

  const state: MockStoreState = {
    books: clone(mockBooks),
    bookCopies: clone(mockBookCopies),
    members: clone(mockMembers),
    loans: clone(mockLoans),
    loanItems: clone(mockLoanItems),
    auditLogs: clone(mockAuditLogs),
    companies: clone(mockCompanies),
    users: clone(mockUsers),
    companySettings: clone(mockCompanySettingsStore),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetMockData() {
  const initial = getInitialState();

  replaceArray(mockBooks, initial.books);
  replaceArray(mockBookCopies, initial.bookCopies);
  replaceArray(mockMembers, initial.members);
  replaceArray(mockLoans, initial.loans);
  replaceArray(mockLoanItems, initial.loanItems);
  replaceArray(mockAuditLogs, initial.auditLogs);
  replaceArray(mockCompanies, initial.companies);
  replaceArray(mockUsers, initial.users);

  for (const k of Object.keys(mockCompanySettingsStore)) {
    delete mockCompanySettingsStore[k];
  }
  Object.assign(mockCompanySettingsStore, initial.companySettings);

  hydrated = true;

  if (isBrowser()) {
    window.localStorage.removeItem(STORAGE_KEY);
    persistMockState();
  }
}

