import axios from "axios";
import { getAccessToken, getTokenType, clearAuthData } from "./auth";
import type { Book, Loan, Member, TransactionData, ReturnLoanData } from "./types";

// 1. Base URL dari Environment Variable
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let isLoggingOut = false;

// 2. Request Interceptor
api.interceptors.request.use((config) => {
  const isLoginEndpoint = config.url?.includes("/auth/login");

  if (!isLoginEndpoint) {
    const token = getAccessToken();
    const tokenType = getTokenType();

    if (token) {
      const cleanType = tokenType ? tokenType.trim() : "Bearer";
      config.headers.Authorization = `${cleanType} ${token}`;
    }
  }

  return config;
});

// 3. Response Interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginEndpoint = error.config?.url?.includes("/auth/login");

    if (error.response?.status === 401 && !isLoginEndpoint) {
      // Pastikan 401 ini bukan berasal dari request lama (stale token)
      const currentToken = getAccessToken();
      const requestAuthHeader = error.config?.headers?.Authorization;
      const requestToken = requestAuthHeader
        ? String(requestAuthHeader).replace(/^Bearer\s+/i, "").trim()
        : null;

      // Jika token di localStorage sudah diperbarui (login baru berhasil), abaikan 401 dari request lama
      if (currentToken && requestToken && currentToken !== requestToken) {
        return Promise.reject(error);
      }

      if (!isLoggingOut) {
        isLoggingOut = true;
        clearAuthData();

        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/login")
        ) {
          window.location.replace("/login");
        }

        setTimeout(() => {
          isLoggingOut = false;
        }, 1500);
      }
    }

    return Promise.reject(error);
  }
);

// ----------------------------------------------------
// API Functions
// ----------------------------------------------------

export async function loginApi(email: string, password: string) {
  const response = await api.post("/auth/login", {
    email,
    password,
  });

  const raw = response.data;
  const rawUser = raw.data || raw.user || {};

  return {
    access_token: raw.access_token,
    token_type: raw.token_type || "bearer",
    data: {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      role: rawUser.role,
      companyId: rawUser.company_id || rawUser.companyId || "company-001",
    },
    user: raw.user || raw.data, 
  };
}

export async function getMeApi() {
  const response = await api.get("/auth/me");
  return response.data;
}

export async function logoutApi() {
  try {
    await api.post("/auth/logout");
  } finally {
    clearAuthData();
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.replace("/login");
    }
  }
}

export async function searchMembersApi(keyword: string = ""): Promise<Member[]> {
  try {
    const cleanQuery = keyword.trim();
    // Backend FastAPI mewajibkan min_length: 1. Jika kosong gunakan spasi " " agar tidak terkena validasi 422
    const queryParam = cleanQuery.length > 0 ? cleanQuery : " ";

    const response = await api.get("/member/search", {
      params: {
        q: queryParam,
      },
    });

    const items = response.data?.items || [];

    return items.map((item: any) => ({
      id: item.id || `member-${Math.random().toString(36).slice(2)}`,
      companyId: item.company_id || item.companyId || "company-001",
      memberNumber: item.member_number || item.memberNumber || item.code || "-",
      name: item.name || "-",
      identityNumber: item.identity_number || item.identityNumber || "-",
      phone: item.phone || "-",
      email: item.email || undefined,
      status: (item.status as Member["status"]) || "ACTIVE",
      memberType: item.member_type || item.memberType || "UMUM",
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || new Date().toISOString(),
    }));
  } catch (error: any) {
    // Tangani 404 (tidak ada data) dan 422 (validasi panjang string) agar UI tetap bersih
    if (error.response?.status === 404 || error.response?.status === 422) {
      return [];
    }
    throw error;
  }
}

function parseBookStatus(
  status: any,
  totalCopies: number,
  availableCopies: number
): Book["status"] {
  if (typeof status === "string") {
    const s = status.toUpperCase().trim();
    if (
      s === "INACTIVE" ||
      s === "ARCHIVED" ||
      s === "DIARSIPKAN" ||
      s === "NONAKTIF"
    ) {
      return "INACTIVE";
    }
  }
  if (typeof status === "boolean" && !status) {
    return "INACTIVE";
  }

  // Status agregat diturunkan dari eksemplar aktif
  if (availableCopies > 0) {
    return "AVAILABLE";
  }
  if (totalCopies > 0) {
    return "BORROWED";
  }
  return "INACTIVE";
}

export async function searchBooksApi(keyword: string = ""): Promise<Book[]> {
  try {
    const cleanQuery = keyword.trim();
    const queryParam = cleanQuery.length > 0 ? cleanQuery : " ";

    const response = await api
      .get("/catalog/books/search", {
        params: {
          q: queryParam,
        },
      })
      .catch(() =>
        api.get("/books/search", {
          params: {
            q: queryParam,
          },
        })
      );

    const items = response.data?.items || response.data || [];

    return items.map((item: any) => {
      const totalCopies = Number(item.total_copies ?? item.totalCopies ?? 1);
      const availableCopies = Number(
        item.available_copies ?? item.availableCopies ?? item.total_copies ?? 1
      );

      return {
        id: item.id || `book-${Math.random().toString(36).slice(2)}`,
        companyId: item.company_id || item.companyId || "company-001",
        code: item.code || "-",
        isbn: item.isbn || undefined,
        title: item.title || "-",
        author: item.author || "-",
        publisher: item.publisher || "-",
        publicationYear:
          item.publication_year || item.publicationYear || undefined,
        category: item.category || "-",
        coverUrl: item.cover_url || item.coverUrl || undefined,
        status: parseBookStatus(item.status, totalCopies, availableCopies),
        totalCopies,
        availableCopies,
        createdAt: item.created_at || new Date().toISOString(),
        updatedAt: item.updated_at || new Date().toISOString(),
      };
    });
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 422) {
      return [];
    }
    throw error;
  }
}

export interface DashboardApiResponse {
  booksAvailable: number;
  booksBorrowed: number;
  activeLoans: number;
  overdueLoans: number;
  recentLoans: Array<Loan & { memberName: string }>;
}

export async function getDashboardApi(): Promise<DashboardApiResponse> {
  try {
    const response = await api
      .get("/dashboard")
      .catch(() => api.get("/bukuflow/dashboard"));

    const data = response.data || {};
    const rawLoans =
      data.recent_loans ||
      data.recentLoans ||
      data.recent_transactions ||
      data.recentTransactions ||
      data.transactions ||
      [];

    return {
      booksAvailable: Number(data.books_available ?? data.booksAvailable ?? 0),
      booksBorrowed: Number(data.books_borrowed ?? data.booksBorrowed ?? 0),
      activeLoans: Number(data.active_loans ?? data.activeLoans ?? 0),
      overdueLoans: Number(data.overdue_loans ?? data.overdueLoans ?? 0),
      recentLoans: (Array.isArray(rawLoans) ? rawLoans : [])
        .slice(0, 10)
        .map((loan: any) => ({
          id: loan.id || `loan-${Math.random().toString(36).slice(2)}`,
          companyId: loan.company_id || loan.companyId || "company-001",
          loanNumber: loan.loan_number || loan.loanNumber || "-",
          memberId: loan.member_id || loan.memberId || "-",
          borrowedBy:
            loan.borrowed_by ||
            loan.borrowedBy ||
            loan.member_id ||
            loan.memberId ||
            "-",
          memberName:
            loan.member_name ||
            loan.memberName ||
            loan.member?.name ||
            "-",
          status: (loan.status as Loan["status"]) || "ACTIVE",
          borrowedAt:
            loan.borrowed_at || loan.borrowedAt || new Date().toISOString(),
          dueAt: loan.due_at || loan.dueAt || new Date().toISOString(),
          returnedAt: loan.returned_at || loan.returnedAt || undefined,
          createdAt:
            loan.created_at || loan.createdAt || new Date().toISOString(),
          updatedAt:
            loan.updated_at || loan.updatedAt || new Date().toISOString(),
        })),
    };
  } catch {
    // Fallback ke mock dashboard jika endpoint backend belum aktif
    const { getDashboard } = await import("./mock-api");
    const fallback = await getDashboard();
    return {
      ...fallback,
      recentLoans: fallback.recentLoans.slice(0, 10),
    };
  }
}

function mapRawToTransactionData(raw: any): TransactionData {
  const loan: Loan = {
    id: raw.id || raw.loan_id || `loan-${Math.random().toString(36).slice(2)}`,
    companyId: raw.company_id || raw.companyId || "company-001",
    loanNumber: raw.loan_number || raw.loanNumber || raw.code || "-",
    memberId: raw.member_id || raw.memberId || raw.member?.id || "-",
    borrowedBy:
      raw.borrowed_by ||
      raw.borrowedBy ||
      raw.user_id ||
      raw.user?.id ||
      "-",
    borrowedAt: raw.borrowed_at || raw.borrowedAt || new Date().toISOString(),
    dueAt: raw.due_at || raw.dueAt || new Date().toISOString(),
    returnedAt: raw.returned_at || raw.returnedAt || undefined,
    status: raw.status || "ACTIVE",
    notes: raw.notes || undefined,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt || new Date().toISOString(),
  };

  const member: Member = raw.member
    ? {
        id: raw.member.id || loan.memberId,
        companyId:
          raw.member.company_id || raw.member.companyId || loan.companyId,
        memberNumber:
          raw.member.member_number || raw.member.memberNumber || "MBR-001",
        name: raw.member.name || raw.member_name || raw.memberName || "-",
        memberType:
          raw.member.member_type || raw.member.memberType || "INTERNAL",
        identityNumber:
          raw.member.identity_number ||
          raw.member.identityNumber ||
          "0000000000000000",
        phone: raw.member.phone || "-",
        email: raw.member.email || undefined,
        status: raw.member.status || "ACTIVE",
        createdAt:
          raw.member.created_at || raw.member.createdAt || loan.createdAt,
        updatedAt:
          raw.member.updated_at || raw.member.updatedAt || loan.updatedAt,
      }
    : {
        id: loan.memberId,
        companyId: loan.companyId,
        memberNumber: "MBR-001",
        name: raw.member_name || raw.memberName || "Anggota",
        memberType: "INTERNAL",
        identityNumber: "0000000000000000",
        phone: "-",
        status: "ACTIVE",
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt,
      };

  const user = raw.user
    ? {
        id: raw.user.id || loan.borrowedBy,
        companyId: raw.user.company_id || raw.user.companyId || loan.companyId,
        name: raw.user.name || raw.user_name || raw.userName || "Petugas",
        username: raw.user.username || raw.user.user_name || "petugas",
        email: raw.user.email || "staff@bukuflow.com",
        role: raw.user.role || "STAFF",
        status: raw.user.status || "ACTIVE",
        createdAt: raw.user.created_at || raw.user.createdAt || loan.createdAt,
        updatedAt: raw.user.updated_at || raw.user.updatedAt || loan.updatedAt,
      }
    : {
        id: loan.borrowedBy,
        companyId: loan.companyId,
        name: raw.user_name || raw.userName || "Petugas",
        username: "petugas",
        email: "staff@bukuflow.com",
        role: "STAFF" as const,
        status: "ACTIVE" as const,
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt,
      };

  const rawItems = raw.items || raw.loan_items || raw.details || [];
  const items =
    Array.isArray(rawItems) && rawItems.length > 0
      ? rawItems.map((it: any, idx: number) => {
          const loanItem = {
            id: it.id || it.loan_item_id || `loan-item-${loan.id}-${idx}`,
            companyId: loan.companyId,
            loanId: loan.id,
            bookId: it.book_id || it.bookId || it.book?.id || `book-${idx}`,
            bookCopyId:
              it.book_copy_id ||
              it.bookCopyId ||
              it.book_copy?.id ||
              it.bookCopy?.id ||
              `copy-${idx}`,
            returnedAt: it.returned_at || it.returnedAt || undefined,
            status:
              it.status ||
              (loan.status === "COMPLETED" ? "RETURNED" : "BORROWED"),
            createdAt: it.created_at || it.createdAt || loan.createdAt,
            updatedAt: it.updated_at || it.updatedAt || loan.updatedAt,
          };

          const book = it.book
            ? {
                id: it.book.id || loanItem.bookId,
                companyId: loan.companyId,
                code: it.book.code || "BK-001",
                title:
                  it.book.title || it.book_title || it.bookTitle || "-",
                status: "AVAILABLE" as const,
                totalCopies: 1,
                availableCopies: 1,
                createdAt: loan.createdAt,
                updatedAt: loan.updatedAt,
              }
            : {
                id: loanItem.bookId,
                companyId: loan.companyId,
                code: it.book_code || it.bookCode || "BK-001",
                title: it.book_title || it.bookTitle || "Buku",
                status: "AVAILABLE" as const,
                totalCopies: 1,
                availableCopies: 1,
                createdAt: loan.createdAt,
                updatedAt: loan.updatedAt,
              };

          const bookCopy =
            it.book_copy || it.bookCopy
              ? {
                  id:
                    it.book_copy?.id ||
                    it.bookCopy?.id ||
                    loanItem.bookCopyId,
                  companyId: loan.companyId,
                  bookId: loanItem.bookId,
                  code:
                    it.book_copy?.code ||
                    it.bookCopy?.code ||
                    it.copy_code ||
                    it.copyCode ||
                    `${book.code}-001`,
                  status: "BORROWED" as const,
                  createdAt: loan.createdAt,
                  updatedAt: loan.updatedAt,
                }
              : {
                  id: loanItem.bookCopyId,
                  companyId: loan.companyId,
                  bookId: loanItem.bookId,
                  code:
                    it.copy_code || it.copyCode || `${book.code}-001`,
                  status: "BORROWED" as const,
                  createdAt: loan.createdAt,
                  updatedAt: loan.updatedAt,
                };

          return {
            loanItem,
            book,
            bookCopy,
          };
        })
      : [
          {
            loanItem: {
              id: `loan-item-${loan.id}-0`,
              companyId: loan.companyId,
              loanId: loan.id,
              bookId: raw.book_id || raw.bookId || `book-${loan.id}`,
              bookCopyId:
                raw.book_copy_id || raw.bookCopyId || `copy-${loan.id}`,
              returnedAt: loan.returnedAt,
              status:
                loan.status === "COMPLETED" ? "RETURNED" : "BORROWED",
              createdAt: loan.createdAt,
              updatedAt: loan.updatedAt,
            },
            book: {
              id: raw.book_id || raw.bookId || `book-${loan.id}`,
              companyId: loan.companyId,
              code: raw.book_code || raw.bookCode || "BK-001",
              title: raw.book_title || raw.bookTitle || "Buku",
              status: "AVAILABLE" as const,
              totalCopies: 1,
              availableCopies: 1,
              createdAt: loan.createdAt,
              updatedAt: loan.updatedAt,
            },
            bookCopy: {
              id: raw.book_copy_id || raw.bookCopyId || `copy-${loan.id}`,
              companyId: loan.companyId,
              bookId: raw.book_id || raw.bookId || `book-${loan.id}`,
              code: raw.copy_code || raw.copyCode || "CP-001",
              status: "BORROWED" as const,
              createdAt: loan.createdAt,
              updatedAt: loan.updatedAt,
            },
          },
        ];

  return {
    loan,
    member,
    user,
    items,
  };
}

export async function listLoansApi(): Promise<TransactionData[]> {
  try {
    const response = await api
      .get("/loan")
      .catch(() => api.get("/office/loan"))
      .catch(() => api.get("/loans"));

    const items = response.data?.items || response.data || [];
    if (Array.isArray(items) && items.length > 0) {
      return items.map(mapRawToTransactionData);
    }
    return [];
  } catch (error: any) {
    if (error.response?.status === 404) {
      return [];
    }
    // Fallback ke mock jika backend belum tersedia
    const { getTransactions } = await import("./mock-api");
    return getTransactions();
  }
}

export async function getActiveReturnsApi(): Promise<ReturnLoanData[]> {
  try {
    const response = await api
      .get("/loan/returns/active")
      .catch(() => api.get("/office/loan/returns/active"))
      .catch(() => api.get("/returns/active"));

    const items = response.data?.items || response.data || [];
    if (Array.isArray(items) && items.length > 0) {
      return items.map(mapRawToTransactionData);
    }

    // Jika endpoint active returns kosong di backend, return []
    return [];
  } catch (error: any) {
    if (error.response?.status === 404) {
      return [];
    }
    // Fallback ke mock jika backend belum tersedia
    const { getReturnLoans } = await import("./mock-api");
    return getReturnLoans();
  }
}

export async function returnLoanItemsApi(
  loanId: string,
  loanItemIds: string[]
): Promise<Loan> {
  try {
    const payload = {
      item_ids: loanItemIds,
      loan_item_ids: loanItemIds,
    };

    const response = await api
      .post(`/loan/returns/${loanId}`, payload)
      .catch(() => api.post(`/returns/${loanId}`, payload))
      .catch(() =>
        api.post("/returns", {
          loan_id: loanId,
          item_ids: loanItemIds,
        })
      );

    const loan = response.data?.loan || response.data;
    if (loan && loan.id) {
      return {
        id: loan.id,
        companyId: loan.company_id || loan.companyId || "company-001",
        loanNumber: loan.loan_number || loan.loanNumber || "-",
        memberId: loan.member_id || loan.memberId || "-",
        borrowedBy: loan.borrowed_by || loan.borrowedBy || "-",
        borrowedAt: loan.borrowed_at || loan.borrowedAt || new Date().toISOString(),
        dueAt: loan.due_at || loan.dueAt || new Date().toISOString(),
        returnedAt: loan.returned_at || loan.returnedAt || new Date().toISOString(),
        status: loan.status || "COMPLETED",
        createdAt: loan.created_at || loan.createdAt || new Date().toISOString(),
        updatedAt: loan.updated_at || loan.updatedAt || new Date().toISOString(),
      };
    }
    throw new Error("Format respons pengembalian tidak valid.");
  } catch {
    // Fallback ke mock
    const { returnLoanItems } = await import("./mock-api");
    return returnLoanItems(loanId, loanItemIds);
  }
}