"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { loginApi, logoutApi, getErrorMessage } from "@/lib/api";
import {
  clearAuthData,
  getAuthData,
  getStoredUser,
  hasStoredAuth,
  isStoredSessionExpired,
  saveAuthData,
  subscribeSession,
  type AuthSession,
} from "@/lib/auth";

import Sidebar from "@/components/ui/Sidebar";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import { useTheme } from "@/context/ThemeContext";
import LoadingState from "@/components/ui/LoadingState";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { getRouteAccess } from "@/lib/authorization";

interface AppShellProps {
  children: React.ReactNode;
}

function subscribeMobile(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(max-width: 1023px)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getIsMobileSnapshot() {
  return typeof window !== "undefined"
    ? window.matchMedia("(max-width: 1023px)").matches
    : false;
}

function getServerIsMobileSnapshot() {
  return false;
}

function useIsMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    getIsMobileSnapshot,
    getServerIsMobileSnapshot,
  );
}

const emptySubscribe = () => () => {};
const getTrueSnapshot = () => true;
const getFalseSnapshot = () => false;

function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/office/dashboard") return "Dashboard Office";
  if (pathname === "/office/companies") return "Manajemen Instansi";
  if (pathname === "/office/users") return "Pengguna Platform";
  if (pathname.startsWith("/office/books")) return "Inspeksi Katalog";
  if (pathname.startsWith("/office/loans")) return "Inspeksi Transaksi";
  if (pathname.startsWith("/office/members")) return "Inspeksi Anggota";
  if (pathname === "/loans/new") return "Peminjaman Buku";
  if (pathname.startsWith("/loans")) return "Peminjaman";
  if (pathname.startsWith("/returns")) return "Pengembalian";
  if (pathname.startsWith("/transactions")) return "Riwayat Transaksi";
  if (pathname.startsWith("/master/members")) return "Data Anggota";
  if (pathname.startsWith("/master/books")) return "Data Buku";
  if (pathname.startsWith("/settings/company")) return "Konfigurasi Instansi";
  if (pathname.startsWith("/settings/users")) return "Kelola Pengguna";
  if (pathname === "/profile") return "Profil Akun";
  return "BukuFlow";
}

export default function AppShell({ children }: AppShellProps) {
  useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  const isMobile = useIsMobile();
  const [sidebarOpenDesktop, setSidebarOpenDesktop] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("bukuflow_sidebar_desktop");
      if (stored !== null) return stored === "true";
    }
    return true;
  });
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const sidebarOpen = isMobile ? sidebarOpenMobile : sidebarOpenDesktop;
  const setSidebarOpen = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    if (isMobile) {
      setSidebarOpenMobile(val);
    } else {
      setSidebarOpenDesktop((prev) => {
        const next = typeof val === "function" ? val(prev) : val;
        try {
          localStorage.setItem("bukuflow_sidebar_desktop", String(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  }, [isMobile]);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showHeaderLogoutConfirm, setShowHeaderLogoutConfirm] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  const authSession = useSyncExternalStore(
    subscribeSession,
    getAuthData,
    () => null,
  );

  const [cachedSession, setCachedSession] = useState<AuthSession | null>(null);
  const [prevAuth, setPrevAuth] = useState<AuthSession | null>(null);
  if (authSession !== prevAuth) {
    setPrevAuth(authSession);
    if (authSession) {
      setCachedSession(authSession);
    }
  }
  const currentSession = authSession || cachedSession;

  const mounted = useSyncExternalStore(
    emptySubscribe,
    getTrueSnapshot,
    getFalseSnapshot,
  );

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setSidebarOpenMobile(false);
    setUserMenuOpen(false);
  }

  // Click outside and Escape for user menu
  useEffect(() => {
    if (!userMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userMenuOpen]);

  // Session Expired State
  const [isSessionExpired, setIsSessionExpired] = useState(() =>
    typeof window !== "undefined" ? isStoredSessionExpired() : false
  );
  const [expiredModalDismissed, setExpiredModalDismissed] = useState(false);

  // Sinkronisasi status sesi: Ketika user berhasil login / memperbarui sesi,
  // reset seluruh status expired agar modal tertutup dan timer berjalan normal
  useEffect(() => {
    if (authSession) {
      const exp = new Date(authSession.expiresAt).getTime();
      if (exp > Date.now()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Sinkronisasi reset modal expired saat sesi auth diperbarui
        setIsSessionExpired(false);
        setExpiredModalDismissed(false);
        setNow(Date.now());
      }
    }
  }, [authSession]);

  // Jika sedang di halaman login, pastikan status expired direset
  useEffect(() => {
    if (isLoginPage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset status sesi expired ketika membuka halaman login
      setIsSessionExpired(false);
      setExpiredModalDismissed(false);
      setCachedSession(null);
    }
  }, [isLoginPage]);

  // Centralized Route Access Guard
  const activeUser = currentSession?.user || (typeof window !== "undefined" ? getStoredUser() : null);
  const userRole = activeUser?.role;
  const routeAccess = !isLoginPage && userRole ? getRouteAccess(pathname, userRole) : { allowed: true, redirect: "" };

  // Auth Guard: Memastikan hanya user tanpa riwayat auth yang langsung diredirect ke login.
  // Jika sesi expired, modal sesi berakhir ditampilkan dan BUKAN force redirect mendadak!
  useEffect(() => {
    if (!mounted || isLoginPage) return;

    if (isSessionExpired || isStoredSessionExpired()) {
      if (!isSessionExpired && !expiredModalDismissed) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Tandai status expired saat token autentikasi di storage kedaluwarsa
        setIsSessionExpired(true);
      }
      return;
    }

    if (!authSession && !hasStoredAuth()) {
      router.replace("/login");
      return;
    }

    // Role-based route guard: jika role tidak diizinkan, arahkan ke target redirect
    if (userRole && !routeAccess.allowed && routeAccess.redirect) {
      router.replace(routeAccess.redirect);
    }
  }, [
    mounted,
    isLoginPage,
    authSession,
    isSessionExpired,
    expiredModalDismissed,
    userRole,
    routeAccess.allowed,
    routeAccess.redirect,
    router,
  ]);

  // Countdown Timer Logic
  useEffect(() => {
    if (isLoginPage || !currentSession) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoginPage, currentSession]);

  const expireTime = currentSession
    ? new Date(currentSession.expiresAt).getTime()
    : 0;
  const remainingSeconds = expireTime
    ? Math.max(0, Math.floor((expireTime - now) / 1000))
    : 0;

  // 1. Deteksi waktu sesi habis dari countdown (00:00) atau timestamp expired
  useEffect(() => {
    if (isLoginPage) return;
    if (isStoredSessionExpired() && !isSessionExpired && !expiredModalDismissed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Deteksi dan tandai sesi kedaluwarsa berdasarkan interval timer sekarang
      setIsSessionExpired(true);
    }
  }, [now, isLoginPage, isSessionExpired, expiredModalDismissed]);

  // 2. Deteksi event 401 dari backend API (Sesi dibatalkan / token expired)
  useEffect(() => {
    if (isLoginPage) return;

    const handleExpiredEvent = () => {
      if (!expiredModalDismissed) {
        setIsSessionExpired(true);
      }
    };

    window.addEventListener("bukuflow:session_expired", handleExpiredEvent);
    return () => {
      window.removeEventListener("bukuflow:session_expired", handleExpiredEvent);
    };
  }, [isLoginPage, expiredModalDismissed]);

  const showExpiredModal =
    !isLoginPage && (isSessionExpired || isStoredSessionExpired()) && !expiredModalDismissed;

  // State Relogin Modal (Perpanjang Sesi)
  const [showReloginModal, setShowReloginModal] = useState(false);
  const [reloginPassword, setReloginPassword] = useState("");
  const [reloginLoading, setReloginLoading] = useState(false);
  const [reloginError, setReloginError] = useState("");

  // Format detik menjadi MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Handle Relogin (Perpanjang Sesi)
  async function handleReloginSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authSession) return;

    setReloginLoading(true);
    setReloginError("");

    try {
      const response = await loginApi(
        authSession.user.email || "",
        reloginPassword,
      );
      const user = response.data;
      const companyId = user.companyId || "";
      const role = user.role || "STAFF";

      if (role !== "SUPER_ADMIN" && !companyId) {
        setReloginError("Akun belum terhubung ke instansi.");
        setReloginLoading(false);
        return;
      }

      // Update session dengan token baru & reset 60 menit
      const u = user as unknown as Record<string, unknown>;
      saveAuthData({
        accessToken: response.access_token,
        tokenType: response.token_type,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.email,
          role: user.role,
          companyId,
          status: "ACTIVE",
          createdAt: (typeof u.created_at === "string" ? u.created_at : typeof u.createdAt === "string" ? u.createdAt : ""),
          updatedAt: (typeof u.updated_at === "string" ? u.updated_at : typeof u.updatedAt === "string" ? u.updatedAt : ""),
        },
      });

      setIsSessionExpired(false);
      setExpiredModalDismissed(false);
      setNow(Date.now());
      setShowReloginModal(false);
      setReloginPassword("");
    } catch (err: unknown) {
      setReloginError(getErrorMessage(err, "Password salah. Silakan periksa kembali akun Anda."));
    } finally {
      setReloginLoading(false);
    }
  }

  // Handle Pengalihan ke Login saat Expired
  const handleGoToLogin = useCallback(() => {
    setExpiredModalDismissed(true);
    setIsSessionExpired(false);
    setCachedSession(null);
    clearAuthData();
    router.replace("/login?reason=expired");
  }, [router]);

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
  }, [showExpiredModal, handleGoToLogin]);

  // Jika halaman login atau belum siap
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!mounted || (!currentSession && !isSessionExpired && !isStoredSessionExpired())) {
    return <LoadingState label="Memuat BukuFlow..." />;
  }

  // Jika hak akses rute belum diizinkan, render LoadingState untuk mencegah kilatan konten
  if (userRole && !routeAccess.allowed) {
    return <LoadingState label="Memverifikasi hak akses..." />;
  }

  // Visual State indicator berdasarkan sisa waktu
  const isCritical = remainingSeconds <= 60; // <= 1 menit

  const pageTitle = getPageTitle(pathname);
  const userInitials = activeUser?.name
    ? activeUser.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  const roleLabel =
    activeUser?.role === "SUPER_ADMIN"
      ? "Super Admin"
      : activeUser?.role === "COMPANY_ADMIN"
      ? "Admin Perpustakaan"
      : "Staf";

  return (
    <div className="min-h-screen bg-canvas text-text-main flex">
      {/* SIDEBAR: Di desktop (lg+) full-height di kiri; di mobile (<lg) berupa drawer overlay */}
      <Sidebar
        open={sidebarOpen}
        mobile={isMobile}
        onToggle={() => setSidebarOpen((current) => !current)}
        onClose={() => setSidebarOpen(false)}
        triggerRef={menuButtonRef}
      />

      {/* SISI KANAN: HEADER & KONTEN UTAMA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* HEADER UTAMA */}
        <header className="print:hidden sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface/95 backdrop-blur-sm px-4 sm:px-6">
          {/* Sisi Kiri: Menu Hamburger (hanya di mobile) & Judul Halaman */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {isMobile && (
              <>
                <button
                  ref={menuButtonRef}
                  type="button"
                  onClick={() => setSidebarOpen((prev) => !prev)}
                  aria-label="Buka menu navigasi"
                  aria-expanded={sidebarOpen}
                  aria-controls="app-sidebar"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary shadow-xs transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <MenuIcon />
                </button>

                <Link
                  href={currentSession?.user?.role === "SUPER_ADMIN" ? "/office/dashboard" : "/dashboard"}
                  className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded shrink-0"
                >
                  <img
                    src="/logo-icon.png"
                    alt="BukuFlow Logo"
                    className="h-7 w-7 object-contain sm:hidden"
                  />
                  <img
                    src="/logo.png"
                    alt="BukuFlow Logo"
                    className="h-8 w-auto object-contain hidden sm:inline-block dark:sm:hidden"
                  />
                  <img
                    src="/logo-dark.png"
                    alt="BukuFlow Logo"
                    className="h-8 w-auto object-contain hidden dark:sm:inline-block"
                  />
                </Link>

                <div className="h-5 w-px bg-border mx-0.5 sm:mx-1" />
              </>
            )}

            <h1 className="text-base sm:text-lg font-bold text-text-main tracking-tight truncate">
              {pageTitle}
            </h1>
          </div>

        {/* Sisi Kanan: Warning Timer Sesi (<= 5 menit) & Menu User */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Badge / Pill Sesi: Disembunyikan sampai <= 5 menit (hanya tampil di desktop sm+) */}
          {remainingSeconds <= 300 && (
            <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div
                role="status"
                aria-live="polite"
                className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium transition-all ${
                  isCritical
                    ? "border border-red-200 bg-red-50 text-red-700 animate-pulse"
                    : "border border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <WarningIcon />
                <span className="tabular-nums whitespace-nowrap inline-flex items-center gap-1 leading-none">
                  <span>Sesi berakhir dalam</span>
                  <strong className="font-semibold font-mono">{formatTimer(remainingSeconds)}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowReloginModal(true)}
                className="shrink-0 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-amber-900 shadow-xs transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                Perpanjang
              </button>
            </div>
          )}

          <ThemeSwitcher />

          {/* Menu User (Profil, Keluar) */}
          {currentSession?.user && (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={`${userInitials} ${currentSession.user.name} ${roleLabel}, Menu pengguna`}
                className="flex items-center gap-2 rounded-xl border border-border bg-surface p-1.5 sm:px-2.5 sm:py-1.5 text-left text-xs font-medium text-text-secondary shadow-xs transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-white text-xs shadow-xs">
                  {userInitials}
                </div>
                {" "}
                <div className="hidden md:block max-w-[120px] truncate text-left">
                  <p className="truncate font-semibold text-text-main leading-tight">
                    {currentSession?.user.name}
                    {" "}
                  </p>
                  <p className="truncate text-xs text-text-muted font-normal">
                    {roleLabel}
                  </p>
                </div>
                <svg
                  className={`h-4 w-4 text-text-subtle transition-transform ${
                    userMenuOpen ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  aria-label="Pilihan pengguna"
                  className="absolute right-0 mt-1.5 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-dropdown z-50 animate-in fade-in-50 zoom-in-95"
                >
                  <div className="px-3 py-2 border-b border-border-subtle">
                    <p className="text-xs font-semibold text-text-main truncate">
                      {currentSession?.user.name}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {currentSession?.user.email}
                    </p>
                    <p className="mt-1 inline-block text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {roleLabel}
                    </p>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/profile"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-muted hover:text-text-main transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <svg
                        className="h-4 w-4 text-text-subtle"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Profil Akun
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setShowHeaderLogoutConfirm(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <svg
                        className="h-4 w-4 text-red-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Warning Timer Sesi di Mobile (<= 5 menit): alert bar di bawah header agar tidak menumpuk di navbar */}
      {remainingSeconds <= 300 && (
        <aside
          role="status"
          aria-live="polite"
          className={`print:hidden sm:hidden sticky top-16 z-10 flex items-center justify-between border-b px-4 py-2 transition-all ${
            isCritical
              ? "border-red-200 bg-red-50 text-red-700 animate-pulse"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium min-w-0">
            <WarningIcon />
            <span className="truncate">Sesi berakhir dalam</span>
            <strong className="font-semibold font-mono tabular-nums shrink-0">
              {formatTimer(remainingSeconds)}
            </strong>
          </div>

          <button
            type="button"
            onClick={() => setShowReloginModal(true)}
            className={`ml-2 shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold shadow-xs transition focus-visible:outline-none focus-visible:ring-2 ${
              isCritical
                ? "border-danger-border bg-surface text-danger-text hover:bg-danger-soft focus-visible:ring-danger"
                : "border-warning-border bg-surface text-warning-text hover:bg-warning-soft focus-visible:ring-warning"
            }`}
          >
            Perpanjang
          </button>
        </aside>
      )}

      {/* KONTEN UTAMA */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col min-w-0 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        {children}
      </main>
    </div>

      {/* MODAL 1: SESI TELAH BERAKHIR (Saat 00:00) */}
      <Modal
        open={showExpiredModal}
        onClose={handleGoToLogin}
        closeOnEscape={false}
        closeOnBackdrop={false}
        showCloseButton={false}
        size="md"
      >
        <div className="text-center py-2 cursor-default">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 ring-8 ring-red-50/50">
            <LockIcon />
          </div>

          <h3 className="text-lg font-bold text-text-main sm:text-xl">
            Sesi Anda telah berakhir
          </h3>

          <p className="mt-2 text-sm text-text-muted leading-relaxed">
            Sesi Anda berakhir karena batas waktu. Silakan masuk kembali untuk melanjutkan.
          </p>

          <div className="mt-6">
            <Button
              type="button"
              autoFocus
              onClick={handleGoToLogin}
              className="w-full justify-center"
            >
              Masuk Kembali
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: RELOGIN (INPUT PASSWORD UNTUK PERPANJANG SESI) */}
      <Modal
        open={showReloginModal}
        onClose={() => {
          setShowReloginModal(false);
          setReloginError("");
          setReloginPassword("");
        }}
        title="Perpanjang Sesi Login"
        description={
          <>
            Masukkan password akun <strong>{currentSession?.user.email}</strong> untuk memperpanjang waktu sesi menjadi 60 menit.
          </>
        }
        size="md"
      >
        <form onSubmit={handleReloginSubmit} className="space-y-4">
          <div>
            <label htmlFor="relogin-password" className="block text-xs font-semibold text-text-secondary">
              Password
            </label>
            <input
              id="relogin-password"
              type="password"
              value={reloginPassword}
              onChange={(e) => setReloginPassword(e.target.value)}
              placeholder="Masukkan password Anda"
              required
              autoFocus
              className="mt-1.5 w-full h-11 rounded-lg border border-border px-3.5 text-sm transition focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
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
            <Button
              type="button"
              variant="secondary"
              disabled={reloginLoading}
              onClick={() => {
                setShowReloginModal(false);
                setReloginError("");
                setReloginPassword("");
              }}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={reloginLoading || !reloginPassword}
              loading={reloginLoading}
            >
              {reloginLoading ? "Memverifikasi..." : "Perpanjang Sesi"}
            </Button>
          </div>
        </form>
      </Modal>


      {/* Confirmation Dialog Logout Header (Konsisten dengan Profil dan Sidebar) */}
      <ConfirmationDialog
        open={showHeaderLogoutConfirm}
        title="Konfirmasi Keluar Akun"
        description="Apakah Anda yakin ingin keluar dari sistem BukuFlow? Sesi kerja aktif Anda akan ditutup."
        confirmLabel="Ya, Keluar"
        tone="destructive"
        onConfirm={async () => {
          setShowHeaderLogoutConfirm(false);
          await logoutApi();
        }}
        onClose={() => setShowHeaderLogoutConfirm(false)}
      />
    </div>
  );
}

// ----------------------------------------------------
// ICONS
// ----------------------------------------------------

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
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}
