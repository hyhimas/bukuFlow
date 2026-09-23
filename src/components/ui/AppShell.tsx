"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loginApi, logoutApi } from "@/lib/api";
import {
  clearAuthData,
  getAuthData,
  saveAuthData,
  subscribeSession,
  type AuthSession,
} from "@/lib/auth";

import Sidebar from "@/components/ui/Sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  // State Timer & Modals
  const [remainingSeconds, setRemainingSeconds] = useState(3600);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  // State Relogin Modal (Perpanjang Sesi)
  const [showReloginModal, setShowReloginModal] = useState(false);
  const [reloginPassword, setReloginPassword] = useState("");
  const [reloginLoading, setReloginLoading] = useState(false);
  const [reloginError, setReloginError] = useState("");

  // 1. Guard & Auth Initialization
  useEffect(() => {
    if (isLoginPage) {
      setAuthSession(null);
      setShowExpiredModal(false);
      setIsReady(true);
      return;
    }

    const session = getAuthData();
    if (!session) {
      setAuthSession(null);
      router.replace("/login");
      return;
    }

    setAuthSession(session);
    setShowExpiredModal(false);
    setIsReady(true);

    // Multi-tab listener
    const unsubscribe = subscribeSession(() => {
      if (isLoginPage) return;
      const current = getAuthData();
      if (!current) {
        setAuthSession(null);
        setShowExpiredModal(true);
      } else {
        setAuthSession(current);
        setShowExpiredModal(false);
      }
    });

    return () => unsubscribe();
  }, [isLoginPage, router]);

  // 2. Countdown Timer Logic (MM:SS)
  useEffect(() => {
    if (isLoginPage || !authSession) return;

    const expireTime = new Date(authSession.expiresAt).getTime();
    if (isNaN(expireTime)) return;

    const initialDiff = Math.max(0, Math.floor((expireTime - Date.now()) / 1000));
    setRemainingSeconds(initialDiff);

    if (initialDiff <= 0) {
      setAuthSession(null);
      clearAuthData();
      setShowExpiredModal(true);
      return;
    } else {
      setShowExpiredModal(false);
    }

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((expireTime - Date.now()) / 1000));
      setRemainingSeconds(diff);

      // Munculkan modal ketika sesi habis (00:00)
      if (diff <= 0) {
        clearInterval(interval);
        setAuthSession(null);
        clearAuthData();
        setShowExpiredModal(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoginPage, authSession]);

  // Format detik menjadi MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // 3. Handle Relogin (Perpanjang Sesi)
  async function handleReloginSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authSession) return;

    setReloginLoading(true);
    setReloginError("");

    try {
      const response = await loginApi(
        authSession.user.email || "",
        reloginPassword
      );
      const user = response.data;

      // Update session dengan token baru & reset 60 menit
      saveAuthData({
        accessToken: response.access_token,
        tokenType: response.token_type,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.email,
          role: user.role,
          companyId: user.companyId || "company-001",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      setShowReloginModal(false);
      setReloginPassword("");
    } catch (err: any) {
      setReloginError(
        err.response?.data?.detail || err.message || "Password salah."
      );
    } finally {
      setReloginLoading(false);
    }
  }

  // Handle Pengalihan ke Login saat Expired
  function handleGoToLogin() {
    setShowExpiredModal(false);
    setAuthSession(null);
    clearAuthData();
    router.replace("/login");
  }

  // Handle Keyboard Escape saat Expired Modal Muncul
  useEffect(() => {
    if (!showExpiredModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleGoToLogin();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showExpiredModal]);

  // Jika halaman login atau belum siap
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // Visual State indicator berdasarkan sisa waktu
  const isCritical = remainingSeconds <= 60; // <= 1 menit
  const isWarning = remainingSeconds <= 300 && !isCritical; // <= 5 menit

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      {/* HEADER UTAMA */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        {/* Sisi Kiri: Menu & Logo */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka menu navigasi"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <MenuIcon />
          </button>
          <span className="ml-3 text-xl font-bold text-slate-900">BukuFlow</span>
        </div>

        {/* Sisi Kanan: Modern Clean Session Indicator */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Badge / Pill Sesi */}
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              isCritical
                ? "border border-rose-200 bg-rose-50 text-rose-700 animate-pulse"
                : isWarning
                ? "border border-amber-200 bg-amber-50 text-amber-800"
                : "border border-blue-100 bg-blue-50/70 text-blue-700"
            }`}
          >
            {isCritical || isWarning ? (
              <WarningIcon />
            ) : (
              <ClockIcon />
            )}
            <span className="tabular-nums">
              {isCritical || isWarning ? (
                <>
                  <span className="hidden sm:inline">Sesi berakhir dalam </span>
                  <span className="sm:hidden">Sisa </span>
                  <strong className="font-semibold font-mono">{formatTimer(remainingSeconds)}</strong>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Sesi aktif · </span>
                  <strong className="font-semibold font-mono">{formatTimer(remainingSeconds)}</strong>
                </>
              )}
            </span>
          </div>

          {/* Tombol Perpanjang (Clean Outline) */}
          <button
            type="button"
            onClick={() => setShowReloginModal(true)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Perpanjang
          </button>
        </div>
      </div>

      {/* MODAL 1: SESI TELAH BERAKHIR (Saat 00:00) */}
      {showExpiredModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={handleGoToLogin}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-7 shadow-2xl text-center cursor-default"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
              <LockIcon />
            </div>

            <h3 className="text-lg font-bold text-slate-900 sm:text-xl">
              Sesi Anda telah berakhir
            </h3>

            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Sesi Anda berakhir karena tidak ada aktivitas. Silakan masuk kembali untuk melanjutkan.
            </p>

            <div className="mt-6">
              <button
                type="button"
                autoFocus
                onClick={handleGoToLogin}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Masuk Kembali
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RELOGIN (INPUT PASSWORD UNTUK PERPANJANG SESI) */}
      {showReloginModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-7 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Perpanjang Sesi Login</h3>
            <p className="mt-1 text-sm text-slate-500">
              Masukkan password akun <strong>{authSession?.user.email}</strong> untuk memperpanjang waktu sesi menjadi 60 menit.
            </p>

            <form onSubmit={handleReloginSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  value={reloginPassword}
                  onChange={(e) => setReloginPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  required
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {reloginError && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200"
                >
                  {reloginError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  disabled={reloginLoading}
                  onClick={() => {
                    setShowReloginModal(false);
                    setReloginError("");
                    setReloginPassword("");
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={reloginLoading || !reloginPassword}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {reloginLoading ? "Memverifikasi..." : "Perpanjang Sesi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIDEBAR OVERLAY */}
      <Sidebar
        open={sidebarOpen}
        mobile={true}
        onToggle={() => setSidebarOpen((current) => !current)}
        onClose={() => setSidebarOpen(false)}
      />

      {/* KONTEN UTAMA */}
      <main className="min-h-screen min-w-0">{children}</main>
    </div>
  );
}

// ----------------------------------------------------
// ICONS
// ----------------------------------------------------

function ClockIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className="h-7 w-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}