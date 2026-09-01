import {
  mockAuditLogs as initialMockAuditLogs,
  mockBookCopies as initialMockBookCopies,
  mockBooks as initialMockBooks,
  mockLoanItems as initialMockLoanItems,
  mockLoans as initialMockLoans,
  mockMembers as initialMockMembers,
} from "./mock-data";

import type {
  AuditLog,
  Book,
  BookCopy,
  Loan,
  LoanItem,
  Member,
} from "./types";

const STORAGE_KEY = "bukuflow_mock_store_v1";

interface MockStoreState {
  books: Book[];
  bookCopies: BookCopy[];
  members: Member[];
  loans: Loan[];
  loanItems: LoanItem[];
  auditLogs: AuditLog[];
}

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

    return parsed as MockStoreState;
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

  hydrated = true;

  if (isBrowser()) {
    window.localStorage.removeItem(STORAGE_KEY);
    persistMockState();
  }
}

