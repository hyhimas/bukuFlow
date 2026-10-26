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

// Snapshot caching to satisfy useSyncExternalStore referential stability
let cachedAuthData: AuthSession | null = null;
let lastAccessToken: string | null = null;
let lastTokenType: string | null = null;
let lastRawUser: string | null = null;
let lastLoginAt: string | null = null;
let lastExpiresAt: string | null = null;

let cachedSession: Session | null = null;
let cachedSessionAuthRef: AuthSession | null = null;

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

function invalidateCache() {
  cachedAuthData = null;
  lastAccessToken = null;
  lastTokenType = null;
  lastRawUser = null;
  lastLoginAt = null;
  lastExpiresAt = null;
  cachedSession = null;
  cachedSessionAuthRef = null;
}

function handleStorageEvent(event: StorageEvent) {
  if (
    event.key === AUTH_KEYS.ACCESS_TOKEN ||
    event.key === AUTH_KEYS.AUTH_EXPIRES_AT ||
    event.key === AUTH_KEYS.AUTH_USER ||
    event.key === AUTH_KEYS.AUTH_LOGIN_AT ||
    event.key === AUTH_KEYS.TOKEN_TYPE ||
    event.key === null
  ) {
    invalidateCache();
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

  // Invalidate cache agar snapshot baru tercipta
  invalidateCache();

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
    if (cachedAuthData !== null) {
      invalidateCache();
    }
    return null;
  }

  // Validasi expiry
  const expireTimestamp = new Date(expiresAt).getTime();
  if (isNaN(expireTimestamp) || Date.now() >= expireTimestamp) {
    if (cachedAuthData !== null) {
      invalidateCache();
    }
    return null;
  }

  // Jika nilai raw dari localStorage tidak berubah dan cache sudah ada, kembalikan objek cache yang sama
  if (
    cachedAuthData !== null &&
    accessToken === lastAccessToken &&
    tokenType === lastTokenType &&
    rawUser === lastRawUser &&
    loginAt === lastLoginAt &&
    expiresAt === lastExpiresAt
  ) {
    return cachedAuthData;
  }

  // Validasi parse user
  let user: User;
  try {
    user = JSON.parse(rawUser) as User;
  } catch {
    invalidateCache();
    return null;
  }

  lastAccessToken = accessToken;
  lastTokenType = tokenType;
  lastRawUser = rawUser;
  lastLoginAt = loginAt;
  lastExpiresAt = expiresAt;

  // Pastikan cookie middleware selalu sinkron dengan token localStorage
  if (
    typeof document !== "undefined" &&
    !document.cookie.includes("bukuflow_session=true")
  ) {
    document.cookie = `bukuflow_session=true; path=/; max-age=3600; SameSite=Lax`;
  }

  cachedAuthData = {
    accessToken,
    tokenType,
    user,
    loginAt: loginAt || new Date().toISOString(),
    expiresAt,
  };

  return cachedAuthData;
}

export function clearAuthData(): void {
  if (typeof window === "undefined") return;

  invalidateCache();

  localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(AUTH_KEYS.TOKEN_TYPE);
  localStorage.removeItem(AUTH_KEYS.AUTH_USER);
  localStorage.removeItem(AUTH_KEYS.AUTH_LOGIN_AT);
  localStorage.removeItem(AUTH_KEYS.AUTH_EXPIRES_AT);
  localStorage.removeItem(AUTH_KEYS.LEGACY_SESSION);
  localStorage.removeItem("bukuflow_office_selected_company_id");

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

export function isStoredSessionExpired(): boolean {
  if (typeof window === "undefined") return false;
  const expiresAt = localStorage.getItem(AUTH_KEYS.AUTH_EXPIRES_AT);
  const accessToken = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
  if (!accessToken || !expiresAt) return false;
  const expireTimestamp = new Date(expiresAt).getTime();
  return !isNaN(expireTimestamp) && Date.now() >= expireTimestamp;
}

export function markSessionExpired(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTH_KEYS.AUTH_EXPIRES_AT, new Date(0).toISOString());
    invalidateCache();
    notifySubscribers();
  } catch {}
}

export function hasStoredAuth(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN) &&
      localStorage.getItem(AUTH_KEYS.AUTH_USER)
  );
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const rawUser = localStorage.getItem(AUTH_KEYS.AUTH_USER);
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser) as User;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  const auth = getAuthData();
  if (!auth) {
    if (cachedSession !== null) {
      cachedSession = null;
      cachedSessionAuthRef = null;
    }
    return null;
  }

  // Jika referensi auth tidak berubah, kembalikan session cache yang sama
  if (cachedSession !== null && cachedSessionAuthRef === auth) {
    return cachedSession;
  }

  cachedSessionAuthRef = auth;
  cachedSession = {
    user: auth.user,
    token: auth.accessToken,
    expiresAt: new Date(auth.expiresAt).getTime(),
  };

  return cachedSession;
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
