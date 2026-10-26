"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import LoadingState from "@/components/ui/LoadingState";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import CompanySwitcher, {
  getStoredOfficeCompanyId,
  setStoredOfficeCompanyId,
} from "@/components/office/CompanySwitcher";
import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import {
  getOfficeDashboardApi,
  getCompaniesApi,
  searchOfficeLoansApi,
  getErrorMessage,
  type OfficeDashboardData,
  type OfficeLoanItem,
} from "@/lib/api";
import type { Company } from "@/lib/types";

const statusLabel: Record<string, string> = {
  ACTIVE: "Dipinjam",
  OVERDUE: "Terlambat",
  COMPLETED: "Kembali",
  CANCELLED: "Dibatalkan",
};

function getStatusVariant(status: string): "success" | "warning" | "danger" | "neutral" | "info" {
  if (status === "ACTIVE") return "warning";
  if (status === "OVERDUE") return "danger";
  if (status === "COMPLETED") return "success";
  return "neutral";
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}



function DashboardStatCard({
  label,
  value,
  icon,
  className = "",
}: {
  label: string;
  value: number | string | null | undefined;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
            {value === null || value === undefined ? (
              <span className="text-slate-500 font-normal text-xl">
                -
              </span>
            ) : (
              value
            )}
          </div>
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
  const [userName] = useState(() => {
    if (typeof window === "undefined") return "Super Admin";
    return getSession()?.user?.name || "Super Admin";
  });
  const [checkingAuth] = useState(() => {
    if (typeof window === "undefined") return true;
    const session = getSession();
    return !(session && session.user.role === "SUPER_ADMIN");
  });

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() =>
    getStoredOfficeCompanyId()
  );
  const [dashboardData, setDashboardData] = useState<OfficeDashboardData | null>(null);
  const [recentLoans, setRecentLoans] = useState<OfficeLoanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loansLoading, setLoansLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // 1. Guard Authentication
  useEffect(() => {
    const session = getSession();
    if (!session) {
      if (!isStoredSessionExpired() && !hasStoredAuth()) {
        router.replace("/login");
      }
      return;
    }

    if (session.user.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
      return;
    }
  }, [router]);

  // Load Companies
  useEffect(() => {
    if (!checkingAuth) {
      getCompaniesApi()
        .then((comps) => {
          setCompanies(comps);
        })
        .catch((err: unknown) => {
          console.warn("Daftar instansi belum tersedia di backend:", err instanceof Error ? err.message : err);
          setError(getErrorMessage(err, "Gagal memuat daftar instansi."));
        });
    }
  }, [checkingAuth]);

  // 2. Fetch Office Dashboard & Latest Loans per Company
  useEffect(() => {
    if (checkingAuth) return;
    if (!selectedCompanyId) {
      return;
    }

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setLoansLoading(true);
      setError("");
      try {
        const [dashRes, loansRes] = await Promise.allSettled([
          getOfficeDashboardApi(selectedCompanyId),
          searchOfficeLoansApi(selectedCompanyId, {
            page: 1,
            size: 10,
            sortby: "updated_at",
            order: "desc",
          }),
        ]);

        if (isMounted) {
          if (dashRes.status === "fulfilled") {
            setDashboardData(dashRes.value);
          } else {
            setError(getErrorMessage(dashRes.reason, "Gagal memuat data office dashboard."));
          }

          if (loansRes.status === "fulfilled") {
            setRecentLoans(loansRes.value.items);
          } else {
            console.warn("Gagal memuat riwayat peminjaman terbaru:", loansRes.reason);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(getErrorMessage(err, "Gagal memuat data office dashboard."));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setLoansLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedCompanyId, checkingAuth, reloadKey]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50">
        <LoadingState label="Memeriksa otorisasi Super Admin..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ===================================================
            HEADER & CUSTOM COMPANY SELECTOR
        ==================================================== */}
        <div className="mb-6">
          <PageHeader
            title={`Selamat datang, ${userName}`}
            description="Ringkasan dan pemantauan operasional lintas instansi perpustakaan."
            actions={
              <CompanySwitcher
                selectedCompanyId={selectedCompanyId}
                onSelectCompany={(id) => {
                  setStoredOfficeCompanyId(id);
                  setSelectedCompanyId(id);
                  if (!id) {
                    setDashboardData(null);
                    setRecentLoans([]);
                  }
                }}
                companies={companies}
              />
            }
          />
        </div>

        {/* PROMPT JIKA BELUM PILIH INSTANSI */}
        {!selectedCompanyId ? (
          <Card className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <CompanyIcon />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Pilih Instansi Terlebih Dahulu</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Sebelum memuat ringkasan operasional, silakan pilih salah satu instansi melalui pemilih instansi di atas.
            </p>
          </Card>
        ) : error ? (
          <ErrorState
            title="Gagal Memuat Dashboard Office"
            message={error}
            onRetry={() => setReloadKey((k) => k + 1)}
            className="mt-6"
          />
        ) : (
          <>
            {/* ===================================================
                RINGKASAN OPERASIONAL INSTANSI (SESUAI RESPONS BE)
            ==================================================== */}
            <section
              aria-label="Ringkasan instansi"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <DashboardStatCard
                label="Buku Tersedia"
                value={loading ? "..." : (dashboardData ? dashboardData.booksAvailable : null)}
                icon={<BookIcon />}
              />

              <DashboardStatCard
                label="Peminjaman Aktif"
                value={loading ? "..." : (dashboardData ? dashboardData.activeLoans : null)}
                icon={<TransactionIcon />}
              />

              <DashboardStatCard
                label="Peminjaman Terlambat"
                value={loading ? "..." : (dashboardData ? dashboardData.overdueLoans : null)}
                icon={<ClockIcon />}
                className="sm:col-span-2 lg:col-span-1"
              />
            </section>

            {/* ===================================================
                PENGELOLAAN PLATFORM
            ==================================================== */}
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Pusat Kendali & Otorisasi Khusus
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Akses cepat manajemen platform dan audit teknis per instansi.
              </p>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <QuickAccessCard
                  href="/office/companies"
                  title="Manajemen Instansi"
                  description="Daftar sekolah & perpustakaan, status operasional, dan kuota instansi."
                  icon={<CompanyIcon />}
                />

                <QuickAccessCard
                  href="/office/users"
                  title="Pengguna & Admin"
                  description="Kelola akun Administrator Company dan staf operasional perpustakaan."
                  icon={<UsersIcon />}
                />
              </div>
            </section>

            {/* ===================================================
                AKTIVITAS TRANSAKSI TERBARU
            ==================================================== */}
            <Card className="mt-6 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="font-semibold text-slate-900">
                  Riwayat Transaksi Terbaru
                </h2>

                {recentLoans.length > 0 && (
                  <Link
                    href="/office/loans"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
                  >
                    Lihat semua →
                  </Link>
                )}
              </div>

              {loansLoading ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Memuat aktivitas transaksi terbaru...</span>
                  </div>
                </div>
              ) : recentLoans.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-medium text-slate-700">
                    Belum ada aktivitas transaksi
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Aktivitas transaksi terbaru instansi ini akan muncul di sini.
                  </p>
                </div>
              ) : (
                <div>
                  {/* Tampilan Mobile (< md): 100% Fluid Width, Status Badge selalu terlihat di kanan */}
                  <div className="divide-y divide-slate-100 md:hidden">
                    {recentLoans.slice(0, 10).map((loan) => (
                      <div key={loan.id} className="flex flex-col gap-1.5 p-4 transition hover:bg-slate-50/70">
                        {/* Baris 1: No Transaksi (Kiri) & Nama Member (Kanan) */}
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className="shrink-0 font-mono text-sm font-bold text-slate-900"
                            title={loan.rawLoanNumber ? `ID Sistem: ${loan.rawLoanNumber}` : loan.loanNumber}
                          >
                            {loan.loanNumber}
                          </span>
                          <span
                            className="truncate text-right text-sm font-medium text-slate-700 max-w-[55%]"
                            title={loan.memberName || (loan.memberNumber ? `No. Anggota: ${loan.memberNumber}` : loan.memberId !== "-" ? `ID Anggota: ${loan.memberId}` : "Anggota")}
                          >
                            {loan.memberName || (loan.memberNumber ? `Anggota (${loan.memberNumber})` : "Anggota")}
                          </span>
                        </div>

                        {/* Baris 2: Tgl Pinjam (Kiri) & Jatuh Tempo (Kanan) */}
                        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                          <span className="truncate">
                            <span className="font-medium text-slate-500">Pinjam: </span>
                            {formatDate(loan.borrowedAt)}
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="font-medium text-slate-500">Jatuh Tempo: </span>
                            <span className={loan.status === "OVERDUE" ? "font-semibold text-red-600" : ""}>
                              {formatDate(loan.dueAt)}
                            </span>
                          </span>
                        </div>

                        {/* Baris 3: Tgl Kembali (Kiri) & Badge Status (Kanan) */}
                        <div className="flex items-center justify-between gap-3 text-xs pt-0.5">
                          <span className="truncate text-slate-500">
                            <span className="font-medium text-slate-500">Kembali: </span>
                            {loan.status === "COMPLETED" && loan.returnedAt
                              ? formatDate(loan.returnedAt)
                              : "-"}
                          </span>
                          <div className="shrink-0 flex justify-end">
                            <Badge variant={getStatusVariant(loan.status)}>
                              {statusLabel[loan.status] || loan.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tampilan Desktop & Tablet (>= md) */}
                  <div className="hidden md:block overflow-x-auto">
                    <div className="min-w-[660px]">
                      {/* Table Header: Nomor Transaksi, Anggota, Tgl Pinjam, Jatuh Tempo, Dikembalikan, Status */}
                      <div className="grid grid-cols-[minmax(115px,1.2fr)_minmax(115px,1.2fr)_minmax(92px,1fr)_minmax(92px,1fr)_minmax(92px,1fr)_85px] items-center gap-x-3 border-b border-slate-100 bg-slate-50/80 px-4 sm:px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <div>Nomor Peminjaman</div>
                        <div>Anggota</div>
                        <div>Tgl Pinjam</div>
                        <div>Jatuh Tempo</div>
                        <div>Dikembalikan</div>
                        <div className="text-right">Status</div>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {recentLoans.slice(0, 10).map((loan) => (
                          <div
                            key={loan.id}
                            className="grid grid-cols-[minmax(115px,1.2fr)_minmax(115px,1.2fr)_minmax(92px,1fr)_minmax(92px,1fr)_minmax(92px,1fr)_85px] items-center gap-x-3 px-4 sm:px-5 py-3 transition hover:bg-slate-50/70"
                          >
                            {/* 1. Nomor transaksi */}
                            <div className="min-w-0">
                              <p
                                className="whitespace-nowrap text-sm font-semibold text-slate-900 font-mono"
                                title={loan.rawLoanNumber ? `ID Sistem: ${loan.rawLoanNumber}` : loan.loanNumber}
                              >
                                {loan.loanNumber}
                              </p>
                            </div>

                            {/* 2. Nama member */}
                            <div className="min-w-0">
                              <p
                                className="truncate text-xs sm:text-sm text-slate-600"
                                title={loan.memberName || (loan.memberNumber ? `No. Anggota: ${loan.memberNumber}` : loan.memberId !== "-" ? `ID Anggota: ${loan.memberId}` : "Anggota")}
                              >
                                {loan.memberName || (loan.memberNumber ? `Anggota (${loan.memberNumber})` : "Anggota")}
                              </p>
                            </div>

                            {/* 3. Tanggal Pinjam */}
                            <div className="min-w-0">
                              <span className="whitespace-nowrap text-xs sm:text-sm text-slate-600">
                                {formatDate(loan.borrowedAt)}
                              </span>
                            </div>

                            {/* 4. Jatuh Tempo */}
                            <div className="min-w-0">
                              <span className={`whitespace-nowrap text-xs sm:text-sm ${loan.status === "OVERDUE" ? "font-semibold text-red-600" : "text-slate-600"}`}>
                                {formatDate(loan.dueAt)}
                              </span>
                            </div>

                            {/* 5. Dikembalikan */}
                            <div className="min-w-0">
                              <span className="whitespace-nowrap text-xs sm:text-sm text-slate-600">
                                {loan.status === "COMPLETED" && loan.returnedAt
                                  ? formatDate(loan.returnedAt)
                                  : "-"}
                              </span>
                            </div>

                            {/* 6. Status Badge */}
                            <div className="flex justify-end shrink-0">
                              <Badge variant={getStatusVariant(loan.status)}>
                                {statusLabel[loan.status] || loan.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
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

function TransactionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h8M8 12h8M8 16h5" />
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


function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
