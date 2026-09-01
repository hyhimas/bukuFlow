"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import {
  clearSession,
  getSession,
  subscribeSession,
} from "@/lib/auth";
import { resetMockData } from "@/lib/mock-store";

interface AppHeaderProps {
  subtitle?: string;
}

export default function AppHeader({
  subtitle,
}: AppHeaderProps) {
  const router = useRouter();

  const session = useSyncExternalStore(
    subscribeSession,
    getSession,
    () => null,
  );

  function handleLogout() {
    resetMockData();
    clearSession();
    router.replace("/login");
  }

  const user = session?.user;

  return (
    <header className="border-b border-app-border bg-app-surface">
      <div className="page-container flex min-h-18 items-center justify-between gap-4 py-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-app-text">
            BukuFlow
          </h1>

          {subtitle ? (
            <p className="text-sm text-app-text-muted">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-app-text">
                {user.name}
              </p>

              <p className="text-xs text-app-text-muted">
                {user.role === "COMPANY_ADMIN"
                  ? "Admin Company"
                  : user.role === "STAFF"
                    ? "Petugas"
                    : user.role}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            className="min-h-11 rounded-app border border-app-border px-3 py-2 text-sm font-medium text-app-text transition hover:bg-neutral-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Keluar
          </button>
        </div>
      </div>
    </header>
  );
}
