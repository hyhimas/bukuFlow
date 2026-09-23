import type { User } from "./types";

// 1. Konstanta Kunci Penyimpanan sesuai Spesifikasi
export const AUTH_KEYS = {
  ACCESS_TOKEN: "access_token",
  TOKEN_TYPE: "token_type",
  AUTH_USER: "auth_user",
  AUTH_LOGIN_AT: "auth_login_at",
  AUTH_EXPIRES_AT: "auth_expires_at",
  LEGACY_SESSION: "bukuflow_session",
} as const;

export interface AuthSession {
  accessToken: string;
  tokenType: string;
  user: User;
  loginAt: string;
  expiresAt: string;
}

export interface Session {
  user: User;
  token?: string;
  expiresAt?: number;
}

const subscribers = new Set<() => void>();
let isStorageListenerAttached = false;

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

function handleStorageEvent(event: StorageEvent) {
  if (
    event.key === AUTH_KEYS.ACCESS_TOKEN ||
    event.key === AUTH_KEYS.AUTH_EXPIRES_AT ||
    event.key === AUTH_KEYS.AUTH_USER ||
    event.key === null
  ) {
    notifySubscribers();
  }
}

/**
 * Menyimpan seluruh data auth ke localStorage (5 key standar) & cookie untuk Next.js
 */
export function saveAuthData(params: {
  accessToken: string;
  tokenType?: string;
  user: User;
  loginAt?: string;
  expiresAt?: string;
}): void {
  if (typeof window === "undefined") return;

  const loginAt = params.loginAt || new Date().toISOString();
  // Expiry standar: 1 jam dari sekarang
  const expiresAt =
    params.expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const tokenType = (params.tokenType || "Bearer").trim();

  localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, params.accessToken);
  localStorage.setItem(AUTH_KEYS.TOKEN_TYPE, tokenType);
  localStorage.setItem(AUTH_KEYS.AUTH_USER, JSON.stringify(params.user));
  localStorage.setItem(AUTH_KEYS.AUTH_LOGIN_AT, loginAt);
  localStorage.setItem(AUTH_KEYS.AUTH_EXPIRES_AT, expiresAt);

  // Bersihkan data legacy jika ada
  localStorage.removeItem(AUTH_KEYS.LEGACY_SESSION);

  // Cookie 1 jam untuk Next.js middleware
  document.cookie = `bukuflow_session=true; path=/; max-age=3600; SameSite=Lax`;

  notifySubscribers();
}

export function getAuthData(): AuthSession | null {
  if (typeof window === "undefined") return null;

  const accessToken = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
  const tokenType = localStorage.getItem(AUTH_KEYS.TOKEN_TYPE) || "Bearer";
  const rawUser = localStorage.getItem(AUTH_KEYS.AUTH_USER);
  const loginAt = localStorage.getItem(AUTH_KEYS.AUTH_LOGIN_AT);
  const expiresAt = localStorage.getItem(AUTH_KEYS.AUTH_EXPIRES_AT);

  // Validasi kelengkapan data
  if (!accessToken || !rawUser || !expiresAt) {
    if (accessToken || rawUser || expiresAt) {
      clearAuthData(); // Data tidak lengkap/rusak
    }
    return null;
  }

  // Validasi parse user
  let user: User;
  try {
    user = JSON.parse(rawUser) as User;
  } catch {
    clearAuthData();
    return null;
  }

  // Validasi expiry
  const expireTimestamp = new Date(expiresAt).getTime();
  if (isNaN(expireTimestamp) || Date.now() >= expireTimestamp) {
    clearAuthData();
    return null;
  }

  // Pastikan cookie middleware selalu sinkron dengan token localStorage
  if (
    typeof document !== "undefined" &&
    !document.cookie.includes("bukuflow_session=true")
  ) {
    document.cookie = `bukuflow_session=true; path=/; max-age=3600; SameSite=Lax`;
  }

  return {
    accessToken,
    tokenType,
    user,
    loginAt: loginAt || new Date().toISOString(),
    expiresAt,
  };
}

export function clearAuthData(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(AUTH_KEYS.TOKEN_TYPE);
  localStorage.removeItem(AUTH_KEYS.AUTH_USER);
  localStorage.removeItem(AUTH_KEYS.AUTH_LOGIN_AT);
  localStorage.removeItem(AUTH_KEYS.AUTH_EXPIRES_AT);
  localStorage.removeItem(AUTH_KEYS.LEGACY_SESSION);

  document.cookie = "bukuflow_session=; path=/; max-age=0";

  notifySubscribers();
}

export function getAccessToken(): string | null {
  return getAuthData()?.accessToken || null;
}

export function getTokenType(): string {
  if (typeof window === "undefined") return "Bearer";
  return localStorage.getItem(AUTH_KEYS.TOKEN_TYPE) || "Bearer";
}

export function getAuthUser(): User | null {
  return getAuthData()?.user || null;
}

export function getAuthExpiresAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_KEYS.AUTH_EXPIRES_AT);
}

export function getSession(): Session | null {
  const auth = getAuthData();
  if (!auth) return null;
  return {
    user: auth.user,
    token: auth.accessToken,
    expiresAt: new Date(auth.expiresAt).getTime(),
  };
}

export function setSession(
  user: User,
  token?: string,
  tokenType?: string,
): void {
  if (!token) return;
  saveAuthData({
    accessToken: token,
    tokenType: tokenType || "Bearer",
    user,
  });
}

export function getToken(): string | null {
  return getAccessToken();
}

export function clearSession(): void {
  clearAuthData();
}

export function subscribeSession(subscriber: () => void) {
  subscribers.add(subscriber);

  if (typeof window !== "undefined" && !isStorageListenerAttached) {
    window.addEventListener("storage", handleStorageEvent);
    isStorageListenerAttached = true;
  }

  return () => {
    subscribers.delete(subscriber);
    if (typeof window !== "undefined" && subscribers.size === 0) {
      window.removeEventListener("storage", handleStorageEvent);
      isStorageListenerAttached = false;
    }
  };
}
