"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import FeedbackPanel from "@/components/ui/FeedbackPanel";
import LoadingState from "@/components/ui/LoadingState";

import { getSession } from "@/lib/auth";
import { isSupportedRole } from "@/lib/authorization";
import { getDashboardApi } from "@/lib/api";
import type { Loan, UserRole } from "@/lib/types";

interface DashboardData {
  booksAvailable: number;
  booksBorrowed: number;
  activeLoans: number;
  overdueLoans: number;
  recentLoans: Array<Loan & { memberName: string }>;
}

const statusLabel: Record<Loan["status"], string> = {
  ACTIVE: "Aktif",
  OVERDUE: "Terlambat",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

function getStatusVariant(
  status: Loan["status"],
): "success" | "warning" | "danger" | "neutral" {
  if (status === "ACTIVE") return "warning";
  if (status === "OVERDUE") return "danger";
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED") return "danger";

  return "neutral";
}

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

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20"
      />
    </svg>
  );
}

function BookDetailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 18.5A2.5 2.5 0 0 1 7.5 16H20"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6h7M9 9h5" />
    </svg>
  );
}

function TransactionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 8h8M8 12h8M8 16h5"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 21 20H3L12 3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16h.01" />
    </svg>
  );
}

function LoanIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v6M9 10h6" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 14V8M9.5 11.5 12 14l2.5-2.5"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 4v5h-5" />
    </svg>
  );
}

function MemberIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 20a5.5 5.5 0 0 1 11 0"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 11a3 3 0 1 0 0-6"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 14.5a5.5 5.5 0 0 1 4.5 5.5"
      />
    </svg>
  );
}

function DashboardStatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
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
    <a
      href={href}
      className={`group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
    >
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>

        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{title}</h3>

          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </a>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const session = getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      if (!isSupportedRole(session.user.role)) {
        router.replace("/login");
        return;
      }

      setRole(session.user.role);
      setName(session.user.name);

      try {
        const result = await getDashboardApi();

        setData(result);
      } catch {
        setError("Data dashboard gagal dimuat.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <LoadingState label="Memuat dashboard..." />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-lg font-semibold text-slate-900">
            Dashboard tidak dapat dimuat
          </h1>

          <FeedbackPanel tone="error" className="mt-3">
            <p>{error}</p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 min-h-11 rounded-app border border-danger-border bg-app-surface px-4 py-2 font-semibold text-danger transition hover:bg-danger-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Coba lagi
            </button>
          </FeedbackPanel>
        </Card>
      </main>
    );
  }

  const isCompanyAdmin = role === "COMPANY_ADMIN";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="page-container py-6">
        {/* Header Dashboard */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Selamat datang, {name}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {isCompanyAdmin
              ? "Ringkasan dan pengelolaan operasional perpustakaan."
              : "Ringkasan operasional perpustakaan."}
          </p>
        </div>

        {/* Statistik */}
        <section
          aria-label="Ringkasan perpustakaan"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <DashboardStatCard
            label="Buku tersedia"
            value={data.booksAvailable}
            icon={<BookIcon />}
          />

          <DashboardStatCard
            label="Buku sedang dipinjam"
            value={data.booksBorrowed}
            icon={<BookDetailIcon />}
          />

          <DashboardStatCard
            label="Transaksi aktif"
            value={data.activeLoans}
            icon={<TransactionIcon />}
          />

          <DashboardStatCard
            label="Transaksi terlambat"
            value={data.overdueLoans}
            icon={<WarningIcon />}
          />
        </section>

        {/* Akses Cepat */}
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {isCompanyAdmin ? "Pengelolaan" : "Akses cepat"}
          </h2>

          {isCompanyAdmin ? (
            <div className="mt-3 space-y-4">
              {/* Tablet: 2 - 1, Desktop: 3 */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <QuickAccessCard
                  href="/loans"
                  title="Peminjaman"
                  description="Pantau transaksi peminjaman yang sedang berjalan."
                  icon={<LoanIcon />}
                />

                <QuickAccessCard
                  href="/returns"
                  title="Pengembalian"
                  description="Pantau proses dan status pengembalian buku."
                  icon={<ReturnIcon />}
                />

                <QuickAccessCard
                  href="/transactions"
                  title="Riwayat Transaksi"
                  description="Lihat seluruh riwayat transaksi perpustakaan."
                  icon={<HistoryIcon />}
                  className="md:col-span-2 xl:col-span-1"
                />
              </div>

              {/* Tablet & desktop: 2 */}
              <div className="grid gap-4 md:grid-cols-2">
                <QuickAccessCard
                  href="/master/books"
                  title="Master Buku"
                  description="Kelola data buku dan salinan buku."
                  icon={<BookDetailIcon />}
                />

                <QuickAccessCard
                  href="/master/members"
                  title="Master Member"
                  description="Kelola data anggota perpustakaan."
                  icon={<MemberIcon />}
                />
              </div>
            </div>
          ) : (
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {/* Catat Peminjaman */}
              <QuickAccessCard
                href="/loans/new"
                title="Catat Peminjaman"
                description="Catat transaksi peminjaman buku."
                icon={<LoanIcon />}
                className="xl:col-span-2"
              />

              {/* Catat Pengembalian */}
              <QuickAccessCard
                href="/returns"
                title="Catat Pengembalian"
                description="Proses pengembalian buku."
                icon={<ReturnIcon />}
                className="xl:col-span-2"
              />

              {/* Riwayat Transaksi */}
              <QuickAccessCard
                href="/transactions"
                title="Riwayat Transaksi"
                description="Lihat riwayat transaksi."
                icon={<HistoryIcon />}
                className="md:col-span-2"
              />
            </div>
          )}
        </section>

        {/* Aktivitas Terbaru */}
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">
              {isCompanyAdmin
                ? "Aktivitas Transaksi Terbaru"
                : "Aktivitas Terbaru"}
            </h2>
          </div>

          {data.recentLoans.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-medium text-slate-700">
                Belum ada aktivitas transaksi
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Aktivitas transaksi terbaru akan muncul di sini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentLoans.slice(0, 10).map((loan) => (
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
                      {formatDate(loan.borrowedAt)} -{" "}
                      {formatDate(
                        loan.status === "COMPLETED" && loan.returnedAt
                          ? loan.returnedAt
                          : loan.dueAt,
                      )}
                    </p>

                    <p className="whitespace-nowrap text-xs text-slate-500 sm:hidden">
                      {formatShortDate(loan.borrowedAt)} -{" "}
                      {formatShortDate(
                        loan.status === "COMPLETED" && loan.returnedAt
                          ? loan.returnedAt
                          : loan.dueAt,
                      )}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="col-start-2 row-start-1 flex justify-center xl:col-start-4 xl:row-start-1">
                    <Badge variant={getStatusVariant(loan.status)}>
                      {statusLabel[loan.status]}
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
