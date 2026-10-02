"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

interface OfficeNavbarProps {
  userName?: string;
}

export default function OfficeNavbar({ userName = "Super Admin" }: OfficeNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logoutApi();
      toast.success("Berhasil logout dari sistem office.");
      router.replace("/login");
    } catch {
      router.replace("/login");
    }
  };

  const navLinks = [
    { href: "/office/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/office/companies", label: "Instansi / Sekolah", icon: "🏢" },
    { href: "/office/members", label: "Anggota (Members)", icon: "👥" },
    { href: "/office/users", label: "Kelola User & Staf", icon: "👤" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* BRAND */}
        <div className="flex items-center gap-6">
          <Link href="/office/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-xs">
              bF
            </div>
            <div>
              <span className="font-bold tracking-tight text-slate-900 text-base">bukuFlow</span>
              <span className="ml-1.5 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-blue-700 uppercase">
                Office / Super Admin
              </span>
            </div>
          </Link>

          {/* NAV LINKS */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600 border border-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-slate-800">{userName}</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* MOBILE NAV */}
      <div className="flex md:hidden overflow-x-auto border-t border-slate-100 px-4 py-2 gap-1.5">
        {navLinks.map((link) => {
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                isActive
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
