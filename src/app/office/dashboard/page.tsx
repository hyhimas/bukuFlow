"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Skeleton, { TableSkeleton } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import InactiveCompanyState, {
  isCompanyInactiveError,
  isStoredCompanyInactive,
} from "@/components/office/InactiveCompanyState";
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
  variant = "default",
  loading = false,
  href,
  className = "",
}: {
  label: string;
  value: number | string | null | undefined;
  icon: React.ReactNode;
  variant?: "default" | "danger";
  loading?: boolean;
  href?: string;
  className?: string;
}) {
  const isDanger = variant === "danger" && typeof value === "number" && value > 0;
  const isInteractive = Boolean(href && !loading && value !== null && value !== undefined);

  const cardElement = (
    <Card
      className={`p-5 transition-all duration-200 ${
        isInteractive
          ? isDanger
            ? "cursor-pointer hover:border-red-400 hover:shadow-md active:scale-[0.99]"
            : "cursor-pointer hover:border-blue-300 hover:shadow-md active:scale-[0.99]"
          : "cursor-default"
      } ${
        isDanger ? "border-red-200 bg-red-50/25" : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <div
            className={`mt-2 text-2xl sm:text-3xl font-bold ${
              isDanger ? "text-red-600" : "text-text-main"
            }`}
          >
            {loading ? (
              <Skeleton className="h-8 w-16 rounded" />
            ) : value === null || value === undefined ? (
              <span className="text-text-muted font-normal text-xl">
                -
              </span>
            ) : (
              value
            )}
          </div>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
            isDanger
              ? isInteractive
                ? "bg-red-100 text-red-600 group-hover:bg-red-200/80"
                : "bg-red-100 text-red-600"
              : isInteractive
              ? "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
              : "bg-blue-50 text-blue-600"
          }`}
        >
          {icon}
        </div>
      </div>
    </Card>
  );

  if (isInteractive && href) {
    return (
      <Link
        href={href}
        className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={`${label}: ${value ?? ""}. Buka daftar.`}
      >
        {cardElement}
      </Link>
    );
  }

  return cardElement;
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
      className={`group rounded-xl border border-border bg-surface p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
    >
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
          {icon}
        </div>

        <div className="min-w-0">
          <h3 className="font-semibold text-text-main group-hover:text-blue-600 transition">{title}</h3>
          <p className="mt-1 text-sm text-text-muted">{description}</p>
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

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const selectedCompanyName = selectedCompany?.name || "Instansi ini";
  const isInactiveCompany =
    selectedCompany?.status === "INACTIVE" ||
    selectedCompany?.status === "SUSPENDED" ||
    isStoredCompanyInactive(selectedCompanyId) ||
    isCompanyInactiveError(error);

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
      <div className="min-h-screen bg-surface-subtle" role="status" aria-label="Memeriksa otorisasi Super Admin...">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64 rounded-lg" />
              <Skeleton className="h-4 w-96 max-w-full rounded" />
            </div>
            <Skeleton className="h-10 w-48 rounded-xl shrink-0" />
          </div>

          {/* Stats Skeleton */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-8 w-20 rounded" />
                  </div>
                  <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
                </div>
              </Card>
            ))}
          </div>

          {/* Quick Access Skeleton */}
          <div className="space-y-3">
            <Skeleton className="h-6 w-48 rounded" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-36 rounded" />
                    <Skeleton className="h-4 w-full rounded" />
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-36 rounded" />
                    <Skeleton className="h-4 w-full rounded" />
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Table Skeleton */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <Skeleton className="h-5 w-44 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
            <TableSkeleton rows={4} cols={6} />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
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
            <h2 className="mt-4 text-lg font-semibold text-text-main">Pilih Instansi Terlebih Dahulu</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
              Sebelum memuat ringkasan operasional, silakan pilih salah satu instansi melalui pemilih instansi di atas.
            </p>
          </Card>
        ) : isInactiveCompany ? (
          <InactiveCompanyState
            companyName={selectedCompanyName}
            description="Ringkasan operasional dan statistik ditangguhkan karena instansi ini sedang dalam status nonaktif."
            className="mt-6"
          />
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
                value={dashboardData ? dashboardData.booksAvailable : null}
                loading={loading}
                icon={<BookIcon />}
                href={selectedCompanyId ? "/office/books" : undefined}
              />

              <DashboardStatCard
                label="Peminjaman Aktif"
                value={dashboardData ? dashboardData.activeLoans : null}
                loading={loading}
                icon={<TransactionIcon />}
                href={selectedCompanyId ? "/office/loans?status=ACTIVE" : undefined}
              />

              <DashboardStatCard
                label="Peminjaman Terlambat"
                value={dashboardData ? dashboardData.overdueLoans : null}
                variant={typeof dashboardData?.overdueLoans === "number" && dashboardData.overdueLoans > 0 ? "danger" : "default"}
                loading={loading}
                icon={<ClockIcon />}
                href={selectedCompanyId ? "/office/loans?status=OVERDUE" : undefined}
                className="sm:col-span-2 lg:col-span-1"
              />
            </section>

            {/* ===================================================
                PENGELOLAAN PLATFORM
            ==================================================== */}
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-text-main">
                Pusat Kendali & Otorisasi Khusus
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">
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
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="font-semibold text-text-main">
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
                <TableSkeleton rows={4} cols={6} />
              ) : recentLoans.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-medium text-text-secondary">
                    Belum ada aktivitas transaksi
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    Aktivitas transaksi terbaru instansi ini akan muncul di sini.
                  </p>
                </div>
              ) : (
                <div>
                  {/* Tampilan Mobile (< md): 100% Fluid Width, Status Badge selalu terlihat di kanan */}
                  <div className="divide-y divide-border-subtle md:hidden">
                    {recentLoans.slice(0, 10).map((loan) => (
                      <div key={loan.id} className="flex flex-col gap-1.5 p-4 transition hover:bg-surface-subtle">
                        {/* Baris 1: No Transaksi (Kiri) & Nama Member (Kanan) */}
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className="shrink-0 font-mono text-sm font-bold text-text-main"
                            title={loan.rawLoanNumber ? `ID Sistem: ${loan.rawLoanNumber}` : loan.loanNumber}
                          >
                            {loan.loanNumber}
                          </span>
                          <span
                            className="truncate text-right text-sm font-medium text-text-secondary max-w-[55%]"
                            title={loan.memberName || (loan.memberNumber ? `No. Anggota: ${loan.memberNumber}` : loan.memberId !== "-" ? `ID Anggota: ${loan.memberId}` : "Anggota")}
                          >
                            {loan.memberName || (loan.memberNumber ? `Anggota (${loan.memberNumber})` : "Anggota")}
                          </span>
                        </div>

                        {/* Baris 2: Tgl Pinjam (Kiri) & Jatuh Tempo (Kanan) */}
                        <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
                          <span className="truncate">
                            <span className="font-medium text-text-muted">Pinjam: </span>
                            {formatDate(loan.borrowedAt)}
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="font-medium text-text-muted">Jatuh Tempo: </span>
                            <span className={loan.status === "OVERDUE" ? "font-semibold text-red-600" : ""}>
                              {formatDate(loan.dueAt)}
                            </span>
                          </span>
                        </div>

                        {/* Baris 3: Tgl Kembali (Kiri) & Badge Status (Kanan) */}
                        <div className="flex items-center justify-between gap-3 text-xs pt-0.5">
                          <span className="truncate text-text-muted">
                            <span className="font-medium text-text-muted">Kembali: </span>
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
                      <div className="grid grid-cols-[minmax(115px,1.2fr)_minmax(115px,1.2fr)_minmax(92px,1fr)_minmax(92px,1fr)_minmax(92px,1fr)_85px] items-center gap-x-3 border-b border-border-subtle bg-surface-subtle px-4 sm:px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                        <div>Nomor Peminjaman</div>
                        <div>Anggota</div>
                        <div>Tgl Pinjam</div>
                        <div>Jatuh Tempo</div>
                        <div>Dikembalikan</div>
                        <div className="text-right">Status</div>
                      </div>

                      <div className="divide-y divide-border-subtle">
                        {recentLoans.slice(0, 10).map((loan) => (
                          <div
                            key={loan.id}
                            className="grid grid-cols-[minmax(115px,1.2fr)_minmax(115px,1.2fr)_minmax(92px,1fr)_minmax(92px,1fr)_minmax(92px,1fr)_85px] items-center gap-x-3 px-4 sm:px-5 py-3 transition hover:bg-surface-subtle"
                          >
                            {/* 1. Nomor transaksi */}
                            <div className="min-w-0">
                              <p
                                className="whitespace-nowrap text-sm font-semibold text-text-main font-mono"
                                title={loan.rawLoanNumber ? `ID Sistem: ${loan.rawLoanNumber}` : loan.loanNumber}
                              >
                                {loan.loanNumber}
                              </p>
                            </div>

                            {/* 2. Nama member */}
                            <div className="min-w-0">
                              <p
                                className="truncate text-xs sm:text-sm text-text-secondary"
                                title={loan.memberName || (loan.memberNumber ? `No. Anggota: ${loan.memberNumber}` : loan.memberId !== "-" ? `ID Anggota: ${loan.memberId}` : "Anggota")}
                              >
                                {loan.memberName || (loan.memberNumber ? `Anggota (${loan.memberNumber})` : "Anggota")}
                              </p>
                            </div>

                            {/* 3. Tanggal Pinjam */}
                            <div className="min-w-0">
                              <span className="whitespace-nowrap text-xs sm:text-sm text-text-secondary">
                                {formatDate(loan.borrowedAt)}
                              </span>
                            </div>

                            {/* 4. Jatuh Tempo */}
                            <div className="min-w-0">
                              <span className={`whitespace-nowrap text-xs sm:text-sm ${loan.status === "OVERDUE" ? "font-semibold text-red-600" : "text-text-secondary"}`}>
                                {formatDate(loan.dueAt)}
                              </span>
                            </div>

                            {/* 5. Dikembalikan */}
                            <div className="min-w-0">
                              <span className="whitespace-nowrap text-xs sm:text-sm text-text-secondary">
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
