"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import OfficeNavbar from "@/components/office/OfficeNavbar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import LoadingState from "@/components/ui/LoadingState";
import { getSession } from "@/lib/auth";
import { getOfficeDashboardApi, getCompaniesApi, type OfficeDashboardData } from "@/lib/api";
import type { Company, Loan } from "@/lib/types";

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

function formatShortDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
      });
}

function DashboardStatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function QuickAccessCard({
  href,
  title,
  description,
  icon,
  className = "",
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
    >
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
          {icon}
        </div>

        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </Link>
  );
}

export default function OfficeDashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("Super Admin");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("company-001");
  const [dashboardData, setDashboardData] = useState<OfficeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Custom Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 1. Guard Authentication
  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    if (session.user.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
      return;
    }

    setUserName(session.user.name || "Super Admin");
    setCheckingAuth(false);
  }, [router]);

  // Load Companies
  useEffect(() => {
    if (!checkingAuth) {
      getCompaniesApi().then((comps) => {
        if (comps.length > 0) {
          setCompanies(comps);
          if (!selectedCompanyId) {
            setSelectedCompanyId(comps[0].id);
          }
        }
      }).catch(() => {});
    }
  }, [checkingAuth]);

  // 2. Fetch Office Dashboard per Company
  useEffect(() => {
    if (checkingAuth || !selectedCompanyId) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const data = await getOfficeDashboardApi(selectedCompanyId);
        if (isMounted) {
          setDashboardData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Gagal memuat data office dashboard.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedCompanyId, checkingAuth]);

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-slate-50">
        <LoadingState label="Memeriksa otorisasi Super Admin..." />
      </main>
    );
  }

  const selectedCompany =
    companies.find((c) => c.id === selectedCompanyId) ||
    (companies.length > 0 ? companies[0] : { id: selectedCompanyId, name: "SMA Negeri 1 Jakarta", code: "SMAN1-JKT" });

  return (
    <main className="min-h-screen bg-slate-50">
      <OfficeNavbar userName={userName} />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ===================================================
            HEADER & CUSTOM COMPANY SELECTOR
        ==================================================== */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Selamat datang, {userName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Ringkasan dan pemantauan operasional multi-instansi (Tenant Overview).
            </p>
          </div>

          {/* CUSTOM COMPANY SWITCHER DROPDOWN */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-expanded={isDropdownOpen}
              aria-label="Pilih instansi"
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left shadow-xs transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-72"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-400">Instansi Terpilih</p>
                <p className="truncate text-sm font-semibold text-slate-900">
                  {selectedCompany.name}
                </p>
              </div>
              <ChevronDownIcon
                className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* POPUP MENU */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-full min-w-[280px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg sm:w-80">
                <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Pilih Instansi
                </div>
                <div className="space-y-0.5">
                  {companies.map((company) => {
                    const isSelected = company.id === selectedCompanyId;
                    return (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() => {
                          setSelectedCompanyId(company.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{company.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{company.code}</p>
                        </div>
                        {isSelected && (
                          <span className="text-blue-600 shrink-0">
                            <CheckIcon />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===================================================
            STATISTIK SUPER ADMIN (CLEAN COMPANY ADMIN STYLE)
        ==================================================== */}
        <section
          aria-label="Ringkasan instansi"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <DashboardStatCard
            label="Total buku instansi"
            value={loading ? "..." : dashboardData?.totalBooks ?? 0}
            icon={<BookIcon />}
          />

          <DashboardStatCard
            label="Peminjaman aktif"
            value={loading ? "..." : dashboardData?.activeLoans ?? 0}
            icon={<TransactionIcon />}
          />

          <DashboardStatCard
            label="Anggota terdaftar"
            value={loading ? "..." : dashboardData?.totalMembers ?? 0}
            icon={<MemberIcon />}
          />

          <DashboardStatCard
            label="Pengguna tenant"
            value={loading ? "..." : dashboardData?.totalUsers ?? 0}
            icon={<UsersIcon />}
          />
        </section>

        {/* ===================================================
            PENGELOLAAN PLATFORM (3 KARTU KONTROL SUPER ADMIN)
        ==================================================== */}
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Pusat Kendali & Otorisasi Khusus
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Akses cepat manajemen platform dan audit teknis per instansi.
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QuickAccessCard
              href="/office/companies"
              title="Manajemen Instansi"
              description="Daftar sekolah & perpustakaan, status operasional, dan kuota tenant."
              icon={<CompanyIcon />}
            />

            <QuickAccessCard
              href="/office/users"
              title="Pengguna & Admin"
              description="Kelola akun Administrator Company dan staf operasional perpustakaan."
              icon={<UsersIcon />}
            />

            <QuickAccessCard
              href="/office/members"
              title="Anggota Perpustakaan"
              description="Manajemen data seluruh member terdaftar per instansi."
              icon={<MemberIcon />}
            />
          </div>
        </section>

        {/* ===================================================
            AKTIVITAS TRANSAKSI TERBARU (IDENTICAL CARD & ROWS)
        ==================================================== */}
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">
              Aktivitas Transaksi Terbaru
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Memuat data aktivitas...
            </div>
          ) : !dashboardData?.recentLoans || dashboardData.recentLoans.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-medium text-slate-700">
                Belum ada aktivitas transaksi
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Aktivitas transaksi terbaru instansi ini akan muncul di sini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dashboardData.recentLoans.slice(0, 10).map((loan) => (
                <div
                  key={loan.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-4 gap-y-1 px-5 py-4 xl:grid-cols-[260px_minmax(180px,1fr)_minmax(280px,1fr)_120px] xl:grid-rows-1 xl:gap-x-6"
                >
                  {/* Nomor transaksi */}
                  <div className="min-w-0">
                    <p className="whitespace-nowrap text-sm font-medium text-slate-900 xl:text-base">
                      {loan.loanNumber}
                    </p>
                  </div>

                  {/* Nama member */}
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-500 xl:text-sm">
                      {loan.memberName}
                    </p>
                  </div>

                  {/* Tanggal */}
                  <div className="min-w-0 text-right">
                    <p className="hidden whitespace-nowrap text-sm text-slate-500 sm:block">
                      {formatDate(loan.borrowedAt)} - {formatDate(loan.dueAt)}
                    </p>

                    <p className="whitespace-nowrap text-xs text-slate-500 sm:hidden">
                      {formatShortDate(loan.borrowedAt)} - {formatShortDate(loan.dueAt)}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="col-start-2 row-start-1 flex justify-center xl:col-start-4 xl:row-start-1">
                    <Badge variant={loan.status === "ACTIVE" ? "warning" : loan.status === "COMPLETED" ? "success" : "danger"}>
                      {loan.status === "ACTIVE" ? "Aktif" : loan.status === "COMPLETED" ? "Selesai" : loan.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

// ==========================================
// UNIFIED BLUE MONOCHROME ICONS
// ==========================================

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20" />
    </svg>
  );
}

function BookDetailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 18.5A2.5 2.5 0 0 1 7.5 16H20" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6h7M9 9h5" />
    </svg>
  );
}

function TransactionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 21 20H3L12 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16h.01" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 4v5h-5" />
    </svg>
  );
}

function MemberIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a3 3 0 1 0 0-6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 14.5a5.5 5.5 0 0 1 4.5 5.5" />
    </svg>
  );
}

function CompanyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 14a5 5 0 0 1 5 5" />
    </svg>
  );
}

function SearchAuditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3M11 8v6M8 11h6" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className || "h-4 w-4"} aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
