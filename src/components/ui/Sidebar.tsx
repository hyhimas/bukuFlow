"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { mockCompanies } from "@/lib/mock-data";
import { clearSession, getSession, type Session } from "@/lib/auth";
import { canAccessMasterData, canAccessOffice } from "@/lib/authorization";
import { logoutApi } from "@/lib/api";

interface SidebarProps {
  open: boolean;
  mobile: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export default function Sidebar({
  open,
  mobile,
  onToggle,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarRef = useRef<HTMLElement>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  useEffect(() => {
    if (!open) return;

    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const handleKeyDown = (event: KeyboardEvent) => {
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
  }, [open]);

  const role = session?.user.role;

  const currentCompany = mockCompanies.find(
    (company) => company.id === session?.user.companyId,
  );

 const handleLogout = async () => {
  await logoutApi();
};

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Overlay */}
      {open && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={onClose}
          className="print:hidden fixed inset-0 z-40 bg-slate-900/40"
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`print:hidden fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <Link
            href={canAccessOffice(role) ? "/office/dashboard" : "/dashboard"}
            onClick={onClose}
            tabIndex={open ? 0 : -1}
            className="flex items-center gap-2"
          >
            <img
              src="/logo.png"
              alt="BukuFlow Logo"
              className="h-8 w-auto object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={onToggle}
            tabIndex={open ? 0 : -1}
            aria-label="Tutup menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Navigation */}
        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-5">
          {canAccessOffice(role) ? (
            /* SUPER ADMIN OFFICE PORTAL */
            <div className="space-y-6">
              <div>
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Office Platform
                </p>
                <div className="space-y-1">
                  <NavItem
                    href="/office/dashboard"
                    label="Dashboard Office"
                    active={isActive("/office/dashboard")}
                    onClick={onClose}
                    disabled={!open}
                  />
                  <NavItem
                    href="/office/companies"
                    label="Manajemen Company"
                    active={isActive("/office/companies")}
                    onClick={onClose}
                    disabled={!open}
                  />
                  <NavItem
                    href="/office/users"
                    label="Pengguna Platform"
                    active={isActive("/office/users")}
                    onClick={onClose}
                    disabled={!open}
                  />
                </div>
              </div>

              <div>
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Support & Audit
                </p>
                <div className="space-y-1">
                  <NavItem
                    href="/office/catalog"
                    label="Inspeksi Katalog"
                    active={isActive("/office/catalog")}
                    onClick={onClose}
                    disabled={!open}
                  />
                  <NavItem
                    href="/office/loans"
                    label="Inspeksi Transaksi"
                    active={isActive("/office/loans")}
                    onClick={onClose}
                    disabled={!open}
                  />
                  <NavItem
                    href="/office/members"
                    label="Inspeksi Anggota"
                    active={isActive("/office/members")}
                    onClick={onClose}
                    disabled={!open}
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
                  active={isActive("/dashboard")}
                  onClick={onClose}
                  disabled={!open}
                />

                {role && (
                  <>
                    <NavItem
                      href={role === "COMPANY_ADMIN" ? "/loans" : "/loans/new"}
                      label="Peminjaman"
                      active={isActive("/loans")}
                      onClick={onClose}
                      disabled={!open}
                    />

                    <NavItem
                      href="/returns"
                      label="Pengembalian"
                      active={isActive("/returns")}
                      onClick={onClose}
                      disabled={!open}
                    />

                    <NavItem
                      href="/transactions"
                      label="Riwayat Transaksi"
                      active={isActive("/transactions")}
                      onClick={onClose}
                      disabled={!open}
                    />
                  </>
                )}
              </div>

              {/* Master Data */}
              {role && canAccessMasterData(role) && (
                <div className="mt-7">
                  <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Master Data
                  </p>

                  <div className="space-y-1">
                    <NavItem
                      href="/master/members"
                      label="Member"
                      active={isActive("/master/members")}
                      onClick={onClose}
                      disabled={!open}
                    />

                    <NavItem
                      href="/master/books"
                      label="Buku"
                      active={isActive("/master/books")}
                      onClick={onClose}
                      disabled={!open}
                    />
                  </div>
                </div>
              )}

              {/* Pengaturan Instansi */}
              {role === "COMPANY_ADMIN" && (
                <div className="mt-7">
                  <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Pengaturan
                  </p>

                  <div className="space-y-1">
                    <NavItem
                      href="/settings/company"
                      label="Konfigurasi Instansi"
                      active={isActive("/settings/company")}
                      onClick={onClose}
                      disabled={!open}
                    />

                    <NavItem
                      href="/settings/users"
                      label="Kelola Pengguna"
                      active={isActive("/settings/users")}
                      onClick={onClose}
                      disabled={!open}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </nav>

        {/* User & Logout */}
        <div className="shrink-0 border-t border-slate-200 bg-white p-4">
          {session && (
            <Link
              href="/profile"
              onClick={onClose}
              tabIndex={open ? 0 : -1}
              className={`group mb-3 flex items-center justify-between rounded-xl border p-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                pathname === "/profile"
                  ? "border-blue-300 bg-blue-50/90 shadow-sm ring-1 ring-blue-200"
                  : "border-slate-200 bg-slate-50/80 hover:border-blue-200 hover:bg-blue-50/40"
              }`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 font-bold text-white text-xs shadow-sm">
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
                  <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition">
                    {session.user.name}
                  </p>
                  <p className="truncate text-xs text-slate-500 font-medium">
                    {session.user.role === "SUPER_ADMIN"
                      ? "Super Admin"
                      : session.user.role === "COMPANY_ADMIN"
                      ? "Admin Perpustakaan"
                      : "Staff"}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </Link>
          )}

          <button
            type="button"
            onClick={handleLogout}
            tabIndex={open ? 0 : -1}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <LogoutIcon />
            </span>

            <span>
              <span className="block">Keluar</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                Keluar dari akun
              </span>
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function NavItem({
  href,
  label,
  active,
  onClick,
  disabled = false,
}: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      tabIndex={disabled ? -1 : 0}
      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
        active
          ? "bg-slate-100 text-slate-900"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center ${
          active ? "text-slate-900" : "text-slate-500"
        }`}
      >
        <NavIcon label={label} />
      </span>

      <span className="truncate">{label}</span>
    </Link>
  );
}

function NavIcon({ label }: { label: string }) {
  if (label === "Dashboard" || label === "Dashboard Office") return <DashboardIcon />;
  if (label === "Peminjaman" || label === "Inspeksi Transaksi") return <LoanIcon />;
  if (label === "Pengembalian") return <ReturnIcon />;
  if (label === "Riwayat Transaksi") return <HistoryIcon />;
  if (label === "Member" || label === "Inspeksi Anggota") return <MemberIcon />;
  if (label === "Buku" || label === "Inspeksi Katalog") return <BookIcon />;
  if (label === "Company" || label === "Manajemen Company" || label === "Konfigurasi Instansi") return <CompanyIcon />;

  return <UsersIcon />;
}

function CloseIcon() {
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
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg
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
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 5h14v14H5z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg
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
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2z" />
      <path d="M5 4v16M9 8h6M9 12h6" />
    </svg>
  );
}

function CompanyIcon() {
  return (
    <svg
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
