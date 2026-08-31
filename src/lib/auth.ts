import type { User } from "./types";

const SESSION_KEY = "bukuflow_session";

export interface Session {
  user: User;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") {
    return null;
  }

  const session = localStorage.getItem(SESSION_KEY);

  if (!session) {
    return null;
  }

  try {
    return JSON.parse(session) as Session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function setSession(user: User): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ user }),
  );
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(SESSION_KEY);
}