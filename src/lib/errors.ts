/**
 * Central Error Handling Module for bukuFlow
 * 
 * Memetakan error backend (Axios, Network, HTTP Status, Pydantic 422) ke pesan
 * ramah pengguna berbahasa Indonesia yang aman tanpa membocorkan pesan mentah
 * Axios, string JSON teknis, atau trace 500 backend.
 */

interface AxiosErrorLike {
  response?: {
    status?: number;
    data?: {
      detail?: unknown;
      message?: unknown;
      [key: string]: unknown;
    };
  };
  request?: unknown;
  config?: {
    url?: string;
    [key: string]: unknown;
  };
  message?: string;
  code?: string;
  stack?: string;
}

// Kamus pemetaan nama field backend (snake_case) ke label bahasa Indonesia yang ramah pengguna
export const FIELD_LABELS: Record<string, string> = {
  member_number: "Nomor anggota",
  member_code: "Kode anggota",
  password: "Kata sandi",
  old_password: "Kata sandi lama",
  new_password: "Kata sandi baru",
  confirm_password: "Konfirmasi kata sandi",
  email: "Email",
  name: "Nama",
  full_name: "Nama lengkap",
  username: "Username",
  title: "Judul",
  author: "Penulis",
  publisher: "Penerbit",
  isbn: "ISBN",
  barcode: "Barcode",
  stock: "Stok",
  total_copies: "Jumlah eksemplar",
  category: "Kategori",
  category_id: "Kategori",
  published_year: "Tahun terbit",
  publication_year: "Tahun terbit",
  identity_number: "Nomor identitas (KTP/NIM/NIS)",
  phone: "Nomor telepon",
  phone_number: "Nomor telepon",
  address: "Alamat",
  role: "Peran",
  company_id: "Instansi",
  institution_name: "Nama instansi",
  loan_date: "Tanggal pinjam",
  due_date: "Tanggal jatuh tempo",
  return_date: "Tanggal kembali",
  notes: "Catatan",
  duration_days: "Durasi peminjaman",
  max_active_loans: "Batas peminjaman aktif",
  daily_fine: "Tarif denda harian",
  items: "Daftar buku",
  book_id: "Buku",
  member_id: "Anggota",
  user_id: "Pengguna",
  status: "Status",
};

/**
 * Menerjemahkan pesan validasi bawaan Pydantic/FastAPI ke bahasa Indonesia.
 */
export function translateValidationMsg(msg: string): string {
  if (!msg || typeof msg !== "string") return "tidak valid";
  const trimmed = msg.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "field required" || lower === "field is required") {
    return "wajib diisi";
  }
  if (lower.includes("value is not a valid email address") || lower.includes("not a valid email")) {
    return "format email tidak valid";
  }
  if (lower.includes("string should have at least") || lower.includes("at least")) {
    const match = trimmed.match(/at least\s+(\d+)/i);
    return match ? `minimal ${match[1]} karakter` : "terlalu pendek";
  }
  if (lower.includes("string should have at most") || lower.includes("at most")) {
    const match = trimmed.match(/at most\s+(\d+)/i);
    return match ? `maksimal ${match[1]} karakter` : "terlalu panjang";
  }
  if (lower.includes("input should be a valid integer") || lower.includes("valid integer")) {
    return "harus berupa angka bulat yang valid";
  }
  if (lower.includes("input should be a valid number") || lower.includes("valid number")) {
    return "harus berupa angka yang valid";
  }
  if (lower.includes("greater than or equal to")) {
    const match = trimmed.match(/greater than or equal to\s+(\d+)/i);
    return match ? `minimal ${match[1]}` : "nilai terlalu kecil";
  }
  if (lower.includes("less than or equal to")) {
    const match = trimmed.match(/less than or equal to\s+(\d+)/i);
    return match ? `maksimal ${match[1]}` : "nilai terlalu besar";
  }
  if (lower === "invalid credentials" || lower === "incorrect email or password") {
    return "email atau kata sandi salah";
  }
  return trimmed;
}

/**
 * Memeriksa apakah string adalah potongan/dokumen HTML (misalnya error page dari proxy Nginx/Cloudflare).
 */
export function isHtmlString(str: string): boolean {
  if (typeof str !== "string") return false;
  return /<\/?[a-z][\s\S]*>/i.test(str) || /<!doctype/i.test(str);
}

/**
 * Memeriksa apakah string merupakan format JSON mentah.
 */
export function isJsonString(str: string): boolean {
  if (typeof str !== "string") return false;
  const trimmed = str.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Memeriksa apakah teks adalah pesan teknis mentah Axios/Server.
 */
export function isRawAxiosNoise(str: string): boolean {
  if (typeof str !== "string") return false;
  const lower = str.toLowerCase();
  return (
    lower.includes("request failed with status code") ||
    lower.includes("network error") ||
    lower.includes("axioserror") ||
    lower.includes("econnrefused") ||
    lower.includes("econnaborted") ||
    lower.includes("internal server error") ||
    lower.includes("server error (") ||
    lower.includes("bad gateway") ||
    lower.includes("service unavailable") ||
    lower.includes("gateway timeout") ||
    lower.includes("status code")
  );
}

/**
 * Fungsi pusat untuk menghasilkan pesan error ramah pengguna.
 * 
 * Aturan pemetaan:
 * - Tanpa respons/timeout/CORS/offline -> "Tidak dapat terhubung ke server. Periksa koneksi Anda, lalu coba lagi."
 * - 403 -> "Anda tidak memiliki izin untuk aksi ini."
 * - 404 -> "Data tidak ditemukan."
 * - 400/409 dengan detail berupa kalimat biasa (bukan JSON, panjang < 200 karakter) -> tampilkan detail
 * - 422 (detail berupa daftar {loc, msg}) -> kalimat per field dengan pemetaan label
 * - 429 -> "Terlalu banyak permintaan. Coba lagi sebentar lagi."
 * - 502/503/504 -> "Server sedang tidak dapat dihubungi. Coba lagi beberapa saat lagi."
 * - 500 / > 500 -> "Terjadi kesalahan pada server. Coba lagi, atau hubungi administrator jika berlanjut."
 * - Selain itu -> fallback
 * 
 * Catatan Keamanan:
 * - Status, body, dan stack hanya dicatat ke console.error.
 * - Body non-JSON atau HTML (halaman proxy) TIDAK PERNAH ditampilkan ke antarmuka.
 */
export function getErrorMessage(
  error: unknown,
  fallback: string = "Terjadi kesalahan pada sistem. Silakan coba lagi."
): string {
  if (!error) return fallback;

  if (typeof error === "string") {
    const message = error.trim();
    if (!message || isHtmlString(message) || isJsonString(message)) return fallback;
    if (isRawAxiosNoise(message)) {
      if (/network|timeout|cors|connection/i.test(message)) {
        return "Tidak dapat terhubung ke server. Periksa koneksi Anda, lalu coba lagi.";
      }
      if (/bad gateway|service unavailable|gateway timeout/i.test(message)) {
        return "Server sedang tidak dapat dihubungi. Coba lagi beberapa saat lagi.";
      }
      return "Terjadi kesalahan pada server. Coba lagi, atau hubungi administrator jika berlanjut.";
    }
    return message;
  }

  // Catat detail teknis error HANYA ke console.error untuk kemudahan debugging developer
  try {
    const errObj = error as AxiosErrorLike | null | undefined;
    console.error("[API Error Detail]", {
      status: errObj?.response?.status,
      data: errObj?.response?.data,
      message: errObj?.message,
      code: errObj?.code,
      stack: errObj?.stack,
    });
  } catch {
    // Hindari crash pada lingkungan logging terbatas
  }

  const err = error as AxiosErrorLike | null | undefined;
  const response = err?.response;
  const status = response?.status;
  const data = response?.data;
  const detail = data?.detail;
  const message = data?.message;

  // 1. Tanpa respons / timeout / CORS / Network failure
  const isNetworkOrTimeout =
    !response &&
    (err?.request ||
      err?.code === "ECONNABORTED" ||
      err?.code === "ERR_NETWORK" ||
      err?.message?.toLowerCase().includes("timeout") ||
      err?.message?.toLowerCase().includes("network") ||
      err?.message?.toLowerCase().includes("cors") ||
      (typeof navigator !== "undefined" && !navigator.onLine));

  if (isNetworkOrTimeout) {
    return "Tidak dapat terhubung ke server. Periksa koneksi Anda, lalu coba lagi.";
  }

  // 2. HTTP Status-based mapping
  if (status === 401) {
    const reqUrl = err?.config?.url || "";
    if (
      reqUrl.includes("/auth/login") ||
      reqUrl.includes("/login") ||
      fallback.toLowerCase().includes("email") ||
      fallback.toLowerCase().includes("password")
    ) {
      return fallback || "Email atau password salah. Periksa kembali akun Anda.";
    }
    return "Sesi Anda telah berakhir. Silakan login kembali.";
  }

  if (status === 403) {
    return "Anda tidak memiliki izin untuk aksi ini.";
  }

  if (status === 404) {
    return "Data tidak ditemukan.";
  }

  if (status === 429) {
    return "Terlalu banyak permintaan. Coba lagi sebentar lagi.";
  }

  if (status === 502 || status === 503 || status === 504) {
    return "Server sedang tidak dapat dihubungi. Coba lagi beberapa saat lagi.";
  }

  if (status === 500 || (status && status > 500)) {
    return "Terjadi kesalahan pada server. Coba lagi, atau hubungi administrator jika berlanjut.";
  }

  // 3. HTTP 422 (detail berupa daftar {loc, msg})
  if (status === 422 || (Array.isArray(detail) && detail.length > 0)) {
    if (Array.isArray(detail)) {
      const fieldSentences: string[] = [];
      for (const item of detail) {
        if (!item) continue;
        const rawField = Array.isArray(item.loc)
          ? item.loc.filter((l: unknown) => l !== "body").pop()
          : "";
        const fieldKey = String(rawField || "").trim();
        const label = FIELD_LABELS[fieldKey] || (fieldKey ? fieldKey.replace(/_/g, " ") : "");
        const rawMsg = typeof item.msg === "string" ? item.msg : "";
        const translatedMsg = translateValidationMsg(rawMsg);

        if (label && translatedMsg) {
          fieldSentences.push(`${label}: ${translatedMsg}`);
        } else if (translatedMsg) {
          fieldSentences.push(translatedMsg);
        }
      }

      if (fieldSentences.length > 0) {
        return fieldSentences.join("; ") + ".";
      }
    }
    if (status === 422) {
      return "Data yang dikirim belum valid. Periksa kembali isian Anda.";
    }
  }

  // 4. HTTP 400 / 409 dengan detail berupa kalimat biasa (bukan JSON, panjang < 200 karakter)
  if (status === 400 || status === 409) {
    const detailObj =
      detail && typeof detail === "object"
        ? (detail as Record<string, unknown>)
        : null;
    const candidate =
      typeof detail === "string"
        ? detail
        : typeof message === "string"
        ? message
        : typeof detailObj?.message === "string"
        ? (detailObj.message as string)
        : typeof detailObj?.error === "string"
        ? (detailObj.error as string)
        : "";

    if (
      candidate &&
      !isHtmlString(candidate) &&
      !isJsonString(candidate) &&
      !isRawAxiosNoise(candidate) &&
      candidate.trim().length > 0 &&
      candidate.length < 200
    ) {
      return candidate.trim();
    }

    if (status === 409) {
      return "Data yang dimasukkan sudah ada atau terjadi konflik data.";
    }
    return fallback;
  }

  // 5. Cek apakah ada pesan teks biasa yang aman pada payload respons backend
  if (
    typeof detail === "string" &&
    !isHtmlString(detail) &&
    !isJsonString(detail) &&
    !isRawAxiosNoise(detail) &&
    detail.length < 200
  ) {
    return detail.trim();
  }
  if (
    typeof message === "string" &&
    !isHtmlString(message) &&
    !isJsonString(message) &&
    !isRawAxiosNoise(message) &&
    message.length < 200
  ) {
    return message.trim();
  }

  // 6. Jika error adalah instance Error yang sudah diformat aman (bukan Axios raw error)
  if (
    err instanceof Error &&
    err.message &&
    typeof err.message === "string" &&
    !isRawAxiosNoise(err.message) &&
    !isHtmlString(err.message) &&
    !isJsonString(err.message) &&
    err.message.length < 200 &&
    !response // Bukan Axios error mentah
  ) {
    return err.message;
  }

  return fallback;
}

/**
 * Mengembalikan peta field -> pesan error untuk form inline pada status 422.
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!error) return result;

  const err = error as AxiosErrorLike | null | undefined;
  const detail = err?.response?.data?.detail;

  if (Array.isArray(detail)) {
    for (const item of detail) {
      if (!item) continue;
      const rawField = Array.isArray(item.loc)
        ? item.loc.filter((l: unknown) => l !== "body").pop()
        : "";
      const fieldKey = String(rawField || "").trim();
      if (!fieldKey) continue;

      const label = FIELD_LABELS[fieldKey] || fieldKey.replace(/_/g, " ");
      const rawMsg = typeof item.msg === "string" ? item.msg : "";
      const translatedMsg = translateValidationMsg(rawMsg);

      if (!result[fieldKey]) {
        result[fieldKey] = `${label} ${translatedMsg}`;
      }
    }
  }

  return result;
}

/**
 * Alias formatApiError untuk kompatibilitas ke belakang dengan kode lama.
 */
export function formatApiError(
  error: unknown,
  defaultMessage: string = "Terjadi kesalahan pada sistem."
): string {
  return getErrorMessage(error, defaultMessage);
}

