import axios from "axios";
import { getAccessToken, getTokenType, clearAuthData, getAuthData, markSessionExpired } from "./auth";
import type {
  Book,
  BookCopy,
  BookStatus,
  BookCopyStatus,
  Company,
  CompanySettings,
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
      const auth = getAuthData();
      const currentToken = auth?.accessToken || getAccessToken();

      // Abaikan 401 jika user baru saja login dalam 5 detik terakhir (cegah stale in-flight request dari sesi lama)
      if (auth?.loginAt) {
        const timeSinceLogin = Date.now() - new Date(auth.loginAt).getTime();
        if (timeSinceLogin < 5000) {
          return Promise.reject(error);
        }
      }

      // Ambil header authorization dengan aman (mendukung AxiosHeaders instance di Axios v1)
      const headers = error.config?.headers;
      const requestAuthHeader =
        (typeof headers?.get === "function"
          ? headers.get("Authorization") || headers.get("authorization")
          : null) ||
        headers?.Authorization ||
        headers?.authorization;

      const requestToken = requestAuthHeader
        ? String(requestAuthHeader).replace(/^Bearer\s+/i, "").trim()
        : null;

      // Jika token di request berbeda dengan token aktif saat ini (request lama), abaikan 401
      if (currentToken && requestToken && currentToken !== requestToken) {
        return Promise.reject(error);
      }

      if (!isLoggingOut) {
        isLoggingOut = true;

        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/login")
        ) {
          markSessionExpired();
          window.dispatchEvent(new CustomEvent("bukuflow:session_expired"));
        } else {
          clearAuthData();
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
// Helper: Resolve Company ID
// ----------------------------------------------------

export function resolveCompanyId(explicit?: string): string {
  const auth = getAuthData();
  const isSuperAdmin = auth?.user?.role === "SUPER_ADMIN";
  const compId = explicit?.trim() || auth?.user?.companyId?.trim();
  if (!compId) {
    if (isSuperAdmin) {
      return "";
    }
    throw new Error("ID instansi tidak tersedia di sesi. Silakan login ulang.");
  }
  return compId;
}

// ----------------------------------------------------
// Helper: Error Formatting
// ----------------------------------------------------

export { getErrorMessage, getFieldErrors } from "./errors";
import { getErrorMessage } from "./errors";

export function formatApiError(
  error: any,
  defaultMessage: string = "Terjadi kesalahan pada sistem."
): string {
  return getErrorMessage(error, defaultMessage);
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
    const companyId = rawUser.company_id || rawUser.companyId || "";
    const role = rawUser.role || "STAFF";

    if (role !== "SUPER_ADMIN" && !companyId) {
      throw new Error("Akun belum terhubung ke instansi.");
    }

    return {
      access_token: raw.access_token,
      token_type: raw.token_type || "bearer",
      data: {
        id: rawUser.id,
        name: rawUser.name,
        email: rawUser.email,
        role: rawUser.role,
        companyId,
      },
      user: raw.user || raw.data, 
    };
  } catch (error: any) {
    if (error.message === "Akun belum terhubung ke instansi.") {
      throw error;
    }
    throw new Error(formatApiError(error, "Email atau password salah."));
  }
}

export async function getMeApi() {
  const response = await api.get("/auth/me");
  return response.data;
}

export async function logoutApi() {
  try {
    await api.post("/auth/logout", {}, { timeout: 1500 });
  } catch (error: any) {
    console.warn("Gagal logout di server (tetap membersihkan sesi lokal):", error?.message);
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
    id: item._id || item.id || "",
    companyId: item.company_id || item.companyId || "",
    memberNumber: item.member_number || item.memberNumber || item.code || "-",
    name: item.name || "-",
    identityNumber: item.identity_number || item.identityNumber || "-",
    phone: item.phone || "-",
    email: item.email || undefined,
    status: (item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") as MemberStatus,
    memberType: item.member_type || item.memberType || "UMUM",
    createdAt: item.created_at || "",
    updatedAt: item.updated_at || item.created_at || "",
  };
}

export async function getMembersApi(
  params?: ListMembersParams
): Promise<Member[]> {
  try {
    const res = await getMembersPaginatedApi({
      page: params?.page ?? 1,
      size: params?.size ?? 10,
      sortby: params?.sortby,
      order: params?.order,
    });
    return res.items;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return [];
    }
    throw new Error(
      formatApiError(error, "Data anggota gagal dimuat.")
    );
  }
}

let lastKnownMembersTotal = 0;

export async function getMembersPaginatedApi(
  params?: ListMembersParams
): Promise<{ items: Member[]; total: number; page: number; size: number; totalPages: number }> {
  const page = params?.page ?? 1;
  const requestedSize = params?.size ?? 10;

  // Jika memanggil dataset besar (misal ekspor seluruh data dengan size > 100)
  if (requestedSize > 100) {
    const batchSize = 100;
    try {
      const firstPageRes = await api.get("/member", {
        params: {
          page: 1,
          size: batchSize,
          sortby: params?.sortby ?? undefined,
          order: params?.order ?? "asc",
        },
      });

      const firstRaw = firstPageRes.data;
      const firstItems = firstRaw?.items || firstRaw?.data || (Array.isArray(firstRaw) ? firstRaw : []);
      let allMapped = Array.isArray(firstItems) ? firstItems.map(mapRawToMember) : [];
      const total = typeof firstRaw?.total === "number" && firstRaw.total >= 0 ? firstRaw.total : allMapped.length;
      const totalPages = Math.max(1, Math.ceil(total / batchSize));

      if (totalPages > 1) {
        for (let p = 2; p <= totalPages; p++) {
          try {
            const nextRes = await api.get("/member", {
              params: {
                page: p,
                size: batchSize,
                sortby: params?.sortby ?? undefined,
                order: params?.order ?? "asc",
              },
            });
            const nextRaw = nextRes.data;
            const nextItems = nextRaw?.items || nextRaw?.data || (Array.isArray(nextRaw) ? nextRaw : []);
            if (Array.isArray(nextItems)) {
              allMapped = allMapped.concat(nextItems.map(mapRawToMember));
            }
          } catch {
            break;
          }
        }
      }

      return {
        items: allMapped,
        total,
        page: 1,
        size: requestedSize,
        totalPages: 1,
      };
    } catch (error: any) {
      throw new Error(formatApiError(error, "Data anggota gagal dimuat."));
    }
  }

  // Request normal (size <= 100)
  try {
    const response = await api.get("/member", {
      params: {
        page,
        size: requestedSize,
        sortby: params?.sortby ?? undefined,
        order: params?.order ?? "asc",
      },
    });

    const raw = response.data;
    const items = raw?.items || raw?.data || (Array.isArray(raw) ? raw : []);
    const mapped = Array.isArray(items) ? items.map(mapRawToMember) : [];

    let total = typeof raw?.total === "number" && raw.total >= 0 ? raw.total : -1;
    if (total > 0) {
      lastKnownMembersTotal = total;
    } else if (lastKnownMembersTotal > 0) {
      total = lastKnownMembersTotal;
    } else {
      if (mapped.length < requestedSize) {
        total = (page - 1) * requestedSize + mapped.length;
        lastKnownMembersTotal = total;
      } else {
        total = page * requestedSize + 1;
      }
    }

    if (mapped.length < requestedSize && total > (page - 1) * requestedSize + mapped.length) {
      total = (page - 1) * requestedSize + mapped.length;
      lastKnownMembersTotal = total;
    }

    const totalPages = Math.max(1, Math.ceil(total / requestedSize));

    return {
      items: mapped,
      total,
      page,
      size: requestedSize,
      totalPages,
    };
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Data anggota gagal dimuat.")
    );
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
    const response = await api.get("/member/search", {
      params: {
        q: cleanQuery,
      },
    });

    const items = response.data?.items || response.data || [];
    if (!Array.isArray(items)) return [];

    return items.map(mapRawToMember);
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 422) {
      return [];
    }
    throw new Error(
      formatApiError(error, "Pencarian anggota gagal diproses.")
    );
  }
}

export async function getMemberApi(memberId: string): Promise<Member> {
  try {
    const response = await api.get(`/member/${memberId}`);
    return mapRawToMember(response.data);
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Detail anggota gagal dimuat.")
    );
  }
}

export async function createMemberApi(
  data: CreateMemberInputData
): Promise<Member> {
  const cleanNik = data.identityNumber.trim();

  // Validasi keunikan NIK jika data anggota lama dapat diakses
  try {
    const existingMembers = await getMembersApi();
    const duplicateNik = existingMembers.some(
      (m) => m.identityNumber?.trim() === cleanNik
    );
    if (duplicateNik) {
      throw new Error(
        "NIK tersebut sudah terdaftar sebagai anggota. Gunakan NIK yang berbeda."
      );
    }
  } catch (err: any) {
    if (err.message?.includes("sudah terdaftar")) {
      throw err;
    }
    // Lanjutkan jika pengambilan daftar anggota gagal (backend akan memvalidasi)
  }

  const memberNumber = data.memberNumber?.trim();

  const payload: Record<string, any> = {
    name: data.name.trim(),
    identity_number: cleanNik,
    phone: data.phone.trim(),
    email: data.email?.trim() || null,
  };

  // Jika diisi manual oleh user, kirim member_number. Jika kosong, biarkan backend auto-increment
  if (memberNumber) {
    payload.member_number = memberNumber;
  }

  try {
    const response = await api.post("/member", payload);
    return mapRawToMember(response.data);
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Gagal membuat anggota baru.")
    );
  }
}

export async function updateMemberApi(
  memberId: string,
  data: UpdateMemberInputData
): Promise<Member> {
  if (data.identityNumber) {
    const cleanNik = data.identityNumber.trim();
    let existingMembers: Member[] = [];
    try {
      existingMembers = await getMembersApi();
    } catch (err: any) {
      throw new Error(
        formatApiError(
          err,
          "Gagal memuat data anggota untuk validasi NIK. Silakan periksa koneksi atau coba lagi."
        )
      );
    }
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
    const response = await api.patch(`/member/${memberId}`, payload);
    return mapRawToMember(response.data);
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Gagal memperbarui anggota.")
    );
  }
}

export async function deleteMemberApi(memberId: string): Promise<{ id: string; status?: string }> {
  try {
    const response = await api.delete(`/member/${memberId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Gagal menghapus anggota.")
    );
  }
}

export async function changeMemberStatusApi(
  memberId: string,
  status: MemberStatus
): Promise<Member> {
  try {
    const response = await api.patch(`/member/${memberId}`, {
      status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    });
    return mapRawToMember(response.data);
  } catch (error: any) {
    throw new Error(
      formatApiError(
        error,
        status === "ACTIVE"
          ? "Gagal mengaktifkan anggota."
          : "Gagal menonaktifkan anggota."
      )
    );
  }
}

function parseBookStatus(
  status: any,
  totalCopies: number,
  availableCopies: number,
  borrowedCopies?: number
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

  if (availableCopies > 0) {
    return "AVAILABLE";
  }

  if (borrowedCopies !== undefined && borrowedCopies > 0) {
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

let lastKnownBooksTotal = 0;

export async function getBooksApi(
  params?: ListBooksParams
): Promise<{ items: Book[]; total: number; page: number; size: number; totalPages: number }> {
  const page = params?.page ?? 1;
  const requestedSize = params?.size ?? 10;

  const mapItem = (item: any): Book => {
    const rawTotal = item.total_copies ?? item.totalCopies;
    const rawAvailable = item.available_copies ?? item.availableCopies;

    const hasExplicitTotal =
      rawTotal !== undefined && rawTotal !== null && Number(rawTotal) > 0;
    const totalCopies = hasExplicitTotal ? Number(rawTotal) : 1;
    const availableCopies =
      hasExplicitTotal && rawAvailable !== undefined && rawAvailable !== null
        ? Number(rawAvailable)
        : totalCopies;

    const cleanIsbn = item.isbn && item.isbn !== "-" && item.isbn.trim() !== "" ? item.isbn.trim() : undefined;
    const cleanAuthor = item.author && item.author !== "-" && item.author.trim() !== "" ? item.author.trim() : undefined;
    const cleanPublisher = item.publisher && item.publisher !== "-" && item.publisher.trim() !== "" ? item.publisher.trim() : undefined;
    const cleanCategory = item.category && item.category !== "-" && item.category.trim() !== "" ? item.category.trim() : undefined;

    return {
      id: item._id || item.id || "",
      companyId: item.company_id || item.companyId || "",
      code: item.code || "-",
      isbn: cleanIsbn,
      title: item.title || "-",
      author: cleanAuthor,
      publisher: cleanPublisher,
      publicationYear:
        item.published_year ||
        item.publication_year ||
        item.publicationYear ||
        undefined,
      category: cleanCategory,
      coverUrl: item.cover_url || item.coverUrl || undefined,
      status: parseBookStatus(item.status, totalCopies, availableCopies),
      totalCopies,
      availableCopies,
      createdAt: item.created_at || "",
      updatedAt: item.updated_at || item.created_at || "",
    };
  };

  // Jika caller meminta dataset besar (misal ekspor seluruh data dengan size > 100)
  if (requestedSize > 100) {
    const batchSize = 100;
    try {
      const firstRes = await api.get("/catalog/books", {
        params: {
          page: 1,
          size: batchSize,
          sortby: params?.sortby ?? undefined,
          order: params?.order ?? "asc",
        },
      });

      const firstRaw = firstRes.data;
      const firstItems = firstRaw?.items || firstRaw?.data || (Array.isArray(firstRaw) ? firstRaw : []);
      let allMapped = Array.isArray(firstItems) ? firstItems.map(mapItem) : [];
      const total = typeof firstRaw?.total === "number" && firstRaw.total >= 0 ? firstRaw.total : allMapped.length;
      const totalPages = Math.max(1, Math.ceil(total / batchSize));

      if (totalPages > 1) {
        for (let p = 2; p <= totalPages; p++) {
          try {
            const nextRes = await api.get("/catalog/books", {
              params: {
                page: p,
                size: batchSize,
                sortby: params?.sortby ?? undefined,
                order: params?.order ?? "asc",
              },
            });
            const nextRaw = nextRes.data;
            const nextItems = nextRaw?.items || nextRaw?.data || (Array.isArray(nextRaw) ? nextRaw : []);
            if (Array.isArray(nextItems)) {
              allMapped = allMapped.concat(nextItems.map(mapItem));
            }
          } catch {
            break;
          }
        }
      }

      return {
        items: allMapped,
        total,
        page: 1,
        size: requestedSize,
        totalPages: 1,
      };
    } catch (error: any) {
      throw new Error(formatApiError(error, "Katalog buku gagal dimuat."));
    }
  }

  // Request normal (size <= 100)
  try {
    const response = await api.get("/catalog/books", {
      params: {
        page,
        size: requestedSize,
        sortby: params?.sortby ?? undefined,
        order: params?.order ?? "asc",
      },
    });

    const raw = response.data;
    const items = raw?.items || raw?.data || (Array.isArray(raw) ? raw : []);
    const mappedBooks = Array.isArray(items) ? items.map(mapItem) : [];

    let total = typeof raw?.total === "number" && raw.total >= 0 ? raw.total : -1;
    if (total > 0) {
      lastKnownBooksTotal = total;
    } else if (lastKnownBooksTotal > 0) {
      total = lastKnownBooksTotal;
    } else {
      if (mappedBooks.length < requestedSize) {
        total = (page - 1) * requestedSize + mappedBooks.length;
        lastKnownBooksTotal = total;
      } else {
        total = page * requestedSize + 1;
      }
    }

    if (mappedBooks.length < requestedSize && total > (page - 1) * requestedSize + mappedBooks.length) {
      total = (page - 1) * requestedSize + mappedBooks.length;
      lastKnownBooksTotal = total;
    }

    const totalPages = Math.max(1, Math.ceil(total / requestedSize));

    return {
      items: mappedBooks,
      total,
      page,
      size: requestedSize,
      totalPages,
    };
  } catch (error: any) {
    throw new Error(formatApiError(error, "Katalog buku gagal dimuat."));
  }
}

export const getBooksPaginatedApi = getBooksApi;

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

export async function createBookApi(
  data: CreateBookInputData,
  companyId?: string
): Promise<Book> {
  const currentYear = new Date().getFullYear();
  const bookCode = data.code.trim().toUpperCase();
  const totalCopies = Number(data.totalCopies) || 1;

  const payload: Record<string, any> = {
    code: bookCode,
    title: data.title.trim(),
    isbn: data.isbn?.trim() || "-",
    author: data.author?.trim() || "-",
    publisher: data.publisher?.trim() || "-",
    category: data.category?.trim() || "-",
    published_year:
      data.publicationYear && !Number.isNaN(Number(data.publicationYear))
        ? Number(data.publicationYear)
        : currentYear,
  };

  try {
    const compId = resolveCompanyId(companyId);
    const isSuperAdmin = getAuthData()?.user?.role === "SUPER_ADMIN";
    const endpoint =
      isSuperAdmin && compId ? "/office/catalog/books" : "/catalog/books";
    const params = isSuperAdmin && compId ? { company_id: compId } : undefined;

    const response = await api.post(endpoint, payload, { params });

    const raw = response.data?.book || response.data?.data || response.data;
    const bookId = raw?._id || raw?.id;
    const finalCode = raw?.code || bookCode;

    const createdBook: Book = {
      id: bookId || `book-${Date.now()}`,
      companyId: raw?.company_id || raw?.companyId || compId || "",
      code: finalCode,
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
      createdAt: raw?.created_at || "",
      updatedAt: raw?.updated_at || raw?.created_at || "",
    };

    // Auto-create initial book copies sesuai OpenAPI (POST array of BookCopyCreateRequest)
    if (bookId && totalCopies > 0) {
      try {
        const copiesPayload = Array.from({ length: totalCopies }, (_, index) => ({
          copy_code: `${finalCode}-cp-${index + 1}`,
          location: "-",
          status: "AVAILABLE",
        }));

        const copyEndpoint =
          isSuperAdmin && compId
            ? `/office/catalog/books/${bookId}/copies`
            : `/catalog/books/${bookId}/copies`;

        await api.post(copyEndpoint, copiesPayload, { params });
      } catch (copyErr) {
        throw new Error(
          `Buku berhasil dibuat, namun gagal menginisialisasi salinan buku: ${formatApiError(copyErr, "Gagal membuat salinan.")}`
        );
      }
    }

    return createdBook;
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Gagal membuat buku baru.")
    );
  }
}

export async function searchBooksApi(keyword: string = ""): Promise<Book[]> {
  const cleanQuery = keyword.trim();

  if (cleanQuery.length === 0) {
    const res = await getBooksApi({ size: 10 });
    return res.items;
  }

  try {
    const response = await api.get("/catalog/books/search", {
      params: { q: cleanQuery },
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

      const cleanIsbn = item.isbn && item.isbn !== "-" && item.isbn.trim() !== "" ? item.isbn.trim() : undefined;
      const cleanAuthor = item.author && item.author !== "-" && item.author.trim() !== "" ? item.author.trim() : undefined;
      const cleanPublisher = item.publisher && item.publisher !== "-" && item.publisher.trim() !== "" ? item.publisher.trim() : undefined;
      const cleanCategory = item.category && item.category !== "-" && item.category.trim() !== "" ? item.category.trim() : undefined;

      return {
        id: item._id || item.id || "",
        companyId: item.company_id || item.companyId || "",
        code: item.code || "-",
        isbn: cleanIsbn,
        title: item.title || "-",
        author: cleanAuthor,
        publisher: cleanPublisher,
        publicationYear:
          item.published_year ||
          item.publication_year ||
          item.publicationYear ||
          undefined,
        category: cleanCategory,
        coverUrl: item.cover_url || item.coverUrl || undefined,
        status: parseBookStatus(item.status, totalCopies, availableCopies),
        totalCopies,
        availableCopies,
        createdAt: item.created_at || "",
        updatedAt: item.updated_at || item.created_at || "",
      };
    });
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 422) {
      return [];
    }
    throw new Error(
      formatApiError(error, "Pencarian buku gagal diproses.")
    );
  }
}

export async function getBookApi(
  bookId: string,
  companyId?: string
): Promise<Book | null> {
  try {
    const compId = resolveCompanyId(companyId);
    const isSuperAdmin = getAuthData()?.user?.role === "SUPER_ADMIN";
    const endpoint =
      isSuperAdmin && compId
        ? `/office/catalog/books/${bookId}`
        : `/catalog/books/${bookId}`;
    const params = isSuperAdmin && compId ? { company_id: compId } : undefined;

    let response: any;
    try {
      response = await api.get(endpoint, { params });
    } catch (err: any) {
      if (isSuperAdmin && compId) {
        response = await api.get(`/catalog/books/${bookId}`);
      } else {
        throw err;
      }
    }

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

    const cleanIsbn = item.isbn && item.isbn !== "-" && item.isbn.trim() !== "" ? item.isbn.trim() : undefined;
    const cleanAuthor = item.author && item.author !== "-" && item.author.trim() !== "" ? item.author.trim() : undefined;
    const cleanPublisher = item.publisher && item.publisher !== "-" && item.publisher.trim() !== "" ? item.publisher.trim() : undefined;
    const cleanCategory = item.category && item.category !== "-" && item.category.trim() !== "" ? item.category.trim() : undefined;

    return {
      id: item._id || item.id || bookId,
      companyId: item.company_id || item.companyId || compId || "",
      code: item.code || "-",
      isbn: cleanIsbn,
      title: item.title || "-",
      author: cleanAuthor,
      publisher: cleanPublisher,
      publicationYear:
        item.published_year ||
        item.publication_year ||
        item.publicationYear ||
        undefined,
      category: cleanCategory,
      coverUrl: item.cover_url || item.coverUrl || undefined,
      status: parseBookStatus(item.status, totalCopies, availableCopies),
      totalCopies,
      availableCopies,
      createdAt: item.created_at || "",
      updatedAt: item.updated_at || item.created_at || "",
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw new Error(
      formatApiError(error, "Detail buku gagal dimuat.")
    );
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
  data: UpdateBookInputData,
  companyId?: string
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
    const compId = resolveCompanyId(companyId);
    const isSuperAdmin = getAuthData()?.user?.role === "SUPER_ADMIN";
    const endpoint =
      isSuperAdmin && compId
        ? `/office/catalog/books/${bookId}`
        : `/catalog/books/${bookId}`;
    const params = isSuperAdmin && compId ? { company_id: compId } : undefined;

    const response = await api.patch(endpoint, payload, { params });

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
      companyId: item.company_id || item.companyId || compId || "",
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
      createdAt: item.created_at || "",
      updatedAt: item.updated_at || item.created_at || "",
    };
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Gagal memperbarui buku.")
    );
  }
}

export async function deleteBookApi(
  bookId: string,
  companyId?: string
): Promise<{ id: string; status?: string }> {
  try {
    const compId = resolveCompanyId(companyId);
    const isSuperAdmin = getAuthData()?.user?.role === "SUPER_ADMIN";
    const endpoint =
      isSuperAdmin && compId
        ? `/office/catalog/books/${bookId}`
        : `/catalog/books/${bookId}`;
    const params = isSuperAdmin && compId ? { company_id: compId } : undefined;

    const response = await api.delete(endpoint, { params });
    return response.data;
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Gagal menghapus buku.")
    );
  }
}

export async function changeBookStatusApi(
  bookId: string,
  status: BookStatus,
  companyId?: string
): Promise<Book> {
  // Aturan Bisnis PRD: Buku tidak boleh diarsipkan jika ada copy yang sedang dipinjam
  if (status === "INACTIVE") {
    try {
      const copies = await getBookCopiesApi(bookId, companyId);
      const borrowedCopies = copies.filter((c) => c.status === "BORROWED");
      if (borrowedCopies.length > 0) {
        throw new Error(
          "Buku tidak dapat diarsipkan karena masih memiliki eksemplar yang sedang dipinjam."
        );
      }
    } catch (e: any) {
      if (e.message?.includes("masih memiliki eksemplar yang sedang dipinjam")) {
        throw e;
      }
    }
  }

  // Gunakan PATCH /catalog/books/{bookId} atau /office/catalog/books/{bookId} agar copies buku tetap utuh
  return updateBookApi(bookId, { status }, companyId);
}

export async function getBookCopiesApi(
  bookId: string,
  companyId?: string
): Promise<BookCopy[]> {
  const compId = resolveCompanyId(companyId);

  try {
    const auth = typeof window !== "undefined" ? getAuthData() : null;
    const isSuperAdmin = auth?.user?.role === "SUPER_ADMIN";
    let response;

    if (companyId || isSuperAdmin) {
      try {
        response = await api.get(`/office/catalog/books/${bookId}/copies`, {
          params: { company_id: compId },
        });
      } catch {
        response = await api.get(`/catalog/books/${bookId}/copies`);
      }
    } else {
      response = await api.get(`/catalog/books/${bookId}/copies`);
    }

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

    const mapped: BookCopy[] = items.map((item: any) => ({
      id: item._id || item.id || "",
      companyId: item.company_id || item.companyId || compId,
      bookId: item.book_id || item.bookId || bookId,
      code: item.copy_code || item.code || "-",
      status: (item.status as BookCopyStatus) || "AVAILABLE",
      createdAt: item.created_at || "",
      updatedAt: item.updated_at || item.created_at || "",
    }));

    // Deduplikasi copy buku berdasarkan code:
    // Mencegah munculnya duplikat baris copy jika di database terdapat record lama (INACTIVE)
    // dan record baru yang diaktifkan kembali (AVAILABLE/LOST/BORROWED).
    const copyMap = new Map<string, BookCopy>();
    for (const copy of mapped) {
      const existing = copyMap.get(copy.code);
      if (!existing) {
        copyMap.set(copy.code, copy);
      } else {
        // Jika copy tersimpan INACTIVE dan copy ini bukan INACTIVE, ganti dengan yang aktif
        if (existing.status === "INACTIVE" && copy.status !== "INACTIVE") {
          copyMap.set(copy.code, copy);
        } else if (existing.status !== "INACTIVE" && copy.status === "INACTIVE") {
          // Tetap pertahankan copy yang aktif
          continue;
        } else {
          // Jika sama statusnya, ambil yang paling baru
          const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
          const newTime = new Date(copy.updatedAt || copy.createdAt).getTime();
          if (newTime >= existingTime) {
            copyMap.set(copy.code, copy);
          }
        }
      }
    }

    return Array.from(copyMap.values());
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Daftar eksemplar buku gagal dimuat.")
    );
  }
}

export async function createBookCopiesBulkApi(
  bookId: string,
  count: number = 1,
  companyId?: string
): Promise<BookCopy[]> {
  const compId = resolveCompanyId(companyId);
  const isSuperAdmin = getAuthData()?.user?.role === "SUPER_ADMIN";

  let existingCopies: BookCopy[] = [];
  try {
    existingCopies = await getBookCopiesApi(bookId, compId);
  } catch (err: unknown) {
    throw new Error(formatApiError(err, "Gagal memeriksa salinan buku yang sudah ada."));
  }
  
  let maxNumber = 0;
  for (const c of existingCopies) {
    const match = c.code.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }
  const startingNumber = Math.max(existingCopies.length, maxNumber);

  const book = await getBookApi(bookId, compId);
  if (!book?.code) {
    throw new Error("Data buku tidak ditemukan atau kode buku tidak valid.");
  }
  const bookCode = book.code;

  const countToAdd = Math.max(1, count);
  const copiesPayload = Array.from({ length: countToAdd }, (_, idx) => {
    const num = startingNumber + idx + 1;
    return {
      copy_code: `${bookCode}-cp-${num}`,
      location: "-",
      status: "AVAILABLE",
    };
  });

  try {
    const endpoint =
      isSuperAdmin && compId
        ? `/office/catalog/books/${bookId}/copies`
        : `/catalog/books/${bookId}/copies`;
    const params = isSuperAdmin && compId ? { company_id: compId } : undefined;

    let response: any;
    try {
      response = await api.post(endpoint, copiesPayload, { params });
    } catch (arrErr: any) {
      if (arrErr.response?.status === 422) {
        response = await api.post(endpoint, copiesPayload[0], { params });
      } else {
        throw arrErr;
      }
    }

    const rawData =
      response.data?.copies ||
      response.data?.data ||
      response.data?.items ||
      response.data;

    let items: any[] = [];
    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData && typeof rawData === "object") {
      items = [rawData];
    } else {
      items = copiesPayload;
    }

    return items.map((item: any, idx: number) => ({
      id: item?._id || item?.id || "",
      companyId: item?.company_id || item?.companyId || compId,
      bookId: item?.book_id || item?.bookId || bookId,
      code: item?.copy_code || item?.code || copiesPayload[idx]?.copy_code || "-",
      status: (item?.status as BookCopyStatus) || "AVAILABLE",
      createdAt: item?.created_at || "",
      updatedAt: item?.updated_at || item?.created_at || "",
    }));
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Gagal membuat eksemplar buku.")
    );
  }
}

export async function createBookCopyApi(
  bookId: string,
  copyCode?: string,
  companyId?: string
): Promise<BookCopy> {
  const created = await createBookCopiesBulkApi(bookId, 1, companyId);
  return created[0];
}

export async function deleteBookCopyApi(
  bookId: string,
  copyId: string,
  companyId?: string
): Promise<{ id: string; status?: string }> {
  try {
    const compId = resolveCompanyId(companyId);
    const isSuperAdmin = getAuthData()?.user?.role === "SUPER_ADMIN";
    const endpoint =
      isSuperAdmin && compId
        ? `/office/catalog/books/${bookId}/copies/${copyId}`
        : `/catalog/books/${bookId}/copies/${copyId}`;
    const params = isSuperAdmin && compId ? { company_id: compId } : undefined;

    const response = await api.delete(endpoint, { params });
    return response.data;
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Gagal menghapus eksemplar buku.")
    );
  }
}

export async function changeBookCopyStatusApi(
  bookId: string,
  copyId: string,
  status: BookCopyStatus,
  companyId?: string
): Promise<BookCopy> {
  const compId = resolveCompanyId(companyId);
  const isSuperAdmin = getAuthData()?.user?.role === "SUPER_ADMIN";

  // Aturan Bisnis PRD: Copy yang sedang BORROWED tidak boleh diubah statusnya ke arsip/nonaktif
  let targetCopy: BookCopy | undefined;
  try {
    const copies = await getBookCopiesApi(bookId, compId);
    targetCopy = copies.find((c) => c.id === copyId);
    if (targetCopy && targetCopy.status === "BORROWED") {
      throw new Error("Eksemplar yang sedang dipinjam tidak dapat diubah statusnya.");
    }
  } catch (e: any) {
    if (e.message?.includes("sedang dipinjam")) {
      throw e;
    }
  }

  // 1. KASUS INACTIVE (Tidak Aktif / Tidak Tersedia):
  // Di Backend, soft-delete / menonaktifkan copy dilakukan melalui endpoint DELETE /catalog/books/{bookId}/copies/{copyId}.
  if (status === "INACTIVE") {
    try {
      await deleteBookCopyApi(bookId, copyId, compId);
      return {
        id: copyId,
        companyId: targetCopy?.companyId || compId || "",
        bookId,
        code: targetCopy?.code || "-",
        status: "INACTIVE",
        createdAt: targetCopy?.createdAt || "",
        updatedAt: targetCopy?.updatedAt || "",
      };
    } catch (error: any) {
      throw new Error(
        formatApiError(error, "Gagal menonaktifkan eksemplar buku.")
      );
    }
  }

  // 2. KASUS MENGAKTIFKAN KEMBALI COPY YANG INACTIVE (Menjadi Tersedia atau Hilang):
  if (targetCopy?.status === "INACTIVE" && targetCopy?.code) {
    try {
      const payload = [
        {
          copy_code: targetCopy.code,
          location: "-",
          status: status,
        },
      ];
      const endpoint =
        isSuperAdmin && compId
          ? `/office/catalog/books/${bookId}/copies`
          : `/catalog/books/${bookId}/copies`;
      const params = isSuperAdmin && compId ? { company_id: compId } : undefined;

      let postRes: any;
      try {
        postRes = await api.post(endpoint, payload, { params });
      } catch (arrErr: any) {
        if (arrErr.response?.status === 422) {
          postRes = await api.post(endpoint, payload[0], { params });
        } else {
          throw arrErr;
        }
      }
      const raw =
        postRes.data?.items ||
        postRes.data?.copies ||
        postRes.data?.data ||
        postRes.data;
      const item = Array.isArray(raw) ? raw[0] : (raw?.item || raw);
      return {
        id: item?._id || item?.id || copyId,
        companyId: item?.company_id || item?.companyId || targetCopy.companyId || compId || "",
        bookId,
        code: item?.copy_code || item?.code || targetCopy.code,
        status: (item?.status as BookCopyStatus) || status,
        createdAt: item?.created_at || "",
        updatedAt: item?.updated_at || item?.created_at || "",
      };
    } catch (postErr: any) {
      throw new Error(
        formatApiError(postErr, "Gagal mengaktifkan eksemplar buku.")
      );
    }
  }

  // 3. KASUS COPY AKTIF (Ubah antara AVAILABLE <-> LOST):
  try {
    const endpoint =
      isSuperAdmin && compId
        ? `/office/catalog/books/${bookId}/copies/${copyId}`
        : `/catalog/books/${bookId}/copies/${copyId}`;
    const params = isSuperAdmin && compId ? { company_id: compId } : undefined;

    const response = await api.patch(
      endpoint,
      {
        status,
      },
      { params }
    );

    const item = response.data;
    return {
      id: item._id || item.id || copyId,
      companyId: item.company_id || item.companyId || compId || "",
      bookId: item.book_id || item.bookId || bookId,
      code: item.copy_code || item.code || targetCopy?.code || "-",
      status: (item.status as BookCopyStatus) || status,
      createdAt: item.created_at || "",
      updatedAt: item.updated_at || item.created_at || "",
    };
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Gagal mengubah status eksemplar buku.")
    );
  }
}

export interface DashboardApiResponse {
  booksAvailable?: number | null;
  booksBorrowed?: number | null;
  activeLoans?: number | null;
  overdueLoans?: number | null;
  recentLoans: Array<Loan & { memberName: string }>;
  rawResponse?: Record<string, any>;
}

export async function getDashboardApi(): Promise<DashboardApiResponse> {
  try {
    const [dashRes, loansRes] = await Promise.all([
      api.get("/dashboard"),
      listLoansApi({ page: 1, size: 10, sortby: "updated_at", order: "desc" }),
    ]);

    const items = dashRes.data?.items || dashRes.data?.data || dashRes.data || {};
    const rawBooksAvail = items.books_available ?? items.booksAvailable;
    const rawActiveLoans = items.active_loans ?? items.activeLoans;
    const rawOverdueLoans = items.overdue_loans ?? items.overdueLoans;

    const booksAvailable = rawBooksAvail !== undefined && rawBooksAvail !== null ? Number(rawBooksAvail) : null;
    const activeLoans = rawActiveLoans !== undefined && rawActiveLoans !== null ? Number(rawActiveLoans) : null;
    const overdueLoans = rawOverdueLoans !== undefined && rawOverdueLoans !== null ? Number(rawOverdueLoans) : null;

    const rawLoans = loansRes?.items || [];
    const sortedLoans = [...rawLoans].sort((a, b) => {
      const getLatestTime = (tx: TransactionData) => {
        const l = tx.loan;
        const times = [
          l.updatedAt ? new Date(l.updatedAt).getTime() : 0,
          l.returnedAt ? new Date(l.returnedAt).getTime() : 0,
          l.createdAt ? new Date(l.createdAt).getTime() : 0,
          l.borrowedAt ? new Date(l.borrowedAt).getTime() : 0,
        ].filter((t) => !Number.isNaN(t) && t > 0);

        return times.length > 0 ? Math.max(...times) : 0;
      };

      return getLatestTime(b) - getLatestTime(a);
    });

    const recentLoans = sortedLoans
      .map((tx) => ({
        ...tx.loan,
        memberName: tx.member?.name || "-",
      }))
      .slice(0, 10);

    return {
      booksAvailable,
      booksBorrowed: null,
      activeLoans,
      overdueLoans,
      recentLoans,
      rawResponse: dashRes.data,
    };
  } catch (error: any) {
    throw new Error(
      formatApiError(error, "Dashboard gagal dimuat.")
    );
  }
}

export interface OfficeDashboardData {
  companyId: string;
  booksAvailable?: number | null;
  activeLoans?: number | null;
  overdueLoans?: number | null;
  rawResponse?: Record<string, any>;
}

export async function getOfficeDashboardApi(companyId: string): Promise<OfficeDashboardData> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  try {
    const response = await api.get("/office/dashboard", {
      params: { company_id: compId },
    });
    const items = response.data?.items || response.data?.data || response.data || {};
    const rawBooksAvail = items.books_available ?? items.booksAvailable;
    const rawActiveLoans = items.active_loans ?? items.activeLoans;
    const rawOverdueLoans = items.overdue_loans ?? items.overdueLoans;

    const booksAvailable = rawBooksAvail !== undefined && rawBooksAvail !== null ? Number(rawBooksAvail) : null;
    const activeLoans = rawActiveLoans !== undefined && rawActiveLoans !== null ? Number(rawActiveLoans) : null;
    const overdueLoans = rawOverdueLoans !== undefined && rawOverdueLoans !== null ? Number(rawOverdueLoans) : null;

    return {
      companyId: compId,
      booksAvailable,
      activeLoans,
      overdueLoans,
      rawResponse: response.data,
    };
  } catch (err: any) {
    throw new Error(formatApiError(err, "Office dashboard gagal dimuat dari server."));
  }
}

export function formatCleanLoanNumber(raw: any): string {
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

  const rawId = String(raw.id || raw.loan_id || raw._id || candidate || "");
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

  return candidate || "-";
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
    "";

  const rawCreatedAt =
    raw.created_at ||
    raw.createdAt ||
    raw.loan?.created_at ||
    raw.borrowed_at ||
    raw.borrowedAt ||
    raw.loan?.borrowed_at ||
    "";

  const rawUpdatedAt =
    raw.updated_at ||
    raw.updatedAt ||
    raw.loan?.updated_at ||
    raw.returned_at ||
    raw.returnedAt ||
    raw.loan?.returned_at ||
    rawCreatedAt;

  const dueAtValue =
    raw.due_at ||
    raw.dueAt ||
    raw.loan?.due_at ||
    "";

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const parsedDueDate = dueAtValue ? new Date(`${dueAtValue.slice(0, 10)}T00:00:00`) : new Date(NaN);
  const isOverdueRealtime =
    !Number.isNaN(parsedDueDate.getTime()) && parsedDueDate.getTime() < todayDate.getTime();

  const isLoanCompleted =
    raw.status === "COMPLETED" ||
    raw.loan?.status === "COMPLETED" ||
    raw.returned_at ||
    raw.returnedAt ||
    raw.loan?.returned_at;

  const computedLoanStatus: Loan["status"] = isLoanCompleted
    ? "COMPLETED"
    : raw.status === "OVERDUE" || raw.loan?.status === "OVERDUE" || isOverdueRealtime
    ? "OVERDUE"
    : (raw.status || raw.loan?.status || "ACTIVE");

  const loan: Loan = {
    id: loanId,
    companyId: raw.company_id || raw.companyId || "",
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
      rawCreatedAt,
    dueAt: dueAtValue,
    returnedAt:
      raw.returned_at ||
      raw.returnedAt ||
      raw.loan?.returned_at ||
      undefined,
    status: computedLoanStatus,
    notes: raw.notes || undefined,
    createdAt: rawCreatedAt,
    updatedAt: rawUpdatedAt,
  };

  const member: Member = raw.member
    ? {
        id: raw.member._id || raw.member.id || loan.memberId,
        companyId:
          raw.member.company_id || raw.member.companyId || loan.companyId,
        memberNumber:
          raw.member.member_number || raw.member.memberNumber || "-",
        name: raw.member.name || raw.member_name || raw.memberName || "-",
        memberType:
          raw.member.member_type || raw.member.memberType || "UMUM",
        identityNumber:
          raw.member.identity_number ||
          raw.member.identityNumber ||
          "-",
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
        memberNumber: raw.member_number || raw.memberNumber || "-",
        name: raw.member_name || raw.memberName || "-",
        memberType: "UMUM",
        identityNumber: raw.identity_number || raw.identityNumber || "-",
        phone: "-",
        status: "ACTIVE",
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt,
      };

  const user = raw.user
    ? {
        id: raw.user._id || raw.user.id || loan.borrowedBy,
        companyId: raw.user.company_id || raw.user.companyId || loan.companyId,
        name: raw.user.name || raw.user_name || raw.userName || "-",
        username: raw.user.username || raw.user.user_name || (raw.user.name ? raw.user.name.toLowerCase().replace(/\s+/g, "") : "-"),
        email: raw.user.email || raw.user_email || "-",
        role: raw.user.role || "STAFF",
        status: raw.user.status || "ACTIVE",
        createdAt: raw.user.created_at || raw.user.createdAt || loan.createdAt,
        updatedAt: raw.user.updated_at || raw.user.updatedAt || loan.updatedAt,
      }
    : {
        id: loan.borrowedBy,
        companyId: loan.companyId,
        name: raw.user_name || raw.userName || "-",
        username: (raw.user_name || raw.userName || "-").toLowerCase().replace(/\s+/g, ""),
        email: raw.user_email || raw.email || "-",
        role: "STAFF" as const,
        status: "ACTIVE" as const,
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt,
      };

  const rawItemList =
    (Array.isArray(raw.items) && raw.items.length > 0 && raw.items) ||
    (Array.isArray(raw.loan_items) && raw.loan_items.length > 0 && raw.loan_items) ||
    (Array.isArray(raw.loan?.items) && raw.loan.items.length > 0 && raw.loan.items) ||
    (Array.isArray(raw.loan?.loan_items) && raw.loan.loan_items.length > 0 && raw.loan.loan_items) ||
    (Array.isArray(raw.details) && raw.details.length > 0 && raw.details) ||
    null;

  let items: TransactionData["items"] = [];

  if (rawItemList && rawItemList.length > 0) {
    items = rawItemList.map((rawItem: any, idx: number) => {
      const isObject = rawItem && typeof rawItem === "object";
      const itemCopyId = isObject
        ? rawItem.book_copy_id ||
          rawItem.bookCopyId ||
          rawItem.copy_id ||
          rawItem.copyId ||
          rawItem.book_copy?._id ||
          rawItem.book_copy?.id ||
          rawItem.bookCopy?._id ||
          rawItem.bookCopy?.id ||
          rawItem.copy?._id ||
          rawItem.copy?.id ||
          rawItem._id ||
          rawItem.id ||
          `copy-${loan.id}-${idx}`
        : String(rawItem);

      const itemBookId = isObject
        ? rawItem.book_id ||
          rawItem.bookId ||
          rawItem.book?._id ||
          rawItem.book?.id ||
          raw.book_id ||
          raw.bookId ||
          `book-${loan.id}`
        : raw.book_id || raw.bookId || `book-${loan.id}`;

      const itemBookTitle = isObject
        ? rawItem.book_title ||
          rawItem.bookTitle ||
          rawItem.book?.title ||
          rawItem.title ||
          raw.book_title ||
          raw.bookTitle ||
          "-"
        : raw.book_title || raw.bookTitle || "-";

      const itemBookCode = isObject
        ? rawItem.book_code ||
          rawItem.bookCode ||
          rawItem.book?.code ||
          rawItem.code ||
          raw.book_code ||
          raw.bookCode ||
          "-"
        : raw.book_code || raw.bookCode || "-";

      const itemCopyCode = isObject
        ? rawItem.copy_code ||
          rawItem.copyCode ||
          rawItem.book_copy?.code ||
          rawItem.copy?.code ||
          raw.copy_code ||
          raw.copyCode ||
          "-"
        : raw.copy_code || raw.copyCode || "-";

      const rawReturnedAt = isObject
        ? rawItem.returned_at ||
          rawItem.returnedAt ||
          rawItem.return_date ||
          rawItem.returnDate
        : null;

      const isItemReturned =
        (isObject &&
          (rawItem.status === "RETURNED" ||
            rawItem.status === "COMPLETED" ||
            rawItem.status === "RETURN" ||
            rawItem.is_returned === true ||
            rawItem.isReturned === true ||
            Boolean(rawReturnedAt))) ||
        loan.status === "COMPLETED" ||
        Boolean(loan.returnedAt);

      const itemStatus: "RETURNED" | "BORROWED" = isItemReturned
        ? "RETURNED"
        : "BORROWED";

      const itemReturnedAt = isItemReturned
        ? rawReturnedAt ||
          loan.returnedAt ||
          rawItem?.updated_at ||
          rawItem?.updatedAt ||
          loan.updatedAt ||
          undefined
        : undefined;

      const itemId = isObject
        ? rawItem._id ||
          rawItem.id ||
          rawItem.loan_item_id ||
          rawItem.loanItemId ||
          `loan-item-${loan.id}-${idx}`
        : `loan-item-${loan.id}-${idx}`;

      return {
        loanItem: {
          id: itemId,
          companyId: loan.companyId,
          loanId: loan.id,
          bookId: itemBookId,
          bookCopyId: itemCopyId,
          returnedAt: itemReturnedAt,
          status: itemStatus,
          createdAt: isObject
            ? rawItem.created_at || rawItem.createdAt || loan.createdAt
            : loan.createdAt,
          updatedAt: isObject
            ? rawItem.updated_at || rawItem.updatedAt || loan.updatedAt
            : loan.updatedAt,
        },
        book: {
          id: itemBookId,
          companyId: loan.companyId,
          code: itemBookCode,
          title: itemBookTitle,
          status: "AVAILABLE" as const,
          totalCopies: 1,
          availableCopies: 1,
          createdAt: loan.createdAt,
          updatedAt: loan.updatedAt,
        },
        bookCopy: {
          id: itemCopyId,
          companyId: loan.companyId,
          bookId: itemBookId,
          code: itemCopyCode,
          status: isItemReturned
            ? ("AVAILABLE" as const)
            : ("BORROWED" as const),
          createdAt: loan.createdAt,
          updatedAt: loan.updatedAt,
        },
      };
    });
  } else {
    const rawCopyIds = extractCopyIdsFromRaw(raw);
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
          code: raw.book_code || raw.bookCode || "-",
          title: raw.book_title || raw.bookTitle || "-",
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
          code: raw.copy_code || raw.copyCode || "-",
          status:
            loan.status === "COMPLETED"
              ? ("AVAILABLE" as const)
              : ("BORROWED" as const),
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
            code: raw.book_code || raw.bookCode || "-",
            title: raw.book_title || raw.bookTitle || "-",
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
            code: raw.copy_code || raw.copyCode || "-",
            status:
              loan.status === "COMPLETED"
                ? ("AVAILABLE" as const)
                : ("BORROWED" as const),
            createdAt: loan.createdAt,
            updatedAt: loan.updatedAt,
          },
        },
      ];
    }
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
  if (!dateStr) return "";
  if (dateStr.includes("T")) {
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }
  const timePart = isEndOfDay ? "T23:59:59.000Z" : "T00:00:00.000Z";
  const d = new Date(`${dateStr}${timePart}`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
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
        id: raw._id || raw.id || "",
        companyId: raw.company_id || raw.companyId || resolveCompanyId() || "",
        loanNumber: formatCleanLoanNumber(raw),
        memberId: raw.member_id || raw.memberId || data.memberId,
        borrowedBy: raw.borrowed_by || raw.borrowedBy || "-",
        borrowedAt: raw.borrowed_at || raw.borrowedAt || payload.borrowed_at,
        dueAt: raw.due_at || raw.dueAt || payload.due_at,
        returnedAt: raw.returned_at || raw.returnedAt || undefined,
        status: (raw.status as Loan["status"]) || "ACTIVE",
        notes: raw.notes || undefined,
        createdAt: raw.created_at || raw.createdAt || "",
        updatedAt: raw.updated_at || raw.updatedAt || "",
      };
    }

    throw new Error("Format respons pembuatan peminjaman tidak valid.");
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal membuat data peminjaman."));
  }
}

async function enrichTransactions(
  transactions: TransactionData[],
  size?: number
): Promise<TransactionData[]> {
  try {
    const fetchSize = size ? Math.min(size, 20) : Math.min(Math.max(10, transactions.length), 20);
    // Best-effort data augmentation: Jika gagal memuat metadata tambahan anggota atau katalog,
    // transaksi peminjaman tetap ditampilkan ke pengguna menggunakan data dasar/ID pada record transaksi.
    const [members, booksRes] = await Promise.all([
      getMembersApi(fetchSize ? { size: fetchSize } : undefined).catch((err) => {
        console.warn("Gagal memuat metadata anggota untuk enrichment transaksi:", err);
        return [];
      }),
      getBooksApi(fetchSize ? { size: fetchSize } : undefined).catch((err) => {
        console.warn("Gagal memuat katalog buku untuk enrichment transaksi:", err);
        return { items: [] as Book[], total: 0, page: 1, size: 10, totalPages: 1 };
      }),
    ]);

    const books: Book[] = Array.isArray(booksRes) ? booksRes : (booksRes?.items || []);

    // Fast multi-key member map (id, lowercase id, memberNumber, code)
    const memberMap = new Map<string, Member>();
    for (const m of members) {
      if (m.id) {
        memberMap.set(m.id, m);
        memberMap.set(m.id.toLowerCase(), m);
      }
      if (m.memberNumber) {
        memberMap.set(m.memberNumber, m);
        memberMap.set(m.memberNumber.toLowerCase(), m);
      }
      if ((m as any).code) {
        memberMap.set((m as any).code, m);
        memberMap.set((m as any).code.toLowerCase(), m);
      }
    }

    // Fast multi-key book map (id, lowercase id, code, uppercase code, isbn)
    const bookMap = new Map<string, Book>();
    for (const b of books) {
      if (b.id) {
        bookMap.set(b.id, b);
        bookMap.set(b.id.toLowerCase(), b);
      }
      if (b.code) {
        bookMap.set(b.code, b);
        bookMap.set(b.code.toUpperCase(), b);
      }
      if (b.isbn) {
        bookMap.set(b.isbn, b);
        bookMap.set(b.isbn.replace(/[^A-Za-z0-9]/g, ""), b);
      }
    }

    // Determine relevant books needing copies or fetch catalog books concurrently
    const neededBookIds = new Set<string>();
    for (const tx of transactions) {
      for (const it of tx.items) {
        if (it.loanItem?.bookId && !it.loanItem.bookId.startsWith("book-")) {
          neededBookIds.add(it.loanItem.bookId);
        }
        if (it.book?.id && !it.book.id.startsWith("book-")) {
          neededBookIds.add(it.book.id);
        }
      }
    }

    const matchingBooks = books.filter((b) => neededBookIds.has(b.id));
    const targetBooks = matchingBooks;

    // Fast multi-key copies map (id, code, uppercase code, barcode)
    const copiesMap = new Map<string, { book: Book; copy: BookCopy }>();
    await Promise.allSettled(
      targetBooks.map(async (b) => {
        try {
          const copies = await getBookCopiesApi(b.id);
          for (const c of copies) {
            if (c.id) {
              copiesMap.set(c.id, { book: b, copy: c });
              copiesMap.set(c.id.toLowerCase(), { book: b, copy: c });
            }
            if (c.code) {
              copiesMap.set(c.code, { book: b, copy: c });
              copiesMap.set(c.code.toUpperCase(), { book: b, copy: c });
              copiesMap.set(c.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase(), { book: b, copy: c });
            }
            if ((c as any).barcode) {
              copiesMap.set((c as any).barcode, { book: b, copy: c });
            }
          }
        } catch {
          // ignore error on single copy fetch
        }
      })
    );

    for (const tx of transactions) {
      // 1. Join Member Data
      if (
        !tx.member?.name ||
        tx.member.name === "Anggota" ||
        tx.member.name === "-"
      ) {
        const foundMember =
          memberMap.get(tx.loan.memberId) ||
          memberMap.get(tx.loan.memberId?.toLowerCase());
        if (foundMember) {
          tx.member = foundMember;
        }
      }

      // 2. Join Items, Copies & Books Data
      for (const it of tx.items) {
        const rawCode = it.bookCopy?.code || "";
        const cleanRawCode = rawCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

        const copyInfo =
          (it.loanItem?.bookCopyId && copiesMap.get(it.loanItem.bookCopyId)) ||
          (it.bookCopy?.id && copiesMap.get(it.bookCopy.id)) ||
          (rawCode && copiesMap.get(rawCode)) ||
          (rawCode && copiesMap.get(rawCode.toUpperCase())) ||
          (cleanRawCode && copiesMap.get(cleanRawCode));

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
              tx.loan.returnedAt || it.loanItem.returnedAt || undefined;
          }
        } else {
          // Lookup parent book by bookId or code
          const foundBook =
            (it.loanItem?.bookId && bookMap.get(it.loanItem.bookId)) ||
            (it.book?.id && bookMap.get(it.book.id)) ||
            (it.book?.code && bookMap.get(it.book.code.toUpperCase()));

          if (foundBook) {
            it.book = foundBook;
            it.loanItem.bookId = foundBook.id;
            it.bookCopy.bookId = foundBook.id;
          }
        }
      }

      // 3. Sync loan status if all items are returned
      const allReturned =
        tx.items.length > 0 &&
        tx.items.every((it) => it.loanItem.status === "RETURNED");

      if (allReturned || tx.loan.status === "COMPLETED" || tx.loan.returnedAt) {
        tx.loan.status = "COMPLETED";
      }
    }
  } catch (err) {
    console.warn("Gagal melakukan enrichment data transaksi:", err);
  }

  return sortTransactionsDesc(transactions);
}

export function sortTransactionsDesc(transactions: TransactionData[]): TransactionData[] {
  return [...transactions].sort((a, b) => {
    const getScore = (tx: TransactionData) => {
      const l = tx.loan;
      let time = 0;
      if (l.updatedAt) {
        const t = new Date(l.updatedAt).getTime();
        if (!Number.isNaN(t)) time = Math.max(time, t);
      }
      if (l.returnedAt) {
        const t = new Date(l.returnedAt).getTime();
        if (!Number.isNaN(t)) time = Math.max(time, t);
      }
      if (l.createdAt) {
        const t = new Date(l.createdAt).getTime();
        if (!Number.isNaN(t)) time = Math.max(time, t);
      }
      if (l.borrowedAt) {
        const t = new Date(l.borrowedAt).getTime();
        if (!Number.isNaN(t)) time = Math.max(time, t);
      }
      return time;
    };

    const scoreA = getScore(a);
    const scoreB = getScore(b);
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    return String(b.loan.id || "").localeCompare(String(a.loan.id || ""));
  });
}

export interface ListLoansParams {
  items?: number;
  page?: number;
  size?: number;
  search?: string;
  q?: string;
  status?: string | string[];
  startDate?: string;
  endDate?: string;
  borrowed_from?: string;
  borrowed_to?: string;
  due_from?: string;
  due_to?: string;
  returned_from?: string;
  returned_to?: string;
  loan_id?: string;
  member_id?: string;
  borrowed_by?: string;
  book_id?: string;
  copy_id?: string;
  sortby?: string;
  order?: "asc" | "desc" | string;
  companyId?: string;
  skipEnrich?: boolean;
}

export async function getMemberActiveLoanCountApi(memberId: string): Promise<number> {
  if (!memberId) return 0;
  try {
    const res = await listLoansApi({
      member_id: memberId,
      status: "ACTIVE",
      size: 10,
      skipEnrich: true,
    });
    const activeItems = res.items.filter(
      (tx) => tx.loan.status !== "COMPLETED" && !tx.loan.returnedAt
    );
    return typeof res.total === "number" && res.total >= 0 && activeItems.length >= res.items.length
      ? res.total
      : activeItems.length;
  } catch (err) {
    console.warn("Gagal menghitung transaksi aktif anggota:", err);
    return 0;
  }
}

export async function listLoansApi(
  params?: ListLoansParams
): Promise<{ items: TransactionData[]; total: number; page: number; size: number; totalPages: number }> {
  const page = params?.page ?? 1;
  const size = params?.size ?? 10;
  try {
    const queryParams: Record<string, any> = {
      page,
      size,
    };

    const rawSearch = (params?.q || params?.search || "").trim();
    const isOnlyTrxPrefix = /^trx[-_\s]*$/i.test(rawSearch);
    const isOnlyPunctuation = /^[-_\s]+$/.test(rawSearch);
    const cleanHexCandidate = rawSearch.replace(/^TRX[-_\s]*/i, "").trim();

    if (rawSearch && !isOnlyTrxPrefix && !isOnlyPunctuation) {
      if (/^[0-9a-fA-F]{24}$/.test(rawSearch)) {
        queryParams.loan_id = rawSearch;
      } else if (/^[0-9a-fA-F]{24}$/.test(cleanHexCandidate)) {
        queryParams.loan_id = cleanHexCandidate;
      } else if (cleanHexCandidate && cleanHexCandidate !== rawSearch) {
        queryParams.q = cleanHexCandidate;
      } else {
        queryParams.q = rawSearch;
      }
    }

    if (params?.status) {
      queryParams.status = Array.isArray(params.status) ? params.status : [params.status];
    }

    const compId = resolveCompanyId(params?.companyId);
    if (compId) queryParams.company_id = compId;

    const bFrom = params?.borrowed_from || params?.startDate;
    if (bFrom) queryParams.borrowed_from = bFrom.includes("T") ? bFrom : toIsoDateTime(bFrom, false);

    const bTo = params?.borrowed_to || params?.endDate;
    if (bTo) queryParams.borrowed_to = bTo.includes("T") ? bTo : toIsoDateTime(bTo, true);

    if (params?.due_from) queryParams.due_from = params.due_from.includes("T") ? params.due_from : toIsoDateTime(params.due_from, false);
    if (params?.due_to) queryParams.due_to = params.due_to.includes("T") ? params.due_to : toIsoDateTime(params.due_to, true);
    if (params?.returned_from) queryParams.returned_from = params.returned_from.includes("T") ? params.returned_from : toIsoDateTime(params.returned_from, false);
    if (params?.returned_to) queryParams.returned_to = params.returned_to.includes("T") ? params.returned_to : toIsoDateTime(params.returned_to, true);
    if (params?.loan_id) queryParams.loan_id = params.loan_id;
    if (params?.member_id) queryParams.member_id = params.member_id;
    if (params?.borrowed_by) queryParams.borrowed_by = params.borrowed_by;
    if (params?.book_id) queryParams.book_id = params.book_id;
    if (params?.copy_id) queryParams.copy_id = params.copy_id;
    if (params?.sortby) queryParams.sortby = params.sortby;
    if (params?.order) queryParams.order = params.order;

    const customParamsSerializer = (p: Record<string, any>) => {
      const sp = new URLSearchParams();
      for (const [key, value] of Object.entries(p)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          value.forEach((v) => sp.append(key, String(v)));
        } else {
          sp.append(key, String(value));
        }
      }
      return sp.toString();
    };

    const response = await api.get("/loan/search", {
      params: queryParams,
      paramsSerializer: customParamsSerializer,
    });

    const raw = response.data;
    let items = raw?.items || raw?.data || (Array.isArray(raw) ? raw : []);

    if (items.length > 0 && cleanHexCandidate && cleanHexCandidate !== rawSearch) {
      const candLower = cleanHexCandidate.toLowerCase();
      const queryLower = rawSearch.toLowerCase();
      const strictlyMatched = items.filter((rawLoan: any) => {
        const rawId = String(rawLoan.id || rawLoan._id || rawLoan.loan_id || "").toLowerCase();
        const formatted = formatCleanLoanNumber(rawLoan).toLowerCase();
        return (
          formatted.includes(candLower) ||
          formatted.includes(queryLower) ||
          rawId.endsWith(candLower) ||
          rawId.includes(candLower)
        );
      });
      if (strictlyMatched.length > 0) {
        items = strictlyMatched;
      }
    }

    if (
      items.length === 0 &&
      rawSearch &&
      !isOnlyTrxPrefix &&
      !isOnlyPunctuation
    ) {
      const fallbackParams = { ...queryParams };
      delete fallbackParams.q;
      fallbackParams.size = Math.min(Math.max(size, 20), 50);
      try {
        const fbRes = await api.get("/loan/search", {
          params: fallbackParams,
          paramsSerializer: customParamsSerializer,
        });
        const fbRaw = fbRes.data;
        const fbItems = fbRaw?.items || fbRaw?.data || (Array.isArray(fbRaw) ? fbRaw : []);
        if (Array.isArray(fbItems) && fbItems.length > 0) {
          const targetSuffix = cleanHexCandidate.toLowerCase();
          const targetFull = rawSearch.toLowerCase();
          const matched = fbItems.filter((rawLoan: any) => {
            const rawId = String(rawLoan.id || rawLoan._id || rawLoan.loan_id || "").toLowerCase();
            const formatted = formatCleanLoanNumber(rawLoan).toLowerCase();
            const borrower = String(rawLoan.borrowed_by || rawLoan.borrowedBy || rawLoan.member_name || "").toLowerCase();

            return (
              formatted === targetFull ||
              formatted.includes(targetFull) ||
              (targetSuffix && formatted.includes(targetSuffix)) ||
              (targetSuffix && rawId.endsWith(targetSuffix)) ||
              (targetSuffix && rawId.includes(targetSuffix)) ||
              (targetFull && borrower.includes(targetFull))
            );
          });
          if (matched.length > 0) {
            items = matched;
          }
        }
      } catch {
        // Abaikan jika fallback pencarian ID backend gagal
      }
    }

    let enriched: TransactionData[] = [];
    if (Array.isArray(items) && items.length > 0) {
      const mapped = items.map(mapRawToTransactionData);
      enriched = params?.skipEnrich ? mapped : await enrichTransactions(mapped, size);
    }

    if (params?.status) {
      const requestedStatuses = (
        Array.isArray(params.status) ? params.status : [params.status]
      ).map((s) => s.toUpperCase());

      enriched = enriched.filter((tx) => {
        if (requestedStatuses.includes("ACTIVE") && !requestedStatuses.includes("COMPLETED")) {
          return tx.loan.status !== "COMPLETED" && !tx.loan.returnedAt;
        }
        if (requestedStatuses.includes("COMPLETED")) {
          return tx.loan.status === "COMPLETED" || Boolean(tx.loan.returnedAt);
        }
        return requestedStatuses.includes(tx.loan.status);
      });
    }

    const filterFromDate = (params?.startDate || params?.borrowed_from || "").slice(0, 10);
    const filterToDate = (params?.endDate || params?.borrowed_to || "").slice(0, 10);
    const filterDueFrom = (params?.due_from || "").slice(0, 10);
    const filterDueTo = (params?.due_to || "").slice(0, 10);
    const filterRetFrom = (params?.returned_from || "").slice(0, 10);
    const filterRetTo = (params?.returned_to || "").slice(0, 10);

    if (filterFromDate || filterToDate || filterDueFrom || filterDueTo || filterRetFrom || filterRetTo) {
      enriched = enriched.filter((tx) => {
        const itemBorrowedDate = (tx.loan.borrowedAt || "").slice(0, 10);
        if (filterFromDate && itemBorrowedDate && itemBorrowedDate < filterFromDate) return false;
        if (filterToDate && itemBorrowedDate && itemBorrowedDate > filterToDate) return false;

        const itemDueDate = (tx.loan.dueAt || "").slice(0, 10);
        if (filterDueFrom && itemDueDate && itemDueDate < filterDueFrom) return false;
        if (filterDueTo && itemDueDate && itemDueDate > filterDueTo) return false;

        const itemRetDate = (tx.loan.returnedAt || "").slice(0, 10);
        if (filterRetFrom) {
          if (!itemRetDate || itemRetDate < filterRetFrom) return false;
        }
        if (filterRetTo) {
          if (!itemRetDate || itemRetDate > filterRetTo) return false;
        }

        return true;
      });
    }

    let total =
      typeof raw?.total === "number" && raw.total >= 0
        ? raw.total
        : typeof raw?.count === "number" && raw.count >= 0
        ? raw.count
        : -1;

    const hasFilterApplied = Boolean(
      params?.status || filterFromDate || filterToDate || filterDueFrom || filterDueTo || filterRetFrom || filterRetTo
    );
    if (total === -1 || (hasFilterApplied && enriched.length < items.length)) {
      if (enriched.length < size) {
        total = (page - 1) * size + enriched.length;
      } else {
        total = page * size + 1;
      }
    }

    const totalPages =
      typeof raw?.total_pages === "number" && raw.total_pages > 0 && !(hasFilterApplied && enriched.length < items.length)
        ? raw.total_pages
        : typeof raw?.totalPages === "number" && raw.totalPages > 0 && !(hasFilterApplied && enriched.length < items.length)
        ? raw.totalPages
        : Math.max(1, Math.ceil(total / size));

    return {
      items: enriched,
      total,
      page,
      size,
      totalPages,
    };
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
    if (error.response?.status === 404 || error.response?.status === 422) {
      throw new Error(
        formatApiError(error, "Daftar peminjaman gagal dimuat."),
      );
    }
    throw error;
  }
}

export interface ListActiveReturnsParams {
  companyId?: string;
  page?: number;
  size?: number;
  search?: string;
}

export async function getActiveReturnsApi(
  paramsOrCompanyId?: ListActiveReturnsParams | string
): Promise<{ items: ReturnLoanData[]; total: number; page: number; size: number; totalPages: number }> {
  let companyId: string | undefined;
  let page: number = 1;
  let size: number = 10;
  let search: string | undefined;

  if (typeof paramsOrCompanyId === "string") {
    companyId = paramsOrCompanyId;
  } else if (paramsOrCompanyId) {
    companyId = paramsOrCompanyId.companyId;
    page = paramsOrCompanyId.page ?? 1;
    size = paramsOrCompanyId.size ?? 10;
    search = paramsOrCompanyId.search;
  }

  const compId = resolveCompanyId(companyId);
  const cleanSearch = search?.trim() || "";
  const isHexLoanId = /^[0-9a-fA-F]{24}$/.test(cleanSearch);

  // Gunakan search loans endpoint (/loan) ke backend secara langsung dengan status pinjaman aktif & terlambat
  const res = await listLoansApi({
    page,
    size: cleanSearch ? Math.max(size, 20) : size,
    q: isHexLoanId ? undefined : (cleanSearch || undefined),
    loan_id: isHexLoanId ? cleanSearch : undefined,
    status: ["ACTIVE", "OVERDUE"],
    companyId: compId,
  });

  // Guard: pastikan hanya transaksi yang belum selesai dan masih memiliki eksemplar yang dipinjam
  const activeItems = res.items.filter(
    (tx) =>
      tx.loan.status !== "COMPLETED" &&
      !tx.loan.returnedAt &&
      tx.items.some((it) => it.loanItem.status === "BORROWED")
  );

  return {
    items: activeItems.slice(0, size),
    total: activeItems.length,
    page,
    size,
    totalPages: Math.max(1, Math.ceil(activeItems.length / size)),
  };
}

export const listActiveReturnsApi = getActiveReturnsApi;

export async function getLoanByIdApi(
  loanId: string,
  companyId?: string
): Promise<ReturnLoanData | null> {
  const cleanId = (loanId || "").trim();
  if (!cleanId) return null;
  const compId = resolveCompanyId(companyId);

  try {
    // 1. Coba endpoint langsung: GET /loan/:id
    try {
      const response = await api.get(`/loan/${cleanId}`, {
        params: compId ? { company_id: compId } : undefined,
      });
      const raw = response.data?.loan || response.data?.data || response.data;
      if (raw && (raw.id || raw._id)) {
        const mapped = mapRawToTransactionData(raw);
        const enriched = await enrichTransactions([mapped], 1);
        if (enriched.length > 0) return enriched[0];
      }
    } catch {
      // Abaikan jika endpoint /loan/:id 404
    }

    // 2. Coba endpoint search dengan loan_id: GET /loan/search?loan_id=:id
    const searchRes = await listLoansApi({
      loan_id: cleanId,
      size: 5,
      companyId: compId,
    });
    const foundById = searchRes.items.find(
      (it) =>
        it.loan.id === cleanId ||
        it.loan.loanNumber.toLowerCase() === cleanId.toLowerCase()
    );
    if (foundById) {
      return foundById;
    }

    // 3. Cari dengan query q jika format nomor transaksi
    const qRes = await listLoansApi({
      q: cleanId,
      size: 5,
      companyId: compId,
    });
    const foundQ = qRes.items.find(
      (it) =>
        it.loan.id === cleanId ||
        it.loan.loanNumber.toLowerCase() === cleanId.toLowerCase()
    );

    return foundQ || null;
  } catch (err) {
    console.warn("Gagal getLoanByIdApi:", err);
    return null;
  }
}

export async function returnLoanItemsApi(
  loanId: string,
  copyIds: string[],
  _itemIds?: string[],
  companyId?: string,
  returnedAt?: string
): Promise<Loan> {
  const compId = resolveCompanyId(companyId);

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

    const payload: Record<string, any> = {
      copy_ids: finalCopyIds,
    };

    if (returnedAt) {
      const cleanReturnedAt = returnedAt.includes("T")
        ? returnedAt
        : `${returnedAt.slice(0, 10)}T12:00:00.000Z`;
      payload.returned_at = cleanReturnedAt;
    }

    const response = await api.post(`/loan/returns/${loanId}`, payload);

    const raw = response.data?.loan || response.data;
    if (raw && (raw.id || raw._id)) {
      return {
        id: raw._id || raw.id || loanId,
        companyId: raw.company_id || raw.companyId || compId,
        loanNumber: formatCleanLoanNumber(raw),
        memberId: raw.member_id || raw.memberId || "-",
        borrowedBy: raw.borrowed_by || raw.borrowedBy || "-",
        borrowedAt: raw.borrowed_at || raw.borrowedAt || "",
        dueAt: raw.due_at || raw.dueAt || "",
        returnedAt: raw.returned_at || raw.returnedAt || "",
        status: (raw.status as Loan["status"]) || "COMPLETED",
        createdAt: raw.created_at || raw.createdAt || "",
        updatedAt: raw.updated_at || raw.updatedAt || "",
      };
    }
    throw new Error("Format respons pengembalian tidak valid.");
  } catch (error: any) {
    const detail =
      error.response?.data?.detail || error.response?.data?.message || "";
    const isAlreadyReturned =
      error.response?.status === 409 ||
      (typeof detail === "string" &&
        detail.toLowerCase().includes("sudah dikembalikan"));

    if (isAlreadyReturned) {
      throw new Error(
        typeof detail === "string" && detail
          ? detail
          : "Buku pada peminjaman ini sudah dikembalikan sebelumnya."
      );
    }

    throw new Error(
      formatApiError(
        error,
        "Pengembalian buku gagal diproses oleh server."
      )
    );
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
    search?: string;
  } = {}
): Promise<OfficeMembersListResponse> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  const page = params.page || 1;
  const size = Math.min(100, Math.max(1, params.size || 10));
  const sortby = params.sortby;
  const order = params.order || "asc";
  const search = params.search?.trim();

  try {
    if (search) {
      const response = await api.get("/office/member/search", {
        params: {
          q: search,
          company_id: compId,
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
        id: String(item._id || item.id || item.member_id || ""),
        companyId: String(item.company_id || compId),
        memberNumber: String(item.member_number || item.memberNumber || "-"),
        name: String(item.name || "-"),
        memberType: "UMUM",
        identityNumber: String(item.identity_number || item.identityNumber || "-"),
        phone: String(item.phone || "-"),
        email: item.email || undefined,
        status: (item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") as any,
        createdAt: item.created_at || "",
        updatedAt: item.updated_at || item.created_at || "",
      }));

      return {
        items: mappedItems,
        total: mappedItems.length,
        page: 1,
        size: mappedItems.length || 10,
        totalPages: 1,
      };
    }

    const response = await api.get("/office/member", {
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
      id: String(item._id || item.id || item.member_id || ""),
      companyId: String(item.company_id || compId),
      memberNumber: String(item.member_number || item.memberNumber || "-"),
      name: String(item.name || "-"),
      memberType: "UMUM",
      identityNumber: String(item.identity_number || item.identityNumber || "-"),
      phone: String(item.phone || "-"),
      email: item.email || undefined,
      status: (item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") as any,
      createdAt: item.created_at || "",
      updatedAt: item.updated_at || item.created_at || "",
    }));

    const total = Number(raw?.total !== undefined ? raw.total : mappedItems.length);
    const totalPages = total > 0 ? Math.ceil(total / size) : 1;

    return {
      items: mappedItems,
      total,
      page,
      size,
      totalPages,
    };
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal memuat data anggota office."));
  }
}

export async function searchOfficeMembersApi(
  companyId: string,
  query: string
): Promise<Member[]> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  try {
    const response = await api.get("/office/member/search", {
      params: {
        q: query,
        company_id: compId,
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

    return items.map((item: any) => ({
      id: String(item._id || item.id || item.member_id || ""),
      companyId: String(item.company_id || compId),
      memberNumber: String(item.member_number || item.memberNumber || "-"),
      name: String(item.name || "-"),
      memberType: "UMUM",
      identityNumber: String(item.identity_number || item.identityNumber || "-"),
      phone: String(item.phone || "-"),
      email: item.email || undefined,
      status: (item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") as any,
      createdAt: item.created_at || "",
      updatedAt: item.updated_at || item.created_at || "",
    }));
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal mencari data anggota office."));
  }
}

export async function getOfficeMemberDetailApi(
  companyId: string,
  memberId: string
): Promise<Member> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  try {
    const response = await api.get(`/office/member/${memberId}`, {
      params: { company_id: compId },
    });

    const item = response.data?.data || response.data;
    return {
      id: String(item._id || item.id || item.member_id || memberId),
      companyId: String(item.company_id || compId),
      memberNumber: String(item.member_number || item.memberNumber || "-"),
      name: String(item.name || "-"),
      memberType: "UMUM",
      identityNumber: String(item.identity_number || item.identityNumber || "-"),
      phone: String(item.phone || "-"),
      email: item.email || undefined,
      status: (item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") as any,
      createdAt: item.created_at || "",
      updatedAt: item.updated_at || item.created_at || "",
    };
  } catch (error: any) {
    throw new Error(formatApiError(error, "Anggota tidak ditemukan."));
  }
}

export async function createOfficeMemberApi(
  companyId: string,
  payload: {
    name: string;
    member_number?: string;
    memberNumber?: string;
    identity_number?: string;
    identityNumber?: string;
    phone: string;
    email?: string;
  }
): Promise<Member> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  const memberNumber = (payload.member_number || payload.memberNumber || "").trim();
  if (!payload.name?.trim()) {
    throw new Error("Nama anggota wajib diisi.");
  }
  const identityNumber = (payload.identity_number || payload.identityNumber || "").trim();
  if (!identityNumber) {
    throw new Error("Nomor identitas (NIK) wajib diisi.");
  }
  if (!payload.phone?.trim()) {
    throw new Error("Nomor telepon wajib diisi.");
  }

  const body: Record<string, any> = {
    name: payload.name.trim(),
    identity_number: identityNumber,
    phone: payload.phone.trim(),
    email: payload.email?.trim() || null,
  };
  if (memberNumber) {
    body.member_number = memberNumber;
  }

  try {
    const response = await api.post("/office/member", body, {
      params: { company_id: compId },
    });

    const item = response.data?.data || response.data;
    return {
      id: String(item._id || item.id || ""),
      companyId: compId,
      memberNumber: item.member_number || body.member_number,
      name: item.name || body.name,
      memberType: "UMUM",
      identityNumber: item.identity_number || body.identity_number,
      phone: item.phone || body.phone,
      email: item.email || body.email || undefined,
      status: item.status || "ACTIVE",
      createdAt: item.created_at || "",
      updatedAt: item.updated_at || item.created_at || "",
    };
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal membuat anggota baru."));
  }
}

export async function updateOfficeMemberApi(
  companyId: string,
  memberId: string,
  payload: {
    name?: string;
    member_number?: string;
    memberNumber?: string;
    identity_number?: string;
    identityNumber?: string;
    phone?: string;
    email?: string | null;
    status?: "ACTIVE" | "INACTIVE";
  }
): Promise<Member> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  const body: Record<string, any> = {};
  if (payload.name !== undefined) body.name = payload.name.trim();
  const num = payload.member_number || payload.memberNumber;
  if (num !== undefined) body.member_number = num.trim();
  const idNum = payload.identity_number || payload.identityNumber;
  if (idNum !== undefined) body.identity_number = idNum.trim();
  if (payload.phone !== undefined) body.phone = payload.phone.trim();
  if (payload.email !== undefined) body.email = payload.email ? payload.email.trim() : null;
  if (payload.status !== undefined) body.status = payload.status;

  try {
    const response = await api.patch(`/office/member/${memberId}`, body, {
      params: { company_id: compId },
    });

    const item = response.data?.data || response.data;
    return {
      id: String(item._id || item.id || memberId),
      companyId: compId,
      memberNumber: String(item.member_number || body.member_number || "-"),
      name: String(item.name || body.name || "-"),
      memberType: "UMUM",
      identityNumber: String(item.identity_number || body.identity_number || "-"),
      phone: String(item.phone || body.phone || "-"),
      email: item.email || body.email || undefined,
      status: (item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE") as any,
      createdAt: item.created_at || "",
      updatedAt: item.updated_at || item.created_at || "",
    };
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal memperbarui data anggota."));
  }
}

export async function deleteOfficeMemberApi(_companyId: string, _memberId: string): Promise<boolean> {
  throw new Error(
    "MENUNGGU BE: Endpoint delete anggota tidak tersedia di server. Nonaktifkan anggota menggunakan PATCH status INACTIVE."
  );
}

// =========================================================
// COMPANIES API (SUPER ADMIN MULTI-TENANT)
// =========================================================

export interface CreateCompanyPayload {
  id?: string;
  code?: string;
  initial?: string;
  name: string;
  address?: string;
  timezone?: string;
  logoUrl?: string | null;
  isActive?: boolean;
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

export interface UpdateCompanyPayload {
  name: string;
  code?: string;
  initial?: string;
  address?: string;
  timezone?: string;
  logoUrl?: string | null;
  isActive?: boolean;
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

const COMPANY_META_KEY = "bukuflow_company_meta";

interface StoredCompanyMeta {
  initial?: string;
  code?: string;
  isActive?: boolean;
}

function getStoredCompanyMetaMap(): Record<string, StoredCompanyMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(COMPANY_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStoredCompanyMeta(id: string, meta: StoredCompanyMeta): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const map = getStoredCompanyMetaMap();
    map[id] = { ...map[id], ...meta };
    localStorage.setItem(COMPANY_META_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export interface GetCompaniesParams {
  page?: number;
  size?: number;
  sortby?: string;
  order?: "asc" | "desc";
}

export interface CompaniesPaginatedResponse {
  items: Company[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export async function getCompaniesPaginatedApi(
  params?: GetCompaniesParams
): Promise<CompaniesPaginatedResponse> {
  const page = params?.page ?? 1;
  const size = params?.size ?? 10;
  const queryParams: Record<string, any> = {
    page,
    size,
  };
  if (params?.sortby) queryParams.sortby = params.sortby;
  if (params?.order) queryParams.order = params.order;

  const response = await api.get("/office/company", { params: queryParams });
  const raw = response.data;
  const items = raw?.items || raw?.data || (Array.isArray(raw) ? raw : []);
  const metaMap = getStoredCompanyMetaMap();

  const mappedCompanies: Company[] = items.map((item: Record<string, unknown>) => {
    const id = String(item.id || item._id || "");
    const cached = metaMap[id];

    let isActive = true;
    if (item.isActive !== undefined) {
      isActive = Boolean(item.isActive);
    } else if (item.is_active !== undefined) {
      isActive = Boolean(item.is_active);
    } else if (cached?.isActive !== undefined) {
      isActive = cached.isActive;
    }

    const code = String(
      item.initial || item.code || cached?.initial || cached?.code || (id ? id.slice(-6).toUpperCase() : "-")
    ).toUpperCase();

    return {
      id,
      name: String(item.name || item.company_name || "-"),
      code,
      address: String(item.address || ""),
      timezone: String(item.timezone || "Asia/Jakarta"),
      status: isActive ? "ACTIVE" : "INACTIVE",
      logo: typeof item.logoUrl === "string" ? item.logoUrl : undefined,
      createdAt:
        typeof item.createdTime === "string"
          ? item.createdTime
          : typeof item.createdAt === "string"
          ? item.createdAt
          : typeof item.created_at === "string"
          ? item.created_at
          : undefined,
    };
  });

  const total = typeof raw?.total === "number" && raw.total >= 0 ? raw.total : -1;
  const totalPages =
    typeof raw?.total_pages === "number" && raw.total_pages > 0
      ? raw.total_pages
      : total > 0
      ? Math.ceil(total / size)
      : Math.max(1, page);

  return {
    items: mappedCompanies,
    total,
    page,
    size,
    totalPages,
  };
}

export async function getCompaniesApi(params?: GetCompaniesParams): Promise<Company[]> {
  const res = await getCompaniesPaginatedApi(params);
  return res.items;
}

export async function getCompanyDetailApi(_id: string): Promise<Company> {
  throw new Error("MENUNGGU BE: Endpoint detail instansi belum tersedia di backend.");
}

function generateObjectId(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  const random = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return timestamp + random;
}

export async function createCompanyApi(payload: CreateCompanyPayload): Promise<Company> {
  const companyId = (payload.id && /^[0-9a-fA-F]{24}$/.test(payload.id.trim()))
    ? payload.id.trim()
    : generateObjectId();

  let initial = (payload.initial || payload.code || "").trim();
  if (!payload.name?.trim()) {
    throw new Error("Nama instansi wajib diisi.");
  }
  if (!initial) {
    initial = payload.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toLowerCase() || "inst";
  }

  const isActive =
    payload.isActive !== undefined
      ? payload.isActive
      : payload.status !== undefined
      ? payload.status === "ACTIVE"
      : true;

  const body = {
    name: payload.name.trim(),
    initial: initial.toLowerCase(),
    logoUrl: payload.logoUrl ?? null,
    isActive: isActive,
    isDeleted: false,
  };

  try {
    const response = await api.put(`/office/company/${companyId}`, body);
    const item = response.data?.data || response.data || {};

    saveStoredCompanyMeta(companyId, {
      initial: body.initial,
      code: body.initial.toUpperCase(),
      isActive: body.isActive,
    });

    return {
      id: String(item._id || item.id || companyId),
      name: String(item.name || body.name),
      code: String(item.initial || body.initial).toUpperCase(),
      address: String(item.address || ""),
      timezone: String(item.timezone || "Asia/Jakarta"),
      status: (item.isActive ?? body.isActive) ? "ACTIVE" : "INACTIVE",
      logo: item.logoUrl ?? undefined,
      createdAt: item.createdTime || item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedTime || item.updatedAt || new Date().toISOString(),
    };
  } catch (err: any) {
    throw new Error(formatApiError(err, "Gagal menambahkan instansi baru."));
  }
}

export async function updateCompanyApi(
  id: string,
  payload: UpdateCompanyPayload
): Promise<Company> {
  const companyId = id?.trim();
  if (!companyId) {
    throw new Error("ID instansi tidak valid.");
  }
  let initial = (payload.initial || payload.code || "").trim();
  if (!payload.name?.trim()) {
    throw new Error("Nama instansi wajib diisi.");
  }
  if (!initial) {
    initial = payload.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toLowerCase() || "inst";
  }

  const isActive =
    payload.isActive !== undefined
      ? payload.isActive
      : payload.status !== undefined
      ? payload.status === "ACTIVE"
      : true;

  const body = {
    name: payload.name.trim(),
    initial: initial.toLowerCase(),
    logoUrl: payload.logoUrl ?? null,
    isActive: isActive,
    isDeleted: false,
  };

  try {
    const response = await api.put(`/office/company/${companyId}`, body);
    const item = response.data?.data || response.data || {};

    saveStoredCompanyMeta(companyId, {
      initial: body.initial,
      code: body.initial.toUpperCase(),
      isActive: body.isActive,
    });

    return {
      id: String(item._id || item.id || companyId),
      name: String(item.name || body.name),
      code: String(item.initial || body.initial).toUpperCase(),
      address: String(item.address || ""),
      timezone: String(item.timezone || "Asia/Jakarta"),
      status: (item.isActive ?? body.isActive) ? "ACTIVE" : "INACTIVE",
      logo: item.logoUrl ?? undefined,
      createdAt: item.createdTime || item.createdAt || "",
      updatedAt: item.updatedTime || item.updatedAt || "",
    };
  } catch (err: any) {
    throw new Error(formatApiError(err, "Gagal memperbarui data instansi."));
  }
}

export async function deleteCompanyApi(_id: string): Promise<boolean> {
  throw new Error(
    "MENUNGGU BE: Endpoint penghapusan instansi tidak tersedia di server. Nonaktifkan melalui status isActive."
  );
}

export interface OfficeCompanyConfig {
  default_loan_duration: number;
  max_active_loans: number;
  late_fee_per_day: number;
}

export async function getOfficeCompanyConfigApi(companyId: string): Promise<OfficeCompanyConfig | null> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  try {
    const response = await api.get("/office/company/config", {
      params: { company_id: compId },
    });
    const data = response.data?.data || response.data || {};
    if (
      data.default_loan_duration == null ||
      data.max_active_loans == null ||
      data.late_fee_per_day == null ||
      !Number.isFinite(Number(data.default_loan_duration)) ||
      !Number.isFinite(Number(data.max_active_loans)) ||
      !Number.isFinite(Number(data.late_fee_per_day))
    ) {
      throw new Error("Konfigurasi instansi belum tersedia di database backend.");
    }
    return {
      default_loan_duration: Number(data.default_loan_duration),
      max_active_loans: Number(data.max_active_loans),
      late_fee_per_day: Number(data.late_fee_per_day),
    };
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw new Error(formatApiError(err, "Gagal memuat konfigurasi peminjaman instansi."));
  }
}

export async function updateOfficeCompanyConfigApi(
  companyId: string,
  payload: OfficeCompanyConfig
): Promise<OfficeCompanyConfig> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  if (
    payload.default_loan_duration === undefined ||
    payload.max_active_loans === undefined ||
    payload.late_fee_per_day === undefined
  ) {
    throw new Error("Konfigurasi mewajibkan default_loan_duration, max_active_loans, dan late_fee_per_day.");
  }

  const body = {
    default_loan_duration: Math.max(1, Math.round(Number(payload.default_loan_duration))),
    max_active_loans: Math.max(1, Math.round(Number(payload.max_active_loans))),
    late_fee_per_day: Math.max(0, Math.round(Number(payload.late_fee_per_day))),
  };

  try {
    const response = await api.put("/office/company/config", body, {
      params: { company_id: compId },
    });
    const data = response.data?.data || response.data || body;
    return {
      default_loan_duration: Number(data.default_loan_duration ?? body.default_loan_duration),
      max_active_loans: Number(data.max_active_loans ?? body.max_active_loans),
      late_fee_per_day: Number(data.late_fee_per_day ?? body.late_fee_per_day),
    };
  } catch (err: any) {
    throw new Error(formatApiError(err, "Gagal menyimpan konfigurasi kebijakan instansi."));
  }
}

// =========================================================
// =========================================================
// COMPANY USERS API (SWAGGER: /bukuflow/user)
// =========================================================

export interface CreateCompanyUserPayload {
  name: string;
  email: string;
  password?: string;
  role: "COMPANY_ADMIN" | "STAFF";
}

export interface UpdateCompanyUserPayload {
  name?: string;
  email?: string;
  password?: string;
  is_active?: boolean;
  role?: "COMPANY_ADMIN" | "STAFF";
}

export interface ListCompanyUsersParams {
  page?: number;
  size?: number;
  search?: string;
  role?: string;
  status?: string;
  companyId?: string;
}

export interface ListCompanyUsersResponse {
  items: any[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export async function getCompanyUsersApi(
  params: ListCompanyUsersParams = {}
): Promise<ListCompanyUsersResponse> {
  const page = params.page || 1;
  const size = params.size || 10;
  const auth = typeof window !== "undefined" ? getAuthData() : null;
  const isSuperAdmin = auth?.user?.role === "SUPER_ADMIN";
  const targetCompanyId = params.companyId
    ? resolveCompanyId(params.companyId)
    : isSuperAdmin
    ? ""
    : resolveCompanyId();

  try {
    const response = await api.get("/user", {
      params: {
        page,
        size,
        search: params.search || undefined,
        role: params.role && params.role !== "ALL" ? params.role : undefined,
        company_id: targetCompanyId || undefined,
        is_active:
          params.status === "ACTIVE"
            ? true
            : params.status === "INACTIVE"
            ? false
            : undefined,
      },
    });

    const raw = response.data;
    const rawItems = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw)
      ? raw
      : [];

    const mappedItems = rawItems
      // FILTER: Only include users within the same company and NEVER include SUPER_ADMIN
      .filter((u: any) => u.role !== "SUPER_ADMIN")
      .filter((u: any) => {
        if (!targetCompanyId) return true;
        const uCompId = u.company_id || u.companyId;
        return !uCompId || uCompId === targetCompanyId;
      })
      .map((u: any) => {
        const isActive =
          u.is_active !== undefined
            ? Boolean(u.is_active)
            : u.status === "ACTIVE" || u.status === undefined || u.status === true;

        return {
          id: String(u.id || u._id || u.user_id),
          companyId: String(u.company_id || u.companyId || targetCompanyId || ""),
          name: String(u.name || "-"),
          email: u.email ? String(u.email) : "",
          username: String(u.username || (u.email ? u.email.split("@")[0] : u.name || "-")),
          role: u.role || "STAFF",
          status: isActive ? "ACTIVE" : "INACTIVE",
          is_active: isActive,
          createdAt: u.created_at || u.createdAt || "",
        };
      });

    const total = Number(raw?.total || mappedItems.length);

    // If server returned unpaginated list, paginate on client
    const paginatedItems =
      mappedItems.length > size
        ? mappedItems.slice((page - 1) * size, page * size)
        : mappedItems;

    return {
      items: paginatedItems,
      total: total,
      page,
      size,
      totalPages: Math.max(1, Math.ceil(total / size)),
    };
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal memuat daftar pengguna dari server."));
  }
}

export async function createCompanyUserApi(
  payload: CreateCompanyUserPayload
): Promise<any> {
  if (!payload.password || payload.password.trim().length < 8) {
    throw new Error("Password minimal 8 karakter sesuai spesifikasi server.");
  }

  const body = {
    name: payload.name.trim(),
    email: payload.email.trim(),
    password: payload.password.trim(),
    role: payload.role,
  };

  try {
    const response = await api.post("/user", body);

    const item = response.data?.data || response.data?.user || response.data;
    const isActive =
      item?.is_active !== undefined
        ? Boolean(item.is_active)
        : item?.status === "ACTIVE" || item?.status === undefined;

    return {
      id: String(item?.id || item?._id || item?.user_id || ""),
      companyId: String(item?.company_id || item?.companyId || ""),
      name: String(item?.name || body.name),
      email: String(item?.email || body.email),
      username: String(item?.username || body.email.split("@")[0]),
      role: item?.role || body.role,
      status: isActive ? "ACTIVE" : "INACTIVE",
      is_active: isActive,
      createdAt: item?.created_at || item?.createdAt || "",
    };
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal membuat pengguna baru."));
  }
}

export async function updateCompanyUserApi(
  userId: string,
  payload: UpdateCompanyUserPayload
): Promise<any> {
  const body: Record<string, any> = {};
  if (payload.name !== undefined) body.name = payload.name.trim();
  if (payload.is_active !== undefined) body.is_active = payload.is_active;
  if (payload.role !== undefined) body.role = payload.role;
  if (payload.email !== undefined) body.email = payload.email.trim();
  if (payload.password !== undefined && payload.password.trim() !== "") body.password = payload.password.trim();

  try {
    const response = await api.patch(`/user/${userId}`, body);

    const item = response.data?.data || response.data?.user || response.data;
    const isActive =
      item?.is_active !== undefined
        ? Boolean(item.is_active)
        : payload.is_active !== undefined
        ? payload.is_active
        : true;

    return {
      id: String(item?.id || item?._id || item?.user_id || userId),
      name: String(item?.name || payload.name || "-"),
      email: String(item?.email || payload.email || ""),
      username: String(item?.username || (item?.email || payload.email || "").split("@")[0] || ""),
      role: item?.role || payload.role || "STAFF",
      status: isActive ? "ACTIVE" : "INACTIVE",
      is_active: isActive,
      updatedAt: item?.updated_at || item?.updatedAt || "",
    };
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal memperbarui pengguna."));
  }
}

export async function deleteCompanyUserApi(userId: string): Promise<boolean> {
  try {
    await api.delete(`/user/${userId}`);
    return true;
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal menghapus pengguna."));
  }
}

export interface OfficeUserItem {
  id: string;
  companyId: string;
  name: string;
  email: string;
  username: string;
  role: "COMPANY_ADMIN" | "STAFF" | "SUPER_ADMIN" | "MEMBER";
  is_active: boolean;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt?: string;
}

export interface OfficeUsersListResponse {
  items: OfficeUserItem[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export async function getOfficeUsersApi(
  companyId: string,
  params: {
    page?: number;
    size?: number;
    search?: string;
    role?: string;
    sortby?: string;
    order?: string;
  } = {}
): Promise<OfficeUsersListResponse> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  const page = params.page || 1;
  const size = Math.min(100, Math.max(1, params.size || 10));
  const sortby = params.sortby;
  const order = params.order || "asc";

  try {
    const response = await api.get("/office/user", {
      params: {
        company_id: compId,
        page,
        size,
        search: params.search || undefined,
        role: params.role && params.role !== "ALL" ? params.role : undefined,
        sortby,
        order,
      },
    });

    const raw = response.data;
    const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
    const mappedItems: OfficeUserItem[] = items.map((u: any) => ({
      id: String(u._id || u.id || ""),
      companyId: String(u.company_id || compId),
      name: String(u.name || "-"),
      email: String(u.email || "-"),
      username: String(u.email ? u.email.split("@")[0] : u.name || "-"),
      role: (u.role || "STAFF") as any,
      is_active: Boolean(u.is_active),
      status: u.is_active ? "ACTIVE" : "INACTIVE",
      createdAt: u.created_at || "",
      updatedAt: u.updated_at || undefined,
    }));

    const total = Number(raw?.total !== undefined ? raw.total : mappedItems.length);
    const totalPages = total > 0 ? Math.ceil(total / size) : 1;

    return {
      items: mappedItems,
      total,
      page,
      size,
      totalPages,
    };
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal memuat daftar pengguna office."));
  }
}

export async function createOfficeUserApi(
  companyId: string,
  payload: {
    name: string;
    email: string;
    password?: string;
    role?: "COMPANY_ADMIN" | "STAFF";
  }
): Promise<OfficeUserItem> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  if (!payload.name?.trim()) {
    throw new Error("Nama pengguna wajib diisi.");
  }
  if (!payload.email?.trim()) {
    throw new Error("Email pengguna wajib diisi.");
  }
  if (!payload.password || payload.password.trim().length < 8) {
    throw new Error("Password minimal 8 karakter sesuai spesifikasi server.");
  }

  const body = {
    name: payload.name.trim(),
    email: payload.email.trim(),
    password: payload.password.trim(),
    role: payload.role || "STAFF",
  };

  try {
    const response = await api.post("/office/user", body, {
      params: { company_id: compId },
    });

    const u = response.data?.data || response.data;
    return {
      id: String(u._id || u.id || ""),
      companyId: compId,
      name: u.name || body.name,
      email: u.email || body.email,
      username: body.email.split("@")[0],
      role: (u.role || body.role) as any,
      is_active: Boolean(u.is_active !== undefined ? u.is_active : true),
      status: (u.is_active !== undefined ? u.is_active : true) ? "ACTIVE" : "INACTIVE",
      createdAt: u.created_at || "",
    };
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal membuat pengguna baru."));
  }
}

export async function updateOfficeUserApi(
  companyId: string,
  userId: string,
  payload: {
    name?: string;
    is_active?: boolean;
    role?: "COMPANY_ADMIN" | "STAFF";
  }
): Promise<OfficeUserItem> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  const body: Record<string, any> = {};
  if (payload.name !== undefined) body.name = payload.name.trim();
  if (payload.is_active !== undefined) body.is_active = payload.is_active;
  if (payload.role !== undefined) body.role = payload.role;

  try {
    const response = await api.patch(`/office/user/${userId}`, body, {
      params: { company_id: compId },
    });

    const u = response.data?.data || response.data;
    return {
      id: String(u._id || u.id || userId),
      companyId: compId,
      name: u.name || payload.name || "-",
      email: u.email || "-",
      username: (u.email || "").split("@")[0] || "-",
      role: (u.role || payload.role || "STAFF") as any,
      is_active: Boolean(u.is_active),
      status: u.is_active ? "ACTIVE" : "INACTIVE",
      createdAt: u.created_at || "",
      updatedAt: u.updated_at || u.created_at || "",
    };
  } catch (error: any) {
    throw new Error(formatApiError(error, "Gagal memperbarui pengguna."));
  }
}

export async function deleteOfficeUserApi(
  _userId: string,
  _companyId?: string
): Promise<boolean> {
  throw new Error(
    "MENUNGGU BE: Endpoint penghapusan akun pengguna tidak tersedia di server. Nonaktifkan melalui status isActive."
  );
}

// =========================================================
// OFFICE CATALOG BOOKS API
// =========================================================

export interface OfficeBookItem {
  id: string;
  companyId: string;
  code: string;
  title: string;
  isbn?: string;
  author?: string;
  category?: string;
  publisher?: string;
  publishedYear?: number;
  status: BookStatus;
  totalCopies: number;
  availableCopies: number;
  createdAt: string;
  updatedAt?: string;
}

export interface OfficeBooksListResponse {
  items: OfficeBookItem[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export async function getOfficeBooksApi(
  companyId: string,
  params: {
    page?: number;
    size?: number;
    sortby?: string;
    order?: string;
    search?: string;
  } = {}
): Promise<OfficeBooksListResponse> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  const page = params.page || 1;
  const size = Math.min(100, Math.max(1, params.size || 10));
  const sortby = params.sortby;
  const order = params.order || "asc";
  const search = params.search?.trim();

  try {
    if (search) {
      const response = await api.get("/office/catalog/books/search", {
        params: { q: search, company_id: compId },
      });
      const raw = response.data;
      const rawItems = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
      const mapped = rawItems.map((b: any) => ({
        id: String(b._id || b.id || ""),
        companyId: String(b.company_id || compId),
        code: String(b.code || "-"),
        title: String(b.title || "-"),
        isbn: b.isbn || undefined,
        author: b.author || undefined,
        category: b.category || undefined,
        publisher: b.publisher || undefined,
        publishedYear: b.published_year !== undefined ? Number(b.published_year) : undefined,
        status: parseBookStatus(
          b.status,
          Number(b.total_copies ?? 0),
          Number(b.available_copies ?? 0)
        ),
        totalCopies: Number(b.total_copies ?? 0),
        availableCopies: Number(b.available_copies ?? 0),
        createdAt: b.created_at || "",
        updatedAt: b.updated_at || undefined,
      }));
      return {
        items: mapped,
        total: mapped.length,
        page: 1,
        size: mapped.length || 10,
        totalPages: 1,
      };
    }

    const response = await api.get("/office/catalog/books", {
      params: {
        company_id: compId,
        page,
        size,
        sortby,
        order,
      },
    });

    const raw = response.data;
    const rawItems = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
    const mapped = rawItems.map((b: any) => ({
      id: String(b._id || b.id || ""),
      companyId: String(b.company_id || compId),
      code: String(b.code || "-"),
      title: String(b.title || "-"),
      isbn: b.isbn || undefined,
      author: b.author || undefined,
      category: b.category || undefined,
      publisher: b.publisher || undefined,
      publishedYear: b.published_year !== undefined ? Number(b.published_year) : undefined,
      status: parseBookStatus(
        b.status,
        Number(b.total_copies ?? 0),
        Number(b.available_copies ?? 0)
      ),
      totalCopies: Number(b.total_copies ?? 0),
      availableCopies: Number(b.available_copies ?? 0),
      createdAt: b.created_at || "",
      updatedAt: b.updated_at || undefined,
    }));

    const total = Number(raw?.total !== undefined ? raw.total : mapped.length);
    const totalPages = total > 0 ? Math.ceil(total / size) : 1;

    return {
      items: mapped,
      total,
      page,
      size,
      totalPages,
    };
  } catch (err: any) {
    throw new Error(formatApiError(err, "Gagal memuat katalog buku office."));
  }
}

// =========================================================
// OFFICE LOANS API
// =========================================================

export interface OfficeLoanBookItem {
  id?: string;
  bookId?: string;
  bookTitle?: string;
  bookCode?: string;
  copyCode?: string;
  status?: string;
}

export interface OfficeLoanItem {
  id: string;
  companyId: string;
  loanNumber: string;
  rawLoanNumber?: string;
  memberId: string;
  borrowedBy: string;
  memberName?: string;
  memberNumber?: string;
  officerName?: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt?: string;
  status: "ACTIVE" | "OVERDUE" | "COMPLETED";
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  copyIds: string[];
  items?: OfficeLoanBookItem[];
}

export interface OfficeLoansListResponse {
  items: OfficeLoanItem[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

// In-memory cache for office members per company to avoid refetching on every page turn
const officeMemberCache = new Map<string, { timestamp: number; map: Map<string, Member> }>();
// In-memory cache for office users (officers) per company
const officeUserCache = new Map<string, { timestamp: number; map: Map<string, string> }>();
// Negative cache for member IDs that returned 404 or are missing to prevent repeated failed requests
const officeInvalidMemberIds = new Set<string>();

async function enrichOfficeLoansWithMembers(
  companyId: string,
  loans: OfficeLoanItem[]
): Promise<OfficeLoanItem[]> {
  if (!companyId || loans.length === 0) return loans;

  try {
    const cached = officeMemberCache.get(companyId);
    let memberMap: Map<string, Member>;

    if (cached && Date.now() - cached.timestamp < 60_000) {
      memberMap = cached.map;
    } else {
      memberMap = new Map<string, Member>();
      try {
        const membersRes = await getOfficeMembersApi(companyId, { size: 10 });
        for (const m of membersRes.items) {
          if (m.id) {
            memberMap.set(m.id, m);
            memberMap.set(m.id.toLowerCase(), m);
          }
          if (m.memberNumber) {
            memberMap.set(m.memberNumber, m);
            memberMap.set(m.memberNumber.toLowerCase(), m);
          }
        }
        officeMemberCache.set(companyId, { timestamp: Date.now(), map: memberMap });
      } catch {
        // Abaikan jika pemuatan daftar anggota gagal
      }
    }

    // Load office user cache (untuk memetakan borrowed_by / officer)
    const cachedUsers = officeUserCache.get(companyId);
    let userMap: Map<string, string>;

    if (cachedUsers && Date.now() - cachedUsers.timestamp < 60_000) {
      userMap = cachedUsers.map;
    } else {
      userMap = new Map<string, string>();
      try {
        const usersRes = await getOfficeUsersApi(companyId, { size: 10 });
        for (const u of usersRes.items) {
          if (u.id && u.name) {
            userMap.set(u.id, u.name);
            userMap.set(u.id.toLowerCase(), u.name);
          }
        }
        officeUserCache.set(companyId, { timestamp: Date.now(), map: userMap });
      } catch {
        // Abaikan jika pemuatan daftar user gagal
      }
    }

    // Identifikasi ID member yang belum ada di map
    // CATATAN PENTING: `l.borrowedBy` adalah ID User/Petugas yang melayani peminjaman,
    // BUKAN ID Member! Jangan pernah meminta detail member untuk borrowedBy.
    const missingMemberIds = new Set<string>();
    for (const l of loans) {
      if (!l.memberName && l.memberId && l.memberId !== "-") {
        const cleanMid = l.memberId.trim();
        const cacheKey = `${companyId}:${cleanMid.toLowerCase()}`;
        if (
          !memberMap.has(cleanMid) &&
          !memberMap.has(cleanMid.toLowerCase()) &&
          !officeInvalidMemberIds.has(cacheKey)
        ) {
          if (/^[0-9a-fA-F]{24}$/.test(cleanMid)) {
            missingMemberIds.add(cleanMid);
          }
        }
      }
    }

    // Fetch missing member details in parallel (maksimal 10 panggilan)
    if (missingMemberIds.size > 0) {
      const idsToFetch = Array.from(missingMemberIds).slice(0, 10);
      await Promise.allSettled(
        idsToFetch.map(async (mId) => {
          const cacheKey = `${companyId}:${mId.toLowerCase()}`;
          try {
            const m = await getOfficeMemberDetailApi(companyId, mId);
            if (m && m.name) {
              memberMap.set(mId, m);
              memberMap.set(mId.toLowerCase(), m);
              if (m.id) {
                memberMap.set(m.id, m);
                memberMap.set(m.id.toLowerCase(), m);
              }
            } else {
              officeInvalidMemberIds.add(cacheKey);
            }
          } catch {
            // Member detail 404 (misal data dummy atau member terhapus)
            // Catat ke cache negatif agar tidak melakukan request 404 berulang kali
            officeInvalidMemberIds.add(cacheKey);
          }
        })
      );
    }

    // Pasangkan data member dan nama petugas ke setiap loan
    for (const l of loans) {
      const foundMember =
        memberMap.get(l.memberId) ||
        memberMap.get(l.memberId?.toLowerCase());

      if (foundMember) {
        if (!l.memberName) {
          l.memberName = foundMember.name;
        }
        if (!l.memberNumber) {
          l.memberNumber = foundMember.memberNumber;
        }
      }

      // Pasangkan nama petugas jika tersedia di userMap
      if (l.borrowedBy && userMap.has(l.borrowedBy)) {
        l.officerName = userMap.get(l.borrowedBy) || l.officerName || "Petugas";
      } else if (l.borrowedBy && userMap.has(l.borrowedBy.toLowerCase())) {
        l.officerName = userMap.get(l.borrowedBy.toLowerCase()) || l.officerName || "Petugas";
      }
    }
  } catch {
    // Best-effort data augmentation, jangan throw jika gagal enrich
  }

  return loans;
}

export async function searchOfficeLoansApi(
  companyId: string,
  params: {
    status?: "ACTIVE" | "OVERDUE" | "COMPLETED";
    q?: string;
    loan_id?: string;
    member_id?: string;
    page?: number;
    size?: number;
    sortby?: string;
    order?: string;
    skipEnrich?: boolean;
    startDate?: string;
    endDate?: string;
    borrowed_from?: string;
    borrowed_to?: string;
    due_from?: string;
    due_to?: string;
    returned_from?: string;
    returned_to?: string;
  } = {}
): Promise<OfficeLoansListResponse> {
  const compId = companyId?.trim() || "";
  if (!compId) {
    throw new Error("Pilih instansi terlebih dahulu.");
  }
  const page = params.page || 1;
  const size = Math.min(100, Math.max(1, params.size || 10));
  const sortby = params.sortby;
  const order = params.order || "desc";

  // Hanya status ACTIVE, OVERDUE, COMPLETED yang didukung server
  let validStatus = params.status;
  if (validStatus && !["ACTIVE", "OVERDUE", "COMPLETED"].includes(validStatus)) {
    validStatus = undefined;
  }

  const rawQ = params.q?.trim() || "";
  const cleanQ = rawQ.toUpperCase().startsWith("TRX-")
    ? rawQ.replace(/^TRX-/i, "").trim()
    : rawQ;

  try {
    const response = await api.get("/office/loan/search", {
      params: {
        company_id: compId,
        status: validStatus || undefined,
        q: cleanQ || undefined,
        loan_id: params.loan_id?.trim() || undefined,
        member_id: params.member_id?.trim() || undefined,
        page,
        size,
        sortby,
        order,
        borrowed_from: params.borrowed_from || params.startDate || undefined,
        borrowed_to: params.borrowed_to || params.endDate || undefined,
        due_from: params.due_from || undefined,
        due_to: params.due_to || undefined,
        returned_from: params.returned_from || undefined,
        returned_to: params.returned_to || undefined,
      },
    });

    const raw = response.data;
    const rawItems = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
    const mapped: OfficeLoanItem[] = rawItems.map((l: any) => {
      const rawLoanItems = Array.isArray(l.items)
        ? l.items
        : Array.isArray(l.loan_items)
        ? l.loan_items
        : Array.isArray(l.details)
        ? l.details
        : [];

      const bookItems: OfficeLoanBookItem[] = rawLoanItems.map((it: any) => ({
        id: String(it._id || it.id || it.copy_id || it.book_copy_id || ""),
        bookId: String(it.book_id || it.bookId || it.book?._id || it.book?.id || ""),
        bookTitle: String(
          it.book_title ||
          it.bookTitle ||
          it.book?.title ||
          it.title ||
          "Buku Perpustakaan"
        ),
        bookCode: it.book_code || it.bookCode || it.book?.code || undefined,
        copyCode:
          it.copy_code ||
          it.copyCode ||
          it.book_copy?.code ||
          it.copy?.code ||
          it.code ||
          undefined,
        status: String(it.status || "BORROWED"),
      }));

      const finalCopyIds: string[] = Array.isArray(l.copy_id)
        ? l.copy_id.map(String)
        : Array.isArray(l.copy_ids)
        ? l.copy_ids.map(String)
        : [];
      if (finalCopyIds.length === 0 && bookItems.length > 0) {
        bookItems.forEach((b) => {
          if (b.id) finalCopyIds.push(b.id);
        });
      }
      if (bookItems.length === 0 && finalCopyIds.length > 0) {
        finalCopyIds.forEach((cid, idx) => {
          bookItems.push({
            id: cid,
            copyCode: cid.length > 12 ? `CP-${cid.slice(-6).toUpperCase()}` : cid,
            bookTitle: `Salinan Buku #${idx + 1}`,
          });
        });
      }

      return {
        id: String(l._id || l.id || ""),
        companyId: String(l.company_id || compId),
        loanNumber: formatCleanLoanNumber(l),
        rawLoanNumber: String(l.loan_number || l.code || l._id || l.id || ""),
        memberId: String(l.member_id || "-"),
        borrowedBy: String(l.borrowed_by || "-"),
        memberName:
          l.member?.name ||
          l.member_name ||
          l.memberName ||
          l.borrower_name ||
          undefined,
        memberNumber:
          l.member?.member_number ||
          l.member?.memberNumber ||
          l.member_number ||
          undefined,
        officerName:
          l.officer?.name ||
          l.officer_name ||
          l.officerName ||
          l.borrowed_by_name ||
          l.user?.name ||
          l.user_name ||
          l.userName ||
          l.created_by_name ||
          "-",
        borrowedAt: l.borrowed_at || "",
        dueAt: l.due_at || "",
        returnedAt: l.returned_at || undefined,
        status: (l.status || "ACTIVE") as "ACTIVE" | "OVERDUE" | "COMPLETED",
        notes: l.notes || undefined,
        createdAt: l.created_at || "",
        updatedAt: l.updated_at || undefined,
        copyIds: finalCopyIds,
        items: bookItems,
      };
    });

    const filterFromDate = (params?.startDate || params?.borrowed_from || "").slice(0, 10);
    const filterToDate = (params?.endDate || params?.borrowed_to || "").slice(0, 10);
    const filterDueFrom = (params?.due_from || "").slice(0, 10);
    const filterDueTo = (params?.due_to || "").slice(0, 10);
    const filterRetFrom = (params?.returned_from || "").slice(0, 10);
    const filterRetTo = (params?.returned_to || "").slice(0, 10);

    let filteredItems = mapped;
    if (filterFromDate || filterToDate || filterDueFrom || filterDueTo || filterRetFrom || filterRetTo) {
      filteredItems = filteredItems.filter((item) => {
        const itemBorrowed = (item.borrowedAt || item.createdAt || "").slice(0, 10);
        if (filterFromDate && itemBorrowed && itemBorrowed < filterFromDate) return false;
        if (filterToDate && itemBorrowed && itemBorrowed > filterToDate) return false;
        const itemDue = (item.dueAt || "").slice(0, 10);
        if (filterDueFrom && itemDue && itemDue < filterDueFrom) return false;
        if (filterDueTo && itemDue && itemDue > filterDueTo) return false;
        const itemRet = (item.returnedAt || "").slice(0, 10);
        if (filterRetFrom && itemRet && itemRet < filterRetFrom) return false;
        if (filterRetTo && itemRet && itemRet > filterRetTo) return false;
        return true;
      });
    }

    const enrichedItems = params.skipEnrich
      ? filteredItems
      : await enrichOfficeLoansWithMembers(compId, filteredItems);

    const total = Number(raw?.total !== undefined ? raw.total : enrichedItems.length);
    const totalPages = total > 0 ? Math.ceil(total / size) : 1;

    return {
      items: enrichedItems,
      total,
      page,
      size,
      totalPages,
    };
  } catch (err: any) {
    throw new Error(formatApiError(err, "Gagal memuat daftar peminjaman office."));
  }
}

// =========================================================
// COMPANY SETTINGS & POLICIES API
// =========================================================

export async function getCompanySettingsApi(
  companyId?: string
): Promise<(CompanySettings & { isConfigured: true }) | null> {
  const auth = getAuthData();
  const isSuperAdmin = auth?.user?.role === "SUPER_ADMIN";

  let response;
  try {
    if (isSuperAdmin && companyId) {
      response = await api.get("/office/company/config", { params: { company_id: companyId } });
    } else {
      response = await api.get("/company/config");
    }
  } catch (err: unknown) {
    const error = err as { response?: { status?: number; data?: { detail?: string } } };
    if (error.response?.status === 404) {
      return null;
    }
    throw err;
  }

  const raw = response.data;
  const data = raw?.data || raw || {};
  const defaultLoanDuration = data.default_loan_duration ?? data.defaultLoanDuration;
  const maxActiveLoans = data.max_active_loans ?? data.maxActiveLoans;
  const dailyFineRate = data.late_fee_per_day ?? data.dailyFineRate;
  if (
    defaultLoanDuration == null ||
    maxActiveLoans == null ||
    dailyFineRate == null ||
    !Number.isFinite(Number(defaultLoanDuration)) ||
    !Number.isFinite(Number(maxActiveLoans)) ||
    !Number.isFinite(Number(dailyFineRate))
  ) {
    throw new Error("Konfigurasi kebijakan peminjaman dari server tidak lengkap.");
  }

  return {
    id: String(data.id || companyId || ""),
    companyId: String(data.company_id || data.companyId || companyId || ""),
    defaultLoanDuration: Number(defaultLoanDuration),
    maxActiveLoans: Number(maxActiveLoans),
    dailyFineRate: Number(dailyFineRate),
    allowRenewal: true,
    maxRenewals: 1,
    dateFormat: "YYYY-MM-DD",
    timezone: "Asia/Jakarta",
    createdAt: data.created_at || "",
    updatedAt: data.updated_at || data.created_at || "",
    isConfigured: true,
  };
}

export async function updateCompanySettingsApi(
  companyId: string,
  payload: Partial<CompanySettings>
): Promise<CompanySettings> {
  const auth = getAuthData();
  const isSuperAdmin = auth?.user?.role === "SUPER_ADMIN";

  if (payload.defaultLoanDuration === undefined || payload.maxActiveLoans === undefined || payload.dailyFineRate === undefined) {
    throw new Error("Durasi peminjaman, batas pinjaman aktif, dan denda harian wajib diisi lengkap.");
  }

  const body = {
    default_loan_duration: Number(payload.defaultLoanDuration),
    max_active_loans: Number(payload.maxActiveLoans),
    late_fee_per_day: Number(payload.dailyFineRate),
  };

  let response;
  try {
    if (isSuperAdmin && companyId) {
      response = await api.put("/office/company/config", body, { params: { company_id: companyId } });
    } else {
      response = await api.put("/company/config", body);
    }
  } catch (err: unknown) {
    const error = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
    const detailMsg = error.response?.data?.detail || error.response?.data?.message;
    throw new Error(detailMsg || formatApiError(err, "Gagal menyimpan konfigurasi kebijakan."));
  }

  const raw = response.data;
  const data = raw?.data || raw || {};

  return {
    id: String(data.id || companyId || ""),
    companyId: String(data.company_id || data.companyId || companyId || ""),
    defaultLoanDuration: Number(data.default_loan_duration ?? body.default_loan_duration),
    maxActiveLoans: Number(data.max_active_loans ?? body.max_active_loans),
    dailyFineRate: Number(data.late_fee_per_day ?? body.late_fee_per_day),
    allowRenewal: true,
    maxRenewals: 1,
    dateFormat: "YYYY-MM-DD",
    timezone: "Asia/Jakarta",
    createdAt: data.created_at || "",
    updatedAt: data.updated_at || data.created_at || "",
  };
}
