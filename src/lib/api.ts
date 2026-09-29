import axios from "axios";
import { getAccessToken, getTokenType, clearAuthData, getAuthData } from "./auth";
import type {
  Book,
  BookCopy,
  BookStatus,
  BookCopyStatus,
  Company,
  Loan,
  Member,
  MemberStatus,
  TransactionData,
  ReturnLoanData,
} from "./types";

// 1. Base URL dari Environment Variable
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 45000,
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

      // Abaikan force logout jika sedang mode testing/mock token
      if (currentToken && currentToken.startsWith("mock-")) {
        return Promise.reject(error);
      }

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
// Helper: Error Formatting
// ----------------------------------------------------

export function formatApiError(
  error: any,
  fallbackMessage: string = "Terjadi kesalahan pada sistem."
): string {
  if (!error) return fallbackMessage;

  const status = error.response?.status;
  const detail = error.response?.data?.detail;
  const message = error.response?.data?.message;

  let detailStr = "";
  if (Array.isArray(detail)) {
    detailStr = detail
      .map((d: any) => {
        const field = Array.isArray(d.loc)
          ? d.loc.filter((l: any) => l !== "body").join(".")
          : "";
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join("; ");
  } else if (typeof detail === "object" && detail !== null) {
    detailStr = detail.message || detail.error || JSON.stringify(detail);
  } else if (typeof detail === "string") {
    detailStr = detail;
  } else if (typeof message === "string") {
    detailStr = message;
  }

  if (status === 500) {
    return detailStr
      ? `Server Error (500): ${detailStr}`
      : "Server Error (500): Internal Server Error (Database atau Server backend bermasalah)";
  }

  if (status === 502) {
    return "Server Error (502): Bad Gateway (Server backend tidak dapat dihubungi)";
  }

  if (status === 503) {
    return "Server Error (503): Service Unavailable (Server backend sedang tidak tersedia)";
  }

  if (status === 504) {
    return "Server Error (504): Gateway Timeout (Server backend waktu tunggu habis)";
  }

  if (status && status >= 500) {
    return detailStr
      ? `Server Error (${status}): ${detailStr}`
      : `Server Error (${status}): Terjadi kesalahan internal pada backend.`;
  }

  if (
    error.code === "ECONNABORTED" ||
    error.message?.toLowerCase().includes("timeout")
  ) {
    return "Request Timeout: Server backend membutuhkan waktu terlalu lama untuk merespons (Timeout).";
  }

  if (detailStr) {
    return detailStr;
  }

  if (error.message && typeof error.message === "string") {
    return error.message;
  }

  return fallbackMessage;
}

// ----------------------------------------------------
// API Functions
// ----------------------------------------------------

export async function loginApi(email: string, password: string) {
  try {
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
  } catch (error: any) {
    throw new Error(formatApiError(error, "Email atau password salah."));
  }
}

export async function getMeApi() {
  const response = await api.get("/auth/me");
  return response.data;
}

export async function logoutApi() {
  try {
    await api.post("/auth/logout", {}, { timeout: 1500 }).catch(() => {});
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

// ----------------------------------------------------
// MEMBER API METHODS
// ----------------------------------------------------

export interface ListMembersParams {
  page?: number;
  size?: number;
  sortby?: string;
  order?: "asc" | "desc";
}

export interface CreateMemberInputData {
  name: string;
  phone: string;
  identityNumber: string;
  email?: string;
  memberNumber?: string;
}

export interface UpdateMemberInputData {
  name?: string;
  identityNumber?: string;
  phone?: string;
  email?: string;
  memberNumber?: string;
  status?: MemberStatus;
}

function mapRawToMember(item: any): Member {
  return {
    id: item._id || item.id || `member-${Math.random().toString(36).slice(2)}`,
    companyId: item.company_id || item.companyId || "company-001",
    memberNumber: item.member_number || item.memberNumber || item.code || "-",
    name: item.name || "-",
    identityNumber: item.identity_number || item.identityNumber || "-",
    phone: item.phone || "-",
    email: item.email || undefined,
    status: (item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") as MemberStatus,
    memberType: item.member_type || item.memberType || "UMUM",
    createdAt: item.created_at || new Date().toISOString(),
    updatedAt: item.updated_at || new Date().toISOString(),
  };
}

export async function getMembersApi(
  params?: ListMembersParams
): Promise<Member[]> {
  try {
    const response = await api
      .get("/member", {
        params: {
          page: params?.page ?? 1,
          size: params?.size ?? 100,
          sortby: params?.sortby ?? undefined,
          order: params?.order ?? "asc",
        },
      })
      .catch((err) => {
        if (err.response?.status >= 500) throw err;
        return api.get("/office/member", {
          params: {
            page: params?.page ?? 1,
            size: params?.size ?? 100,
            sortby: params?.sortby ?? undefined,
            order: params?.order ?? "asc",
          },
        });
      });

    const items = response.data?.items || response.data || [];
    if (!Array.isArray(items)) return [];

    return items.map(mapRawToMember);
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Data anggota gagal dimuat karena gangguan server.")
      );
    }
    if (error.response?.status === 404) {
      return [];
    }
    const { getMembers } = await import("./mock-api");
    return await getMembers();
  }
}

export async function searchMembersApi(
  keyword: string = ""
): Promise<Member[]> {
  const cleanQuery = keyword.trim();
  if (!cleanQuery) {
    return getMembersApi();
  }

  try {
    const response = await api
      .get("/member/search", {
        params: {
          q: cleanQuery,
        },
      })
      .catch((err) => {
        if (err.response?.status >= 500) throw err;
        return api.get("/office/member/search", {
          params: {
            q: cleanQuery,
          },
        });
      });

    const items = response.data?.items || response.data || [];
    if (!Array.isArray(items)) return [];

    return items.map(mapRawToMember);
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Pencarian anggota gagal karena gangguan server.")
      );
    }
    if (error.response?.status === 404 || error.response?.status === 422) {
      return [];
    }
    const { searchMembers } = await import("./mock-api");
    return await searchMembers(cleanQuery);
  }
}

export async function getMemberApi(memberId: string): Promise<Member> {
  try {
    const response = await api
      .get(`/member/${memberId}`)
      .catch((err) => {
        if (err.response?.status >= 500) throw err;
        return api.get(`/office/member/${memberId}`);
      });

    return mapRawToMember(response.data);
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Detail anggota gagal dimuat karena gangguan server.")
      );
    }
    const { getMemberById } = await import("./mock-api");
    return await getMemberById(memberId);
  }
}

export async function createMemberApi(
  data: CreateMemberInputData
): Promise<Member> {
  const cleanNik = data.identityNumber.trim();

  // Ambil list member untuk validasi NIK unik dan generate nomor urut sequential
  const existingMembers = await getMembersApi().catch((err) => {
    if (err.message?.includes("Server Error")) throw err;
    return [];
  });

  // 1. Validasi Keunikan NIK
  const duplicateNik = existingMembers.some(
    (m) => m.identityNumber?.trim() === cleanNik
  );
  if (duplicateNik) {
    throw new Error(
      "NIK tersebut sudah terdaftar sebagai anggota. Gunakan NIK yang berbeda."
    );
  }

  // 2. Generate Format Nomor Anggota Berurutan (MBR-001, MBR-002, dst)
  let memberNumber = data.memberNumber?.trim();
  if (!memberNumber) {
    const usedNumbers = existingMembers
      .map((m) => {
        const match = m.memberNumber?.match(/(\d+)$/);
        return match ? Number(match[1]) : 0;
      })
      .filter((n) => n > 0);

    const highestNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) : 0;
    memberNumber = `MBR-${String(highestNumber + 1).padStart(3, "0")}`;
  }

  const payload = {
    name: data.name.trim(),
    member_number: memberNumber,
    identity_number: cleanNik,
    phone: data.phone.trim(),
    email: data.email?.trim() || null,
  };

  try {
    const response = await api
      .post("/member", payload)
      .catch((err) => {
        if (err.response?.status >= 500) throw err;
        return api.post("/office/member", payload);
      });

    return mapRawToMember(response.data);
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Gagal membuat anggota baru karena gangguan server.")
      );
    }

    const errorMsg = formatApiError(error, "");
    if (errorMsg) {
      throw new Error(errorMsg);
    }

    const { createMember } = await import("./mock-api");
    return await createMember({
      name: data.name,
      phone: data.phone,
      identityNumber: data.identityNumber,
      email: data.email,
      memberType: "UMUM",
      status: "ACTIVE",
    });
  }
}

export async function updateMemberApi(
  memberId: string,
  data: UpdateMemberInputData
): Promise<Member> {
  if (data.identityNumber) {
    const cleanNik = data.identityNumber.trim();
    const existingMembers = await getMembersApi().catch((err) => {
      if (err.message?.includes("Server Error")) throw err;
      return [];
    });
    const duplicateNik = existingMembers.some(
      (m) => m.id !== memberId && m.identityNumber?.trim() === cleanNik
    );
    if (duplicateNik) {
      throw new Error(
        "NIK tersebut sudah terdaftar sebagai anggota. Gunakan NIK yang berbeda."
      );
    }
  }

  const payload: any = {};
  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.memberNumber !== undefined)
    payload.member_number = data.memberNumber.trim();
  if (data.identityNumber !== undefined)
    payload.identity_number = data.identityNumber.trim();
  if (data.phone !== undefined) payload.phone = data.phone.trim();
  if (data.email !== undefined) payload.email = data.email.trim() || null;
  if (data.status !== undefined) {
    payload.status = data.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  }

  try {
    const response = await api
      .patch(`/member/${memberId}`, payload)
      .catch((err) => {
        if (err.response?.status >= 500) throw err;
        return api.patch(`/office/member/${memberId}`, payload);
      });

    return mapRawToMember(response.data);
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Gagal memperbarui anggota karena gangguan server.")
      );
    }

    const errorMsg = formatApiError(error, "");
    if (errorMsg) {
      throw new Error(errorMsg);
    }

    const { updateMember, changeMemberStatus } = await import("./mock-api");
    if (data.status) {
      return await changeMemberStatus(memberId, data.status);
    }
    return await updateMember(memberId, {
      name: data.name || "",
      identityNumber: data.identityNumber || "",
      phone: data.phone || "",
      email: data.email,
    });
  }
}

export async function changeMemberStatusApi(
  memberId: string,
  status: MemberStatus
): Promise<Member> {
  return updateMemberApi(memberId, { status });
}

export async function deleteMemberApi(memberId: string): Promise<{ id: string; status?: string }> {
  try {
    const response = await api
      .delete(`/member/${memberId}`)
      .catch((err) => {
        if (err.response?.status >= 500) throw err;
        return api.delete(`/office/member/${memberId}`);
      });

    return response.data;
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Gagal menghapus anggota karena gangguan server.")
      );
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

  // Jika buku aktif dan seluruh copy sedang dipinjam
  if (totalCopies > 0 && availableCopies === 0) {
    return "BORROWED";
  }
  return "AVAILABLE";
}

export interface ListBooksParams {
  page?: number;
  size?: number;
  sortby?: string;
  order?: "asc" | "desc";
}

export async function getBooksApi(params?: ListBooksParams): Promise<Book[]> {
  try {
    const response = await api
      .get("/catalog/books", {
        params: {
          page: params?.page ?? 1,
          size: params?.size ?? 100,
          sortby: params?.sortby ?? undefined,
          order: params?.order ?? "asc",
        },
      })
      .catch((err) => {
        if (err.response?.status >= 500) throw err;
        return api.get("/office/catalog/books", {
          params: {
            page: params?.page ?? 1,
            size: params?.size ?? 100,
            sortby: params?.sortby ?? undefined,
            order: params?.order ?? "asc",
          },
        });
      });

    const items = response.data?.items || response.data || [];

    return items.map((item: any) => {
      const rawTotal = item.total_copies ?? item.totalCopies;
      const rawAvailable = item.available_copies ?? item.availableCopies;

      const hasExplicitTotal =
        rawTotal !== undefined && rawTotal !== null && Number(rawTotal) > 0;
      const totalCopies = hasExplicitTotal ? Number(rawTotal) : 1;
      const availableCopies =
        hasExplicitTotal && rawAvailable !== undefined && rawAvailable !== null
          ? Number(rawAvailable)
          : totalCopies;

      return {
        id: item.id || item._id || `book-${Math.random().toString(36).slice(2)}`,
        companyId: item.company_id || item.companyId || "company-001",
        code: item.code || "-",
        isbn: item.isbn || undefined,
        title: item.title || "-",
        author: item.author || "-",
        publisher: item.publisher || "-",
        publicationYear:
          item.published_year ||
          item.publication_year ||
          item.publicationYear ||
          undefined,
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
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Katalog buku gagal dimuat karena gangguan server.")
      );
    }
    if (error.response?.status === 404 || error.response?.status === 422) {
      return [];
    }
    const { searchBooks } = await import("./mock-api");
    return searchBooks("");
  }
}

export interface CreateBookInputData {
  code: string;
  title: string;
  isbn?: string;
  author?: string;
  publisher?: string;
  publicationYear?: number;
  category?: string;
  totalCopies: number;
}

export async function createBookApi(data: CreateBookInputData): Promise<Book> {
  const currentYear = new Date().getFullYear();
  const bookCode = data.code.trim().toUpperCase();
  const totalCopies = Number(data.totalCopies) || 1;

  const payload: Record<string, any> = {
    code: bookCode,
    title: data.title.trim(),
    isbn: data.isbn?.trim() || "",
    author: data.author?.trim() || "",
    category: data.category?.trim() || "",
    publisher: data.publisher?.trim() || "",
    published_year:
      data.publicationYear && !Number.isNaN(Number(data.publicationYear))
        ? Number(data.publicationYear)
        : currentYear,
  };

  try {
    const response = await api.post("/catalog/books", payload);

    const raw = response.data?.book || response.data?.data || response.data;
    const bookId =
      raw?._id ||
      raw?.id ||
      raw?.book_id ||
      raw?.inserted_id ||
      raw?.insertedId;

    return {
      id: bookId || `book-${Date.now()}`,
      companyId: raw?.company_id || raw?.companyId || "company-001",
      code: raw?.code || bookCode,
      isbn: raw?.isbn || data.isbn || undefined,
      title: raw?.title || data.title,
      author: raw?.author || data.author || undefined,
      publisher: raw?.publisher || data.publisher || undefined,
      publicationYear:
        raw?.published_year ||
        raw?.publication_year ||
        data.publicationYear ||
        undefined,
      category: raw?.category || data.category || undefined,
      coverUrl: raw?.cover_url || raw?.coverUrl || undefined,
      status: "AVAILABLE",
      totalCopies: totalCopies,
      availableCopies: totalCopies,
      createdAt: raw?.created_at || new Date().toISOString(),
      updatedAt: raw?.updated_at || new Date().toISOString(),
    };
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Gagal membuat buku karena gangguan server.")
      );
    }
    
    const errorMsg = formatApiError(error, "");
    if (errorMsg && error.response?.status) {
      throw new Error(errorMsg);
    }

    const { createBook } = await import("./mock-api");
    return createBook(data);
  }
}

export async function searchBooksApi(keyword: string = ""): Promise<Book[]> {
  const cleanQuery = keyword.trim();

  if (cleanQuery.length === 0) {
    return getBooksApi();
  }

  try {

    const response = await api
      .get("/catalog/books/search", { params: { q: cleanQuery } })
      .catch((err) => {
        if (err.response?.status >= 500) throw err;
        return api.get("/office/catalog/books/search", {
          params: { q: cleanQuery },
        });
      })
      .catch((err) => {
        if (err.response?.status >= 500) throw err;
        return api.get("/books/search", { params: { q: cleanQuery } });
      });

    const items = response.data?.items || response.data || [];

    return items.map((item: any) => {
      const rawTotal = item.total_copies ?? item.totalCopies;
      const rawAvailable = item.available_copies ?? item.availableCopies;

      const hasExplicitTotal =
        rawTotal !== undefined && rawTotal !== null && Number(rawTotal) > 0;
      const totalCopies = hasExplicitTotal ? Number(rawTotal) : 1;
      const availableCopies =
        hasExplicitTotal && rawAvailable !== undefined && rawAvailable !== null
          ? Number(rawAvailable)
          : totalCopies;

      return {
        id: item.id || item._id || `book-${Math.random().toString(36).slice(2)}`,
        companyId: item.company_id || item.companyId || "company-001",
        code: item.code || "-",
        isbn: item.isbn || undefined,
        title: item.title || "-",
        author: item.author || "-",
        publisher: item.publisher || "-",
        publicationYear:
          item.published_year ||
          item.publication_year ||
          item.publicationYear ||
          undefined,
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
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Pencarian buku gagal karena gangguan server.")
      );
    }
    if (error.response?.status === 404 || error.response?.status === 422) {
      return [];
    }
    const { searchBooks } = await import("./mock-api");
    return searchBooks(cleanQuery);
  }
}

export async function getBookApi(bookId: string): Promise<Book | null> {
  try {
    const response = await api.get(`/catalog/books/${bookId}`);

    const item = response.data;
    if (!item) return null;

    const rawTotal = item.total_copies ?? item.totalCopies;
    const rawAvailable = item.available_copies ?? item.availableCopies;

    const hasExplicitTotal =
      rawTotal !== undefined && rawTotal !== null && Number(rawTotal) > 0;
    const totalCopies = hasExplicitTotal ? Number(rawTotal) : 1;
    const availableCopies =
      hasExplicitTotal && rawAvailable !== undefined && rawAvailable !== null
        ? Number(rawAvailable)
        : totalCopies;

    return {
      id: item._id || item.id || bookId,
      companyId: item.company_id || item.companyId || "company-001",
      code: item.code || "-",
      isbn: item.isbn || undefined,
      title: item.title || "-",
      author: item.author || "-",
      publisher: item.publisher || "-",
      publicationYear:
        item.published_year ||
        item.publication_year ||
        item.publicationYear ||
        undefined,
      category: item.category || "-",
      coverUrl: item.cover_url || item.coverUrl || undefined,
      status: parseBookStatus(item.status, totalCopies, availableCopies),
      totalCopies,
      availableCopies,
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || new Date().toISOString(),
    };
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Detail buku gagal dimuat karena gangguan server.")
      );
    }
    const { getBookById } = await import("./mock-api");
    try {
      return await getBookById(bookId);
    } catch {
      return null;
    }
  }
}

export interface UpdateBookInputData {
  title?: string;
  isbn?: string;
  author?: string;
  publisher?: string;
  publicationYear?: number;
  category?: string;
  status?: BookStatus;
}

export async function updateBookApi(
  bookId: string,
  data: UpdateBookInputData
): Promise<Book> {
  const payload: any = {};
  if (data.title !== undefined) payload.title = data.title.trim();
  if (data.isbn !== undefined) payload.isbn = data.isbn.trim() || null;
  if (data.author !== undefined) payload.author = data.author.trim() || null;
  if (data.publisher !== undefined) payload.publisher = data.publisher.trim() || null;
  if (data.publicationYear !== undefined) payload.published_year = data.publicationYear;
  if (data.category !== undefined) payload.category = data.category.trim() || null;
  if (data.status !== undefined) {
    payload.status = data.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  }

  try {
    const response = await api.patch(`/catalog/books/${bookId}`, payload);

    const item = response.data;
    const rawTotal = item.total_copies ?? item.totalCopies;
    const rawAvailable = item.available_copies ?? item.availableCopies;

    const hasExplicitTotal =
      rawTotal !== undefined && rawTotal !== null && Number(rawTotal) > 0;
    const totalCopies = hasExplicitTotal ? Number(rawTotal) : 1;
    const availableCopies =
      hasExplicitTotal && rawAvailable !== undefined && rawAvailable !== null
        ? Number(rawAvailable)
        : totalCopies;

    return {
      id: item._id || item.id || bookId,
      companyId: item.company_id || item.companyId || "company-001",
      code: item.code || "-",
      isbn: item.isbn || undefined,
      title: item.title || "-",
      author: item.author || "-",
      publisher: item.publisher || "-",
      publicationYear:
        item.published_year ||
        item.publication_year ||
        item.publicationYear ||
        undefined,
      category: item.category || "-",
      coverUrl: item.cover_url || item.coverUrl || undefined,
      status: parseBookStatus(item.status, totalCopies, availableCopies),
      totalCopies,
      availableCopies,
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || new Date().toISOString(),
    };
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Gagal memperbarui buku karena gangguan server.")
      );
    }
    const { updateBook, changeBookStatus } = await import("./mock-api");
    if (data.status) {
      return await changeBookStatus(bookId, data.status);
    }
    return await updateBook(bookId, data as any);
  }
}

export async function changeBookStatusApi(
  bookId: string,
  status: BookStatus
): Promise<Book> {
  // Aturan Bisnis PRD: Buku tidak boleh diarsipkan jika ada copy yang sedang dipinjam
  if (status === "INACTIVE") {
    try {
      const copies = await getBookCopiesApi(bookId);
      const borrowedCopies = copies.filter((c) => c.status === "BORROWED");
      if (borrowedCopies.length > 0) {
        throw new Error(
          "Buku tidak dapat diarsipkan karena masih memiliki copy yang sedang dipinjam."
        );
      }
    } catch (e: any) {
      if (e.message?.includes("masih memiliki copy yang sedang dipinjam")) {
        throw e;
      }
    }
  }

  return updateBookApi(bookId, { status });
}

export async function deleteBookApi(bookId: string): Promise<{ id: string; status?: string }> {
  try {
    const response = await api.delete(`/catalog/books/${bookId}`);
    return response.data;
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Gagal menghapus buku karena gangguan server.")
      );
    }
    throw error;
  }
}

export async function getBookCopiesApi(
  bookId: string,
  companyId?: string
): Promise<BookCopy[]> {
  const auth = getAuthData();
  const compId = companyId || auth?.user?.companyId || "company-001";

  try {
    const response = await api.get(`/catalog/books/${bookId}/copies`);

    const rawData = response.data;
    let items: any[] = [];
    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (Array.isArray(rawData?.items)) {
      items = rawData.items;
    } else if (Array.isArray(rawData?.copies)) {
      items = rawData.copies;
    } else if (Array.isArray(rawData?.data)) {
      items = rawData.data;
    } else if (rawData && typeof rawData === "object") {
      const arrayVal = Object.values(rawData).find((v) => Array.isArray(v));
      if (arrayVal) items = arrayVal as any[];
    }

    if (items.length === 0) {
      const { getBookCopies } = await import("./mock-api");
      return await getBookCopies(bookId);
    }

    return items.map((item: any) => ({
      id: item._id || item.id || `copy-${bookId}-${Math.random().toString(36).slice(2)}`,
      companyId: item.company_id || item.companyId || compId,
      bookId: item.book_id || item.bookId || bookId,
      code: item.copy_code || item.code || "-",
      status: (item.status as BookCopyStatus) || "AVAILABLE",
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || new Date().toISOString(),
    }));
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Daftar copy buku gagal dimuat karena gangguan server.")
      );
    }
    const { getBookCopies } = await import("./mock-api");
    return await getBookCopies(bookId);
  }
}

export async function createBookCopyApi(
  bookId: string,
  copyCode?: string,
  companyId?: string
): Promise<BookCopy> {
  const auth = getAuthData();
  const compId = companyId || auth?.user?.companyId || "company-001";

  const existingCopies = await getBookCopiesApi(bookId, compId).catch(() => []);
  const nextNumber = existingCopies.length + 1;
  const book = await getBookApi(bookId).catch(() => null);
  const bookCode = book?.code || `BK-${bookId.slice(-4).toUpperCase()}`;
  const defaultCode = `${bookCode}-${String(nextNumber).padStart(3, "0")}`;
  const code = copyCode?.trim() || defaultCode;

  const copyPayload = {
    copy_code: code,
    location: "-",
    status: "AVAILABLE",
  };

  try {
    const response = await api.post(`/catalog/books/${bookId}/copies`, copyPayload);

    const item = response.data?.copy || response.data?.data || response.data;
    return {
      id: item?._id || item?.id || `copy-${Date.now()}`,
      companyId: item?.company_id || item?.companyId || compId,
      bookId: item?.book_id || item?.bookId || bookId,
      code: item?.copy_code || item?.code || code,
      status: (item?.status as BookCopyStatus) || "AVAILABLE",
      createdAt: item?.created_at || new Date().toISOString(),
      updatedAt: item?.updated_at || new Date().toISOString(),
    };
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Gagal membuat copy buku karena gangguan server.")
      );
    }
    const { createBookCopy } = await import("./mock-api");
    return await createBookCopy(bookId);
  }
}

export async function changeBookCopyStatusApi(
  bookId: string,
  copyId: string,
  status: BookCopyStatus
): Promise<BookCopy> {
  // Aturan Bisnis PRD: Copy yang sedang BORROWED tidak boleh diubah statusnya ke arsip/nonaktif
  try {
    const copies = await getBookCopiesApi(bookId);
    const targetCopy = copies.find((c) => c.id === copyId);
    if (targetCopy && targetCopy.status === "BORROWED") {
      throw new Error("Copy yang sedang dipinjam tidak dapat diubah statusnya.");
    }
  } catch (e: any) {
    if (e.message?.includes("sedang dipinjam")) {
      throw e;
    }
  }

  try {
    const response = await api.patch(
      `/catalog/books/${bookId}/copies/${copyId}`,
      {
        status,
      }
    );

    const item = response.data;
    return {
      id: item._id || item.id || copyId,
      companyId: item.company_id || item.companyId || "company-001",
      bookId: item.book_id || item.bookId || bookId,
      code: item.copy_code || item.code || "-",
      status: (item.status as BookCopyStatus) || status,
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || new Date().toISOString(),
    };
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Gagal mengubah status copy buku karena gangguan server.")
      );
    }
    const { changeBookCopyStatus } = await import("./mock-api");
    return await changeBookCopyStatus(copyId, status);
  }
}

export async function deleteBookCopyApi(
  bookId: string,
  copyId: string
): Promise<{ id: string; status?: string }> {
  try {
    const response = await api.delete(`/catalog/books/${bookId}/copies/${copyId}`);
    return response.data;
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Gagal menghapus copy buku karena gangguan server.")
      );
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
    const [books, loans] = await Promise.all([
      getBooksApi({ size: 100 }),
      listLoansApi(),
    ]);

    const booksAvailable = books.reduce(
      (acc, b) => acc + (b.availableCopies || 0),
      0
    );
    const booksBorrowed = books.reduce(
      (acc, b) =>
        acc + Math.max(0, (b.totalCopies || 0) - (b.availableCopies || 0)),
      0
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeLoans = loans.filter((tx) => {
      if (tx.loan.status !== "ACTIVE") return false;
      const dueDate = new Date(`${tx.loan.dueAt.slice(0, 10)}T00:00:00`);
      return Number.isNaN(dueDate.getTime()) || dueDate >= today;
    }).length;

    const overdueLoans = loans.filter((tx) => {
      if (tx.loan.status === "OVERDUE") return true;
      if (tx.loan.status !== "ACTIVE") return false;
      const dueDate = new Date(`${tx.loan.dueAt.slice(0, 10)}T00:00:00`);
      return !Number.isNaN(dueDate.getTime()) && dueDate < today;
    }).length;

    const recentLoans = loans
      .map((tx) => ({
        ...tx.loan,
        memberName: tx.member?.name || "-",
      }))
      .slice(0, 10);

    return {
      booksAvailable,
      booksBorrowed,
      activeLoans,
      overdueLoans,
      recentLoans,
    };
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(error, "Dashboard gagal dimuat karena gangguan server backend.")
      );
    }
    // Fallback ke mock dashboard jika terjadi kegagalan non-500
    const { getDashboard } = await import("./mock-api");
    const fallback = await getDashboard();
    return {
      ...fallback,
      recentLoans: fallback.recentLoans.slice(0, 10),
    };
  }
}

export interface OfficeDashboardData {
  companyId: string;
  companyName: string;
  totalBooks: number;
  booksAvailable: number;
  booksBorrowed: number;
  activeLoans: number;
  overdueLoans: number;
  totalMembers: number;
  totalUsers: number;
  recentLoans: Array<{
    id: string;
    loanNumber: string;
    memberName: string;
    borrowedAt: string;
    dueAt: string;
    status: string;
  }>;
}

export async function getOfficeDashboardApi(companyId?: string): Promise<OfficeDashboardData> {
  const compId = companyId || "company-001";
  try {
    const response = await api.get("/office/dashboard", {
      params: { company_id: compId },
    });
    const raw = response.data?.data || response.data?.dashboard || response.data;
    return {
      companyId: compId,
      companyName: raw?.company_name || raw?.companyName || (compId === "company-002" ? "SMP Negeri 2 Bandung" : compId === "company-003" ? "Institut Teknologi Nusantara" : "SMA Negeri 1 Jakarta"),
      totalBooks: Number(raw?.total_books ?? raw?.totalBooks ?? (compId === "company-002" ? 82 : compId === "company-003" ? 210 : 45)),
      booksAvailable: Number(raw?.books_available ?? raw?.booksAvailable ?? (compId === "company-002" ? 70 : compId === "company-003" ? 185 : 38)),
      booksBorrowed: Number(raw?.books_borrowed ?? raw?.booksBorrowed ?? (compId === "company-002" ? 12 : compId === "company-003" ? 25 : 7)),
      activeLoans: Number(raw?.active_loans ?? raw?.activeLoans ?? (compId === "company-002" ? 10 : compId === "company-003" ? 20 : 5)),
      overdueLoans: Number(raw?.overdue_loans ?? raw?.overdueLoans ?? (compId === "company-002" ? 2 : compId === "company-003" ? 5 : 2)),
      totalMembers: Number(raw?.total_members ?? raw?.totalMembers ?? (compId === "company-002" ? 240 : compId === "company-003" ? 550 : 120)),
      totalUsers: Number(raw?.total_users ?? raw?.totalUsers ?? (compId === "company-002" ? 6 : compId === "company-003" ? 12 : 4)),
      recentLoans: Array.isArray(raw?.recent_loans || raw?.recentLoans)
        ? (raw?.recent_loans || raw?.recentLoans)
        : [
            {
              id: "loan-01",
              loanNumber: "TRX-B63334",
              memberName: "Demo Member Two",
              borrowedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
              dueAt: new Date(Date.now() + 4 * 86400000).toISOString(),
              status: "ACTIVE",
            },
            {
              id: "loan-02",
              loanNumber: "TRX-B63337",
              memberName: "Demo Member Two",
              borrowedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
              dueAt: new Date(Date.now() + 4 * 86400000).toISOString(),
              status: "ACTIVE",
            },
          ],
    };
  } catch (err: any) {
    if (err.response?.status >= 500) {
      throw new Error(formatApiError(err, "Office dashboard gagal dimuat karena gangguan server."));
    }
    return {
      companyId: compId,
      companyName: compId === "company-002" ? "SMP Negeri 2 Bandung" : compId === "company-003" ? "Institut Teknologi Nusantara" : "SMA Negeri 1 Jakarta",
      totalBooks: compId === "company-002" ? 82 : compId === "company-003" ? 210 : 45,
      booksAvailable: compId === "company-002" ? 70 : compId === "company-003" ? 185 : 38,
      booksBorrowed: compId === "company-002" ? 12 : compId === "company-003" ? 25 : 7,
      activeLoans: compId === "company-002" ? 10 : compId === "company-003" ? 20 : 5,
      overdueLoans: compId === "company-002" ? 2 : compId === "company-003" ? 5 : 2,
      totalMembers: compId === "company-002" ? 240 : compId === "company-003" ? 550 : 120,
      totalUsers: compId === "company-002" ? 6 : compId === "company-003" ? 12 : 4,
      recentLoans: [
        {
          id: "loan-01",
          loanNumber: "TRX-B63334",
          memberName: "Demo Member Two",
          borrowedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          dueAt: new Date(Date.now() + 4 * 86400000).toISOString(),
          status: "ACTIVE",
        },
        {
          id: "loan-02",
          loanNumber: "TRX-B63337",
          memberName: "Demo Member Two",
          borrowedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          dueAt: new Date(Date.now() + 4 * 86400000).toISOString(),
          status: "ACTIVE",
        },
      ],
    };
  }
}

function formatCleanLoanNumber(raw: any): string {
  const candidate = raw.loan_number || raw.loanNumber || raw.code;
  if (candidate && candidate !== "-" && typeof candidate === "string") {
    const isLongHexOrUuid =
      /^[0-9a-f]{16,}$/i.test(candidate) ||
      /^[0-9a-f]{6,}-[0-9a-f]{6,}/i.test(candidate) ||
      (candidate.includes("-") &&
        candidate.length > 20 &&
        !candidate.startsWith("TRX-") &&
        !candidate.startsWith("LOAN-"));
    if (!isLongHexOrUuid) {
      return candidate;
    }
  }

  const rawId = String(raw.id || raw.loan_id || raw._id || "");
  if (rawId) {
    const parts = rawId.split("-");
    const lastPart = parts[parts.length - 1] || parts[0];
    const clean = lastPart.replace(/[^a-zA-Z0-9]/g, "");
    const suffix =
      clean.length > 6 ? clean.slice(-6).toUpperCase() : clean.toUpperCase();
    if (suffix) {
      return `TRX-${suffix}`;
    }
  }

  return `TRX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function extractCopyIdsFromRaw(raw: any): string[] {
  const candidates = [
    raw.copy_ids,
    raw.copies,
    raw.book_copies,
    raw.book_copy_ids,
    raw.bookCopyIds,
    raw.items,
    raw.loan_items,
    raw.details,
    raw.loan?.copy_ids,
    raw.loan?.copies,
    raw.loan?.items,
    raw.copy_id,
    raw.copyId,
    raw.book_copy_id,
    raw.bookCopyId,
    raw.loan?.copy_id,
  ];

  const results: string[] = [];

  for (const cand of candidates) {
    if (!cand) continue;
    if (Array.isArray(cand)) {
      for (const c of cand) {
        if (!c) continue;
        if (typeof c === "string") {
          results.push(c);
        } else if (typeof c === "object") {
          const id =
            c.book_copy_id ||
            c.bookCopyId ||
            c.copy_id ||
            c.copyId ||
            c.book_copy?._id ||
            c.book_copy?.id ||
            c.bookCopy?._id ||
            c.bookCopy?.id ||
            c.copy?._id ||
            c.copy?.id ||
            c._id ||
            c.id ||
            c.$oid;
          if (id && typeof id === "string") {
            results.push(id);
          }
        }
      }
    } else if (typeof cand === "string") {
      results.push(cand);
    } else if (typeof cand === "object") {
      const id = cand._id || cand.id || cand.$oid;
      if (id && typeof id === "string") {
        results.push(id);
      }
    }

    if (results.length > 0) {
      break;
    }
  }

  return Array.from(new Set(results));
}

function mapRawToTransactionData(raw: any): TransactionData {
  const loanId =
    raw._id ||
    raw.id ||
    raw.loan?._id ||
    raw.loan?.id ||
    raw.loan_id ||
    raw.loanId ||
    `loan-${Math.random().toString(36).slice(2)}`;

  const loan: Loan = {
    id: loanId,
    companyId: raw.company_id || raw.companyId || "company-001",
    loanNumber: formatCleanLoanNumber(raw),
    memberId:
      raw.member_id ||
      raw.memberId ||
      raw.member?.id ||
      raw.member?._id ||
      raw.loan?.member_id ||
      "-",
    borrowedBy:
      raw.borrowed_by ||
      raw.borrowedBy ||
      raw.user_id ||
      raw.user?.id ||
      "-",
    borrowedAt:
      raw.borrowed_at ||
      raw.borrowedAt ||
      raw.loan?.borrowed_at ||
      new Date().toISOString(),
    dueAt:
      raw.due_at ||
      raw.dueAt ||
      raw.loan?.due_at ||
      new Date().toISOString(),
    returnedAt:
      raw.returned_at ||
      raw.returnedAt ||
      raw.loan?.returned_at ||
      undefined,
    status:
      raw.status === "COMPLETED" ||
      raw.loan?.status === "COMPLETED" ||
      raw.returned_at ||
      raw.returnedAt ||
      raw.loan?.returned_at
        ? "COMPLETED"
        : (raw.status || raw.loan?.status || "ACTIVE"),
    notes: raw.notes || undefined,
    createdAt:
      raw.created_at ||
      raw.createdAt ||
      raw.loan?.created_at ||
      new Date().toISOString(),
    updatedAt:
      raw.updated_at ||
      raw.updatedAt ||
      raw.loan?.updated_at ||
      new Date().toISOString(),
  };

  const member: Member = raw.member
    ? {
        id: raw.member._id || raw.member.id || loan.memberId,
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
        id: raw.user._id || raw.user.id || loan.borrowedBy,
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

  const rawCopyIds = extractCopyIdsFromRaw(raw);
  let items: TransactionData["items"] = [];

  if (rawCopyIds.length > 0) {
    items = rawCopyIds.map((cId: string, idx: number) => ({
      loanItem: {
        id: `loan-item-${loan.id}-${idx}`,
        companyId: loan.companyId,
        loanId: loan.id,
        bookId: raw.book_id || raw.bookId || `book-${loan.id}`,
        bookCopyId: cId,
        returnedAt: loan.returnedAt,
        status:
          loan.status === "COMPLETED"
            ? ("RETURNED" as const)
            : ("BORROWED" as const),
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
        id: cId,
        companyId: loan.companyId,
        bookId: raw.book_id || raw.bookId || `book-${loan.id}`,
        code: raw.copy_code || raw.copyCode || "CP-001",
        status: "BORROWED" as const,
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt,
      },
    }));
  } else {
    const copyId =
      raw.book_copy_id || raw.bookCopyId || raw.copy_id || `copy-${loan.id}`;
    items = [
      {
        loanItem: {
          id: `loan-item-${loan.id}-0`,
          companyId: loan.companyId,
          loanId: loan.id,
          bookId: raw.book_id || raw.bookId || `book-${loan.id}`,
          bookCopyId: copyId,
          returnedAt: loan.returnedAt,
          status:
            loan.status === "COMPLETED"
              ? ("RETURNED" as const)
              : ("BORROWED" as const),
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
          id: copyId,
          companyId: loan.companyId,
          bookId: raw.book_id || raw.bookId || `book-${loan.id}`,
          code: raw.copy_code || raw.copyCode || "CP-001",
          status: "BORROWED" as const,
          createdAt: loan.createdAt,
          updatedAt: loan.updatedAt,
        },
      },
    ];
  }

  return {
    loan,
    member,
    user,
    items,
  };
}

export interface CreateLoanItemInput {
  bookId: string;
  bookCopyIds: string[];
}

export interface CreateLoanInputData {
  memberId: string;
  copyIds?: string[];
  items?: CreateLoanItemInput[];
  borrowedAt: string;
  dueAt: string;
}

function toIsoDateTime(dateStr: string, isEndOfDay = false): string {
  if (!dateStr) return new Date().toISOString();
  if (dateStr.includes("T")) {
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  const timePart = isEndOfDay ? "T23:59:59.000Z" : "T00:00:00.000Z";
  const d = new Date(`${dateStr}${timePart}`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export async function createLoanApi(data: CreateLoanInputData): Promise<Loan> {
  let copyIds = data.copyIds || [];
  if (data.items && data.items.length > 0) {
    const itemCopyIds = data.items.flatMap((item) => item.bookCopyIds);
    copyIds = Array.from(new Set([...copyIds, ...itemCopyIds]));
  }

  const payload = {
    member_id: data.memberId,
    copy_ids: copyIds,
    borrowed_at: toIsoDateTime(data.borrowedAt, false),
    due_at: toIsoDateTime(data.dueAt, true),
  };

  try {
    const response = await api.post("/loan", payload);

    const raw = response.data?.loan || response.data;
    if (raw && (raw.id || raw._id || raw.loan_number || raw.loanNumber)) {
      return {
        id: raw._id || raw.id || `loan-${Date.now()}`,
        companyId: raw.company_id || raw.companyId || "company-001",
        loanNumber: formatCleanLoanNumber(raw),
        memberId: raw.member_id || raw.memberId || data.memberId,
        borrowedBy: raw.borrowed_by || raw.borrowedBy || "-",
        borrowedAt: raw.borrowed_at || raw.borrowedAt || payload.borrowed_at,
        dueAt: raw.due_at || raw.dueAt || payload.due_at,
        returnedAt: raw.returned_at || raw.returnedAt || undefined,
        status: (raw.status as Loan["status"]) || "ACTIVE",
        notes: raw.notes || undefined,
        createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
        updatedAt: raw.updated_at || raw.updatedAt || new Date().toISOString(),
      };
    }

    return {
      id: `loan-${Date.now()}`,
      companyId: "company-001",
      loanNumber: `TRX-${Date.now().toString().slice(-6)}`,
      memberId: data.memberId,
      borrowedBy: "-",
      borrowedAt: payload.borrowed_at,
      dueAt: payload.due_at,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal membuat data peminjaman."));
  }
}

async function enrichTransactions(
  transactions: TransactionData[]
): Promise<TransactionData[]> {
  try {
    const [members, books] = await Promise.all([
      getMembersApi().catch(() => []),
      getBooksApi().catch(() => []),
    ]);

    const memberMap = new Map(members.map((m) => [m.id, m]));
    const bookMap = new Map(books.map((b) => [b.id, b]));

    // Kumpulkan bookId dan copyId yang relevan dari transaksi saja agar loading super cepat
    const neededBookIds = new Set<string>();
    for (const tx of transactions) {
      for (const it of tx.items) {
        if (it.loanItem?.bookId) {
          neededBookIds.add(it.loanItem.bookId);
        }
      }
    }

    // Ambil copies hanya untuk buku yang dipinjam atau maksimal beberapa buku saja
    const relevantBooks =
      neededBookIds.size > 0
        ? books.filter((b) => neededBookIds.has(b.id))
        : books.slice(0, 5);

    const copiesMap = new Map<string, { book: Book; copy: BookCopy }>();
    await Promise.all(
      relevantBooks.map(async (b) => {
        try {
          const copies = await getBookCopiesApi(b.id);
          for (const c of copies) {
            copiesMap.set(c.id, { book: b, copy: c });
            if (c.code) {
              copiesMap.set(c.code, { book: b, copy: c });
            }
          }
        } catch {
          // ignore
        }
      })
    );

    for (const tx of transactions) {
      if (
        !tx.member?.name ||
        tx.member.name === "Anggota" ||
        tx.member.name === "-"
      ) {
        const foundMember = memberMap.get(tx.loan.memberId);
        if (foundMember) {
          tx.member = foundMember;
        }
      }

      for (const it of tx.items) {
        const copyInfo =
          copiesMap.get(it.loanItem.bookCopyId) ||
          copiesMap.get(it.bookCopy.code) ||
          copiesMap.get(it.bookCopy.id);

        if (copyInfo) {
          it.book = copyInfo.book;
          it.bookCopy.code = copyInfo.copy.code;
          it.bookCopy.id = copyInfo.copy.id;
          it.bookCopy.bookId = copyInfo.book.id;
          it.bookCopy.status = copyInfo.copy.status;
          it.loanItem.bookId = copyInfo.book.id;
          it.loanItem.bookCopyId = copyInfo.copy.id;
          if (
            copyInfo.copy.status === "AVAILABLE" ||
            tx.loan.status === "COMPLETED" ||
            tx.loan.returnedAt
          ) {
            it.loanItem.status = "RETURNED";
            it.loanItem.returnedAt =
              tx.loan.returnedAt || new Date().toISOString();
          }
        } else {
          const foundBook = bookMap.get(it.loanItem.bookId);
          if (foundBook) {
            it.book = foundBook;
            if (
              !it.bookCopy.code ||
              it.bookCopy.code === "-" ||
              it.bookCopy.code.includes("CP-001") ||
              it.bookCopy.code.endsWith("-001")
            ) {
              it.bookCopy.code = `${foundBook.code}-001`;
            }
          }
        }
      }

      const allReturned =
        tx.items.length > 0 &&
        tx.items.every((it) => it.loanItem.status === "RETURNED");
      if (allReturned || tx.loan.status === "COMPLETED" || tx.loan.returnedAt) {
        tx.loan.status = "COMPLETED";
        if (!tx.loan.returnedAt) {
          tx.loan.returnedAt = new Date().toISOString();
        }
      }
    }
  } catch {
    // Ignore enrichment failure
  }

  return transactions;
}

export async function listLoansApi(): Promise<TransactionData[]> {
  try {
    const response = await api
      .get("/loan")
      .catch((err) => {
        if (err.response?.status >= 500) throw err;
        return api.get("/loans");
      });

    const items = response.data?.items || response.data || [];
    if (Array.isArray(items) && items.length > 0) {
      const mapped = items.map(mapRawToTransactionData);
      return await enrichTransactions(mapped);
    }
    return [];
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(
          error,
          "Daftar peminjaman gagal dimuat karena gangguan server."
        )
      );
    }
    if (error.response?.status === 404) {
      return [];
    }
    // Fallback ke mock jika backend belum tersedia
    const { getTransactions } = await import("./mock-api");
    return getTransactions();
  }
}

export async function getActiveReturnsApi(
  companyId?: string
): Promise<ReturnLoanData[]> {
  const auth = getAuthData();
  const compId = companyId || auth?.user?.companyId || "company-001";

  try {
    const response = await api
      .get("/loan/returns/active")
      .catch(() =>
        api.get("/loan/returns/active", {
          params: { company_id: compId },
        })
      )
      .catch(() =>
        api.get("/office/loan/returns/active", {
          params: { company_id: compId },
        })
      )
      .catch(() => api.get("/returns/active"));

    const items = response.data?.items || response.data || [];
    if (Array.isArray(items) && items.length > 0) {
      const mapped = items.map(mapRawToTransactionData);
      const enriched = await enrichTransactions(mapped);
      // Filter hanya transaksi yang masih memiliki copy yang dipinjam
      return enriched.filter(
        (tx) =>
          tx.loan.status !== "COMPLETED" &&
          tx.items.some((it) => it.loanItem.status === "BORROWED")
      );
    }

    // Jika endpoint active returns kosong di backend, return []
    return [];
  } catch (error: any) {
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(
          error,
          "Daftar pengembalian aktif gagal dimuat karena gangguan server."
        )
      );
    }
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
  copyIds: string[],
  fallbackItemIds?: string[],
  companyId?: string
): Promise<Loan> {
  const auth = getAuthData();
  const compId = companyId || auth?.user?.companyId || "company-001";

  try {
    // Sanitize copyIds: bersihkan prefix seperti 'copy-' dan prioritaskan 24-hex MongoDB ObjectId
    const cleanCopyIds = copyIds.map((id) => {
      if (!id || typeof id !== "string") return id;
      const hexMatch = id.match(/[0-9a-fA-F]{24}/);
      return hexMatch ? hexMatch[0] : id;
    });

    const validHexIds = cleanCopyIds.filter(
      (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id)
    );
    const finalCopyIds = validHexIds.length > 0 ? validHexIds : cleanCopyIds;

    const payload = {
      copy_ids: finalCopyIds,
    };

    const response = await api
      .post(`/loan/returns/${loanId}`, payload)
      .catch(() =>
        api.post(`/loan/returns/${loanId}`, payload, {
          params: { company_id: compId },
        })
      )
      .catch(() =>
        api.post(`/office/loan/returns/${loanId}`, payload, {
          params: { company_id: compId },
        })
      );

    const raw = response.data?.loan || response.data;
    if (raw && (raw.id || raw._id)) {
      return {
        id: raw._id || raw.id || loanId,
        companyId: raw.company_id || raw.companyId || compId,
        loanNumber: formatCleanLoanNumber(raw),
        memberId: raw.member_id || raw.memberId || "-",
        borrowedBy: raw.borrowed_by || raw.borrowedBy || "-",
        borrowedAt:
          raw.borrowed_at || raw.borrowedAt || new Date().toISOString(),
        dueAt: raw.due_at || raw.dueAt || new Date().toISOString(),
        returnedAt:
          raw.returned_at || raw.returnedAt || new Date().toISOString(),
        status: raw.status || "COMPLETED",
        createdAt:
          raw.created_at || raw.createdAt || new Date().toISOString(),
        updatedAt:
          raw.updated_at || raw.updatedAt || new Date().toISOString(),
      };
    }
    throw new Error("Format respons pengembalian tidak valid.");
  } catch (error: any) {
    // Jika backend mengembalikan 409 Conflict: "Copy sudah dikembalikan"
    const detail =
      error.response?.data?.detail || error.response?.data?.message || "";
    const isAlreadyReturned =
      error.response?.status === 409 ||
      (typeof detail === "string" &&
        detail.toLowerCase().includes("sudah dikembalikan"));

    if (isAlreadyReturned) {
      return {
        id: loanId,
        companyId: compId,
        loanNumber: `TRX-${loanId.slice(-6).toUpperCase()}`,
        memberId: "-",
        borrowedBy: "-",
        borrowedAt: new Date().toISOString(),
        dueAt: new Date().toISOString(),
        returnedAt: new Date().toISOString(),
        status: "COMPLETED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    if (
      error.response?.status >= 500 ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Server Error")
    ) {
      throw new Error(
        formatApiError(
          error,
          "Pengembalian buku gagal diproses oleh server backend."
        )
      );
    }

    const errorMsg = formatApiError(error, "");
    if (errorMsg) {
      throw new Error(errorMsg);
    }

    // Fallback ke mock jika backend benar-benar 404
    if (error.response?.status === 404) {
      const { returnLoanItems } = await import("./mock-api");
      return returnLoanItems(loanId, fallbackItemIds || copyIds);
    }

    throw new Error("Pengembalian buku gagal diproses oleh server.");
  }
}

// =========================================================
// OFFICE MEMBERS API (SUPER ADMIN MULTI-TENANT)
// =========================================================

export interface OfficeMemberPayload {
  name: string;
  member_number?: string;
  memberNumber?: string;
  identity_number?: string;
  identityNumber?: string;
  phone: string;
  email?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export interface OfficeMembersListResponse {
  items: Member[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export async function getOfficeMembersApi(
  companyId: string,
  params: {
    page?: number;
    size?: number;
    sortby?: string;
    order?: string;
  } = {}
): Promise<OfficeMembersListResponse> {
  const compId = companyId || "company-001";
  const page = params.page || 1;
  const size = params.size || 10;
  const sortby = params.sortby || "name";
  const order = params.order || "asc";

  try {
    const response = await api.get("/bukuflow/office/member", {
      params: {
        company_id: compId,
        page,
        size,
        sortby,
        order,
      },
    });

    const raw = response.data;
    const items = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw)
      ? raw
      : [];

    const mappedItems: Member[] = items.map((item: any) => ({
      id: String(item.id || item.member_id || `mbr-${Math.random()}`),
      companyId: String(item.company_id || item.companyId || compId),
      memberNumber: String(item.member_number || item.memberNumber || "-"),
      name: String(item.name || "-"),
      memberType: (item.member_type || item.memberType || "UMUM") as any,
      identityNumber: String(item.identity_number || item.identityNumber || "-"),
      phone: String(item.phone || "-"),
      email: String(item.email || "-"),
      status: (item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") as any,
      createdAt: String(item.created_at || item.createdAt || new Date().toISOString()),
      updatedAt: String(item.updated_at || item.updatedAt || new Date().toISOString()),
    }));

    const total = Number(raw?.total || raw?.count || mappedItems.length);
    const totalPages = Number(raw?.total_pages || raw?.totalPages || Math.ceil(total / size) || 1);

    return {
      items: mappedItems,
      total,
      page,
      size,
      totalPages,
    };
  } catch (error: any) {
    if (error.response?.status >= 500) {
      throw new Error(formatApiError(error, "Gagal memuat data member office."));
    }

    // Fallback Mock Data per Company
    const { mockMembers, ensureMockStoreHydrated } = await import("./mock-store");
    ensureMockStoreHydrated();
    const allMembers = mockMembers.filter((m: Member) => m.companyId === compId);
    const total = allMembers.length;
    const totalPages = Math.ceil(total / size) || 1;
    const start = (page - 1) * size;
    const paginated = allMembers.slice(start, start + size);

    return {
      items: paginated,
      total,
      page,
      size,
      totalPages,
    };
  }
}

export async function searchOfficeMembersApi(
  companyId: string,
  query: string
): Promise<Member[]> {
  const compId = companyId || "company-001";
  try {
    const response = await api.get("/bukuflow/office/member/search", {
      params: {
        q: query,
        company_id: compId,
      },
    });

    const raw = response.data;
    const items = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];

    return items.map((item: any) => ({
      id: String(item.id || item.member_id || `mbr-${Math.random()}`),
      companyId: String(item.company_id || item.companyId || compId),
      memberNumber: String(item.member_number || item.memberNumber || "-"),
      name: String(item.name || "-"),
      memberType: (item.member_type || item.memberType || "UMUM") as any,
      identityNumber: String(item.identity_number || item.identityNumber || "-"),
      phone: String(item.phone || "-"),
      email: String(item.email || "-"),
      status: (item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") as any,
      createdAt: String(item.created_at || item.createdAt || new Date().toISOString()),
      updatedAt: String(item.updated_at || item.updatedAt || new Date().toISOString()),
    }));
  } catch (error: any) {
    const { mockMembers, ensureMockStoreHydrated } = await import("./mock-store");
    ensureMockStoreHydrated();
    const q = query.toLowerCase();
    return mockMembers.filter(
      (m: Member) =>
        m.companyId === compId &&
        (m.name.toLowerCase().includes(q) ||
          m.memberNumber.toLowerCase().includes(q) ||
          m.identityNumber.toLowerCase().includes(q) ||
          m.phone.toLowerCase().includes(q))
    );
  }
}

export async function getOfficeMemberDetailApi(
  companyId: string,
  memberId: string
): Promise<Member> {
  const compId = companyId || "company-001";
  try {
    const response = await api.get(`/bukuflow/office/member/${memberId}`, {
      params: { company_id: compId },
    });

    const item = response.data?.data || response.data;
    return {
      id: String(item.id || item.member_id || memberId),
      companyId: String(item.company_id || item.companyId || compId),
      memberNumber: String(item.member_number || item.memberNumber || "-"),
      name: String(item.name || "-"),
      memberType: (item.member_type || item.memberType || "UMUM") as any,
      identityNumber: String(item.identity_number || item.identityNumber || "-"),
      phone: String(item.phone || "-"),
      email: String(item.email || "-"),
      status: (item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") as any,
      createdAt: String(item.created_at || item.createdAt || new Date().toISOString()),
      updatedAt: String(item.updated_at || item.updatedAt || new Date().toISOString()),
    };
  } catch (error: any) {
    const { mockMembers, ensureMockStoreHydrated } = await import("./mock-store");
    ensureMockStoreHydrated();
    const found = mockMembers.find((m: Member) => m.id === memberId);
    if (!found) throw new Error("Member tidak ditemukan.");
    return found;
  }
}

export async function createOfficeMemberApi(
  companyId: string,
  payload: OfficeMemberPayload
): Promise<Member> {
  const compId = companyId || "company-001";
  const body = {
    name: payload.name.trim(),
    member_number: payload.member_number || payload.memberNumber || `MBR-${Date.now().toString().slice(-4)}`,
    identity_number: payload.identity_number || payload.identityNumber || "-",
    phone: payload.phone.trim(),
    email: payload.email ? payload.email.trim() : "",
  };

  try {
    const response = await api.post("/bukuflow/office/member", body, {
      params: { company_id: compId },
    });

    const item = response.data?.data || response.data;
    return {
      id: String(item.id || item.member_id || `mbr-${Date.now()}`),
      companyId: String(item.company_id || compId),
      memberNumber: String(item.member_number || body.member_number),
      name: String(item.name || body.name),
      memberType: "UMUM",
      identityNumber: String(item.identity_number || body.identity_number),
      phone: String(item.phone || body.phone),
      email: String(item.email || body.email),
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    if (error.response?.status >= 500) {
      throw new Error(formatApiError(error, "Gagal membuat member baru."));
    }

    // Fallback Mock create
    const { mockMembers, ensureMockStoreHydrated, persistMockState } = await import("./mock-store");
    ensureMockStoreHydrated();
    const newMember: Member = {
      id: `mbr-${Date.now()}`,
      companyId: compId,
      memberNumber: body.member_number,
      name: body.name,
      memberType: "UMUM",
      identityNumber: body.identity_number,
      phone: body.phone,
      email: body.email,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockMembers.unshift(newMember);
    persistMockState();
    return newMember;
  }
}

export async function updateOfficeMemberApi(
  companyId: string,
  memberId: string,
  payload: Partial<OfficeMemberPayload>
): Promise<Member> {
  const compId = companyId || "company-001";
  const body: Record<string, any> = {};
  if (payload.name !== undefined) body.name = payload.name.trim();
  if (payload.member_number || payload.memberNumber) body.member_number = payload.member_number || payload.memberNumber;
  if (payload.identity_number || payload.identityNumber) body.identity_number = payload.identity_number || payload.identityNumber;
  if (payload.phone !== undefined) body.phone = payload.phone.trim();
  if (payload.email !== undefined) body.email = payload.email.trim();
  if (payload.status !== undefined) body.status = payload.status;

  try {
    const response = await api.patch(`/bukuflow/office/member/${memberId}`, body, {
      params: { company_id: compId },
    });

    const item = response.data?.data || response.data;
    return {
      id: String(item.id || memberId),
      companyId: String(item.company_id || compId),
      memberNumber: String(item.member_number || body.member_number || "-"),
      name: String(item.name || body.name || "-"),
      memberType: "UMUM",
      identityNumber: String(item.identity_number || body.identity_number || "-"),
      phone: String(item.phone || body.phone || "-"),
      email: String(item.email || body.email || "-"),
      status: (item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    if (error.response?.status >= 500) {
      throw new Error(formatApiError(error, "Gagal memperbarui data member."));
    }

    // Fallback Mock update
    const { mockMembers, ensureMockStoreHydrated, persistMockState } = await import("./mock-store");
    ensureMockStoreHydrated();
    const index = mockMembers.findIndex((m: Member) => m.id === memberId);
    if (index === -1) throw new Error("Member tidak ditemukan.");

    const existing = mockMembers[index];
    const updated: Member = {
      ...existing,
      name: body.name ?? existing.name,
      memberNumber: body.member_number ?? existing.memberNumber,
      identityNumber: body.identity_number ?? existing.identityNumber,
      phone: body.phone ?? existing.phone,
      email: body.email ?? existing.email,
      status: (body.status as any) ?? existing.status,
      updatedAt: new Date().toISOString(),
    };

    mockMembers[index] = updated;
    persistMockState();
    return updated;
  }
}