"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { getSession, subscribeSession } from "@/lib/auth";
import { canAccessMasterData, canAccessOffice } from "@/lib/authorization";
import { logoutApi } from "@/lib/api";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

interface SidebarProps {
  open: boolean;
  mobile?: boolean;
  onToggle?: () => void;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
}

export default function Sidebar({
  open,
  mobile = true,
  onToggle,
  onClose,
  triggerRef,
}: SidebarProps) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const prevOpenRef = useRef(open);
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Fokus masuk saat buka dan kembali ke hamburger saat tutup (pada mobile drawer)
  useEffect(() => {
    if (mobile) {
      if (open && !prevOpenRef.current) {
        // Fokus masuk ke drawer saat dibuka (prioritas tombol tutup, fallback ke elemen interaktif pertama)
        const targetToFocus =
          closeButtonRef.current ||
          sidebarRef.current?.querySelector<HTMLElement>(
            'button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]',
          );
        targetToFocus?.focus();
      } else if (!open && prevOpenRef.current) {
        // Fokus kembali ke tombol hamburger toggle saat drawer ditutup
        if (triggerRef?.current) {
          triggerRef.current.focus();
        } else {
          const hamburger = document.querySelector<HTMLElement>(
            'button[aria-controls="app-sidebar"]',
          );
          hamburger?.focus();
        }
      }
    }
    prevOpenRef.current = open;
  }, [open, mobile, triggerRef]);

  // Trap focus & Escape menutup (drawer mobile)
  useEffect(() => {
    if (!mobile || !open) return;

    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = sidebar.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      const focusable = Array.from(focusableElements);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, mobile, onClose]);

  const role = session?.user.role;

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await logoutApi();
  };

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleNavClick = mobile ? onClose : undefined;
  const isDesktopCollapsed = !mobile && !open;
  const isFullyHidden = mobile && !open;

  return (
    <>
      {/* Overlay - Hanya muncul saat drawer mobile terbuka */}
      {mobile && open && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={onClose}
          className="print:hidden fixed inset-0 z-40 bg-overlay"
        />
      )}

      {/* Sidebar (drawer pada mobile, mini icon-only collapsible pada desktop lg+) */}
      <aside
        ref={sidebarRef}
        id="app-sidebar"
        aria-label="Navigasi utama"
        aria-hidden={isFullyHidden ? true : undefined}
        inert={isFullyHidden ? true : undefined}
        className={`print:hidden flex flex-col border-r border-border bg-surface text-text-main transition-[width] duration-300 ease-in-out ${
          mobile
            ? `fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-xl transition-transform duration-200 ${
                open ? "translate-x-0" : "-translate-x-full"
              }`
            : `sticky top-0 h-screen z-30 shrink-0 ${
                open ? "w-72" : "w-20"
              }`
        }`}
      >
        {/* Header */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-border ${
            isDesktopCollapsed ? "justify-center px-2" : "justify-between px-4 sm:px-5"
          }`}
        >
          {isDesktopCollapsed ? (
            /* Saat Collapsed (Mini Sidebar): Klik icon untuk memperluas */
            <button
              type="button"
              onClick={onToggle}
              title="Perluas menu samping"
              aria-label="Perluas menu samping"
              className="group flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <img
                src="/logo-icon.png"
                alt="BukuFlow"
                className="h-8 w-8 object-contain transition-transform group-hover:scale-110"
              />
            </button>
          ) : (
            /* Saat Terbuka: Logo di kiri, Tombol Collapse di kanan */
            <>
              <Link
                href={canAccessOffice(role) ? "/office/dashboard" : "/dashboard"}
                onClick={handleNavClick}
                className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              >
                <img
                  src="/logo.png"
                  alt="BukuFlow Logo"
                  className="h-8 w-auto object-contain dark:hidden"
                />
                <img
                  src="/logo-dark.png"
                  alt="BukuFlow Logo"
                  className="h-8 w-auto object-contain hidden dark:inline-block"
                />
              </Link>

              {/* Tombol Collapse pada Desktop ATAU Tombol [X] pada Mobile Drawer */}
              {mobile ? (
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup menu"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-muted hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <CloseIcon />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onToggle}
                  title="Tutup menu samping"
                  aria-label="Tutup menu samping"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-text-subtle transition hover:bg-surface-muted hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                    <path d="m16 15-3-3 3-3" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${isDesktopCollapsed ? "px-2 py-4 space-y-4" : "px-3 py-5"}`}>
          {canAccessOffice(role) ? (
            /* SUPER ADMIN OFFICE PORTAL */
            <div className="space-y-4">
              <div>
                {!isDesktopCollapsed && (
                  <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Office Platform
                  </p>
                )}
                <div className="space-y-1">
                  <NavItem
                    href="/office/dashboard"
                    label="Dashboard Office"
                    iconKey="dashboard"
                    active={isActive("/office/dashboard")}
                    onClick={handleNavClick}
                    disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                  />
                  <NavItem
                    href="/office/companies"
                    label="Manajemen Company"
                    iconKey="companies"
                    active={isActive("/office/companies")}
                    onClick={handleNavClick}
                    disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                  />
                  <NavItem
                    href="/office/users"
                    label="Pengguna Platform"
                    iconKey="users"
                    active={isActive("/office/users")}
                    onClick={handleNavClick}
                    disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                  />
                </div>
              </div>

              <div>
                {isDesktopCollapsed ? (
                  <div className="my-2.5 mx-2 border-t border-border" title="Support & Audit" />
                ) : (
                  <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Support & Audit
                  </p>
                )}
                <div className="space-y-1">
                  <NavItem
                    href="/office/books"
                    label="Inspeksi Katalog (Buku)"
                    iconKey="books"
                    active={isActive("/office/books")}
                    onClick={handleNavClick}
                    disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                  />
                  <NavItem
                    href="/office/loans"
                    label="Inspeksi Transaksi"
                    iconKey="loans"
                    active={isActive("/office/loans")}
                    onClick={handleNavClick}
                    disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                  />
                  <NavItem
                    href="/office/members"
                    label="Inspeksi Anggota"
                    iconKey="members"
                    active={isActive("/office/members")}
                    onClick={handleNavClick}
                    disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* COMPANY ADMIN & STAFF */
            <>
              <div className="space-y-1">
                <NavItem
                  href="/dashboard"
                  label="Dashboard"
                  iconKey="dashboard"
                  active={isActive("/dashboard")}
                  onClick={handleNavClick}
                  disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                />

                {role && (
                  <>
                    <NavItem
                      href={role === "COMPANY_ADMIN" ? "/loans" : "/loans/new"}
                      label="Peminjaman"
                      iconKey="loans"
                      active={
                        role === "COMPANY_ADMIN"
                          ? isActive("/loans")
                          : pathname === "/loans/new"
                      }
                      onClick={handleNavClick}
                      disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                    />

                    <NavItem
                      href="/returns"
                      label="Pengembalian"
                      iconKey="returns"
                      active={isActive("/returns")}
                      onClick={handleNavClick}
                      disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                    />

                    <NavItem
                      href="/transactions"
                      label="Riwayat Transaksi"
                      iconKey="history"
                      active={isActive("/transactions")}
                      onClick={handleNavClick}
                      disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                    />
                  </>
                )}
              </div>

              {/* Master Data */}
              {role && canAccessMasterData(role) && (
                <div className="mt-7">
                  {isDesktopCollapsed ? (
                    <div className="my-2 border-t border-border" title="Master Data" />
                  ) : (
                    <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Master Data
                    </p>
                  )}

                  <div className="space-y-1">
                    <NavItem
                      href="/master/members"
                      label="Anggota"
                      iconKey="members"
                      active={isActive("/master/members")}
                      onClick={handleNavClick}
                      disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                    />

                    <NavItem
                      href="/master/books"
                      label="Buku"
                      iconKey="books"
                      active={isActive("/master/books")}
                      onClick={handleNavClick}
                      disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                    />
                  </div>
                </div>
              )}

              {/* Pengaturan Instansi */}
              {role === "COMPANY_ADMIN" && (
                <div className="mt-7">
                  {isDesktopCollapsed ? (
                    <div className="my-2 border-t border-border" title="Pengaturan" />
                  ) : (
                    <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Pengaturan
                    </p>
                  )}

                  <div className="space-y-1">
                    <NavItem
                      href="/settings/company"
                      label="Konfigurasi Instansi"
                      iconKey="companies"
                      active={isActive("/settings/company")}
                      onClick={handleNavClick}
                      disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                    />

                    <NavItem
                      href="/settings/users"
                      label="Kelola Pengguna"
                      iconKey="users"
                      active={isActive("/settings/users")}
                      onClick={handleNavClick}
                      disabled={isFullyHidden} collapsed={isDesktopCollapsed}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </nav>

        {/* User & Logout */}
        <div className={`shrink-0 border-t border-border bg-surface text-text-main ${isDesktopCollapsed ? "p-2.5 space-y-2 pb-6" : "p-4"}`}>
          {session && (
            <Link
              href="/profile"
              onClick={handleNavClick}
              tabIndex={isFullyHidden ? -1 : 0}
              title={isDesktopCollapsed ? `${session.user.name} (${session.user.role})` : undefined}
              className={`group flex items-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isDesktopCollapsed
                  ? "h-11 w-11 mx-auto justify-center rounded-xl hover:bg-surface-muted"
                  : `mb-3 justify-between rounded-xl border p-2.5 ${
                      pathname === "/profile"
                        ? "border-blue-300 bg-blue-50/90 shadow-sm ring-1 ring-blue-200"
                        : "border-border bg-surface-subtle hover:border-blue-200 hover:bg-blue-50/40"
                    }`
              }`}
            >
              {isDesktopCollapsed ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-white text-xs shadow-sm">
                  {session.user.name
                    ? session.user.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : "U"}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-white text-xs shadow-sm">
                      {session.user.name
                        ? session.user.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        : "U"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-main group-hover:text-blue-600 transition">
                        {session.user.name}
                      </p>
                      <p className="truncate text-xs text-text-secondary font-medium">
                        {session.user.role === "SUPER_ADMIN"
                          ? "Super Admin"
                          : session.user.role === "COMPANY_ADMIN"
                          ? "Admin Perpustakaan"
                          : "Staff"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-text-subtle group-hover:text-blue-600 group-hover:translate-x-0.5 transition">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                </>
              )}
            </Link>
          )}

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            tabIndex={isFullyHidden ? -1 : 0}
            title={isDesktopCollapsed ? "Keluar dari akun" : undefined}
            className={`flex items-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              isDesktopCollapsed
                ? "h-11 w-11 mx-auto justify-center rounded-xl border border-border text-text-secondary hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                : "w-full gap-3 rounded-xl border border-border px-3 py-3 text-left text-sm font-semibold text-text-secondary hover:bg-surface-muted hover:text-text-main"
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
              <LogoutIcon />
            </span>

            {!isDesktopCollapsed && (
              <span>
                <span className="block">Keluar</span>
                <span className="mt-0.5 block text-xs font-normal text-text-muted">
                  Keluar dari akun
                </span>
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Confirmation Dialog Logout (Konsisten dengan halaman Profil) */}
      <ConfirmationDialog
        open={showLogoutConfirm}
        title="Konfirmasi Keluar Akun"
        description="Apakah Anda yakin ingin keluar dari sistem BukuFlow? Sesi kerja aktif Anda akan ditutup."
        confirmLabel="Ya, Keluar"
        tone="destructive"
        onConfirm={handleConfirmLogout}
        onClose={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}

export type NavIconKey =
  | "dashboard"
  | "loans"
  | "returns"
  | "history"
  | "members"
  | "books"
  | "companies"
  | "users";

interface NavItemProps {
  href: string;
  label: string;
  iconKey?: NavIconKey;
  active: boolean;
  onClick?: () => void;
  disabled?: boolean;
  collapsed?: boolean;
}

function NavItem({
  href,
  label,
  iconKey,
  active,
  onClick,
  disabled = false,
  collapsed = false,
}: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      tabIndex={disabled ? -1 : 0}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center rounded-xl transition ${
        collapsed
          ? "h-11 w-11 mx-auto justify-center"
          : "gap-3 px-3 py-2.5 text-sm font-medium w-full"
      } ${
        active
          ? "bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-200/80 shadow-xs"
          : "text-text-secondary hover:bg-surface-muted hover:text-text-main"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center transition-colors ${
          active ? "text-blue-700" : "text-text-muted group-hover:text-text-secondary"
        }`}
      >
        <NavIcon name={iconKey} />
      </span>

      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

function NavIcon({ name }: { name?: NavIconKey }) {
  switch (name) {
    case "dashboard":
      return <DashboardIcon />;
    case "loans":
      return <LoanIcon />;
    case "returns":
      return <ReturnIcon />;
    case "history":
      return <HistoryIcon />;
    case "members":
      return <MemberIcon />;
    case "books":
      return <BookIcon />;
    case "companies":
      return <CompanyIcon />;
    case "users":
    default:
      return <UsersIcon />;
  }
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

function LoanIcon() {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M15 3v5h5" />
      <path d="M9 13l2 2 4-4" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 6h10a4 4 0 0 1 4 4v1" />
      <path d="M5 6l3-3M5 6l3 3" />
      <path d="M19 18H9a4 4 0 0 1-4-4v-1" />
      <path d="M19 18l-3-3M19 18l-3 3" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}

function MemberIcon() {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function CompanyIcon() {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 20V5l8-2v17M12 20h8V8l-8-3" />
      <path d="M7 8h2M7 12h2M7 16h2M15 11h2M15 15h2" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14a5 5 0 0 1 5 5" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M21 19V5a2 2 0 0 0-2-2h-7" />
    </svg>
  );
}
