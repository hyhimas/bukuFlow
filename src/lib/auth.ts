import type { User } from "./types";

const SESSION_KEY = "bukuflow_session";
let cachedRawSession: string | null | undefined;
let cachedSession: Session | null = null;
const sessionSubscribers = new Set<() => void>();
let isStorageListenerAttached = false;

export interface Session {
  user: User;
}

function updateCachedSession(rawSession: string | null) {
  if (cachedRawSession === rawSession) {
    return;
  }

  cachedRawSession = rawSession;

  if (!rawSession) {
    cachedSession = null;
    return;
  }

  try {
    cachedSession = JSON.parse(rawSession) as Session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    cachedRawSession = null;
    cachedSession = null;
  }
}

function notifySessionSubscribers() {
  sessionSubscribers.forEach((subscriber) => subscriber());
}

function handleStorageChange(event: StorageEvent) {
  if (event.key !== SESSION_KEY && event.key !== null) {
    return;
  }

  updateCachedSession(event.key === null ? null : event.newValue);
  notifySessionSubscribers();
}

export function getSessionSnapshot(): Session | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = localStorage.getItem(SESSION_KEY);

  if (cachedRawSession !== rawSession) {
    updateCachedSession(rawSession);
  }

  return cachedSession;
}

export function getServerSessionSnapshot(): Session | null {
  return null;
}

export function subscribeSession(subscriber: () => void) {
  sessionSubscribers.add(subscriber);

  if (typeof window !== "undefined" && !isStorageListenerAttached) {
    window.addEventListener("storage", handleStorageChange);
    isStorageListenerAttached = true;
  }

  return () => {
    sessionSubscribers.delete(subscriber);

    if (typeof window !== "undefined" && sessionSubscribers.size === 0) {
      window.removeEventListener("storage", handleStorageChange);
      isStorageListenerAttached = false;
    }
  };
}

export function getSession(): Session | null {
  return getSessionSnapshot();
}

export function setSession(user: User): void {
  if (typeof window === "undefined") {
    return;
  }

  const rawSession = JSON.stringify({ user });
  localStorage.setItem(SESSION_KEY, rawSession);
  updateCachedSession(rawSession);
  notifySessionSubscribers();
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(SESSION_KEY);
  updateCachedSession(null);
  notifySessionSubscribers();
}
