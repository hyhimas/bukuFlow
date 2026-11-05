"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ErrorState from "@/components/ui/ErrorState";
import Pagination from "@/components/ui/Pagination";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton, { TableSkeleton } from "@/components/ui/Skeleton";

import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import { isSupportedRole, canViewOfficer } from "@/lib/authorization";
import { getDashboardApi, getActiveReturnsApi, getCompanySettingsApi, getErrorMessage } from "@/lib/api";
import {
  calculateTransactionCirculation,
  type ExemplarFineDetail,
} from "@/lib/circulation";
import type { Loan, ReturnLoanData, UserRole } from "@/lib/types";

interface DashboardData {
  booksAvailable?: number | null;
  booksBorrowed?: number | null;
  activeLoans?: number | null;
  overdueLoans?: number | null;
  recentLoans: Array<Loan & { memberName: string }>;
}

interface WorklistItem {
  id: string;
  loanNumber: string;
  memberName: string;
  memberNumber: string;
  bookTitles: string;
  bookCount: number;
  borrowedAt: string;
  dueAt: string;
  daysOverdue: number;
  fineAmount: number | null;
  status: "ACTIVE" | "OVERDUE" | "COMPLETED";
  isToday: boolean;
  exemplarDetails: ExemplarFineDetail[];
  rawItem: ReturnLoanData;
}

const statusLabel: Record<Loan["status"], string> = {
  ACTIVE: "Aktif",
  OVERDUE: "Terlambat",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

function getStatusVariant(
  status: Loan["status"]
): "success" | "warning" | "danger" | "neutral" {
  if (status === "ACTIVE") return "neutral";
  if (status === "OVERDUE") return "danger";
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED") return "neutral";

  return "neutral";
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
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

function CompanyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V5l8-2v17M12 20h8V8l-8-3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h2M7 12h2M7 16h2M15 11h2M15 15h2" />
    </svg>
  );
}

function UsersIcon() {
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 14a5 5 0 0 1 5 5" />
    </svg>
  );
}

function DashboardStatCard({
  label,
  value,
  icon,
  variant = "default",
  href,
  className = "",
}: {
  label: string;
  value?: number | string | null;
  icon: React.ReactNode;
  variant?: "default" | "danger";
  href?: string;
  className?: string;
}) {
  const isMissing =
    value === undefined ||
    value === null ||
    (typeof value === "number" && !Number.isFinite(value));
  const isDanger = !isMissing && variant === "danger" && typeof value === "number" && value > 0;
  const isInteractive = Boolean(href && !isMissing);

  const cardElement = (
    <Card
      className={`h-full p-4 sm:p-5 transition-all duration-200 ${
        isInteractive
          ? isDanger
            ? "cursor-pointer hover:border-red-400 hover:shadow-md active:scale-[0.99]"
            : "cursor-pointer hover:border-blue-300 hover:shadow-md active:scale-[0.99]"
          : "cursor-default"
      } ${
        isDanger
          ? "border-red-200 bg-red-50/25"
          : ""
      } ${!isInteractive || !href ? className : ""}`}
    >
      <div className="flex items-center justify-between gap-2.5 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-text-muted leading-tight truncate sm:whitespace-normal" title={label}>
            {label}
          </p>
          {isMissing ? (
            <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-normal text-text-muted">
              Gagal memuat
            </p>
          ) : (
            <p
              className={`mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold truncate ${
                isDanger ? "text-red-600" : "text-text-main"
              }`}
            >
              {value}
            </p>
          )}
        </div>

        <div
          className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
            isDanger
              ? isInteractive
                ? "bg-red-100 text-red-600 group-hover:bg-red-200/80"
                : "bg-red-100 text-red-600"
              : isMissing
              ? "bg-warning-soft text-warning-text"
              : isInteractive
              ? "bg-brand-soft text-brand-text group-hover:bg-blue-100"
              : "bg-brand-soft text-brand-text"
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
        className={`group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
        aria-label={`${label}: ${value ?? ""}. Buka daftar terfilter.`}
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
      className={`group rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 flex flex-col justify-center h-full ${className}`}
    >
      <div className="flex items-start gap-3.5 sm:gap-4">
        <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text transition group-hover:bg-brand-soft/80">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-text-main text-sm sm:text-base group-hover:text-blue-500 transition leading-snug">
            {title}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-text-muted leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [role, setRole] = useState<UserRole | null>(() => {
    if (typeof window === "undefined") return null;
    return getSession()?.user?.role ?? null;
  });
  const [name, setName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return getSession()?.user?.name ?? "";
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [worklist, setWorklist] = useState<WorklistItem[]>([]);
  const [dailyFineRate, setDailyFineRate] = useState<number | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<WorklistItem | null>(null);
  const [worklistFilter, setWorklistFilter] = useState<"ALL" | "TODAY" | "OVERDUE">("ALL");
  const [worklistSearch, setWorklistSearch] = useState("");
  const [worklistPage, setWorklistPage] = useState(1);
  const [worklistPageSize, setWorklistPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [configError, setConfigError] = useState("");
  const hasLoadedRef = useRef<boolean>(false);
  const lastLoadTimeRef = useRef<number>(0);

  const loadDashboard = useCallback(async (isBackground = false) => {
    const session = getSession();

    if (!session) {
      if (!isStoredSessionExpired() && !hasStoredAuth()) {
        router.replace("/login");
      }
      return;
    }

    if (!isSupportedRole(session.user.role)) {
      router.replace("/login");
      return;
    }

    if (session.user.role === "SUPER_ADMIN") {
      router.replace("/office/dashboard");
      return;
    }

    setRole(session.user.role);
    setName(session.user.name);

    // Jangan tampilkan skeleton jika data sudah pernah dimuat (background refresh)
    if (!isBackground && !hasLoadedRef.current) {
      setLoading(true);
    }
    if (!isBackground) {
      setError("");
      setConfigError("");
    }

    try {
      const companyId = session?.user?.companyId;
      const [settingsResult, dashResult, returnsResult] = await Promise.all([
        companyId
          ? getCompanySettingsApi(companyId).catch((cfgErr: unknown) => {
              if (!isBackground) {
                setConfigError(getErrorMessage(cfgErr, "Gagal memuat konfigurasi kebijakan denda."));
              }
              return null;
            })
          : Promise.resolve(null),
        getDashboardApi(),
        getActiveReturnsApi({ size: 10 }),
      ]);

      const hasKpiData = [
        dashResult.booksAvailable,
        dashResult.activeLoans,
        dashResult.overdueLoans,
      ].some((value) => typeof value === "number" && Number.isFinite(value));

      if (!hasKpiData) {
        throw new Error("Data statistik dashboard gagal dimuat.");
      }

      setData(dashResult);

      const fineRate =
        settingsResult && typeof settingsResult.dailyFineRate === "number"
          ? settingsResult.dailyFineRate
          : null;
      setDailyFineRate(fineRate);

      // Compute worklist: "Jatuh tempo hari ini" & "Terlambat"
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const computedWorklist: WorklistItem[] = [];

      returnsResult.items.forEach((item) => {
        // Hitung denda dan status transaksi per eksemplar
        const circ = calculateTransactionCirculation(
          item.loan,
          item.items,
          fineRate,
          todayStr
        );

        // Abaikan transaksi yang seluruh bukunya sudah dikembalikan (COMPLETED)
        if (circ.overallStatus === "COMPLETED") return;

        const borrowedItems = item.items.filter((it) => it.loanItem.status === "BORROWED");
        if (borrowedItems.length === 0) return;

        const borrowedTitles = borrowedItems
          .map((it) => it.book.title)
          .join(", ");

        const dueStr = item.loan.dueAt ? item.loan.dueAt.slice(0, 10) : "";
        const isToday = dueStr === todayStr;
        const isOverdue = circ.overallStatus === "OVERDUE";

        // Worklist memuat peminjaman yang jatuh tempo hari ini atau yang terlambat
        if (isToday || isOverdue) {
          computedWorklist.push({
            id: item.loan.id,
            loanNumber: item.loan.loanNumber,
            memberName: item.member.name,
            memberNumber: item.member.memberNumber || "-",
            bookTitles: borrowedTitles || "1 buku",
            bookCount: borrowedItems.length,
            borrowedAt: item.loan.borrowedAt || "",
            dueAt: item.loan.dueAt,
            daysOverdue: circ.maxDaysOverdue,
            fineAmount: circ.totalFine,
            status: circ.overallStatus,
            isToday,
            exemplarDetails: circ.items,
            rawItem: item,
          });
        }
      });

      // Sort: overdue highest days first. If same overdue days, sort by latest due date / activity
      computedWorklist.sort((a, b) => {
        if (b.daysOverdue !== a.daysOverdue) {
          return b.daysOverdue - a.daysOverdue;
        }
        const timeA = new Date(a.dueAt || 0).getTime();
        const timeB = new Date(b.dueAt || 0).getTime();
        return timeB - timeA;
      });
      setWorklist(computedWorklist);
      hasLoadedRef.current = true;
      lastLoadTimeRef.current = Date.now();
    } catch (err: unknown) {
      if (!hasLoadedRef.current) {
        setError(
          getErrorMessage(err, "Data dashboard gagal dimuat.")
        );
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch data agregat dashboard saat halaman pertama kali dimuat
    void loadDashboard();

    const handleSettingsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ dailyFineRate?: number }>;
      if (customEvent.detail && typeof customEvent.detail.dailyFineRate === "number") {
        setDailyFineRate(customEvent.detail.dailyFineRate);
        void loadDashboard(true);
      }
    };

    const handleWindowFocus = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      // Hanya revalidate di latar belakang jika data sudah lebih dari 60 detik
      if (now - lastLoadTimeRef.current > 60_000) {
        void loadDashboard(true);
      }
    };

    window.addEventListener("company-settings-updated", handleSettingsUpdated);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("company-settings-updated", handleSettingsUpdated);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [loadDashboard]);

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle px-4">
        <div className="w-full max-w-md">
          <ErrorState
            title="Dashboard Tidak Dapat Dimuat"
            message={error || "Gagal memuat data dashboard."}
            onRetry={() => void loadDashboard()}
            retryLabel="Coba Lagi"
          />
        </div>
      </div>
    );
  }

  const isCompanyAdmin = role === "COMPANY_ADMIN";
  const isStaff = role === "STAFF";

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const beforeTodayIso = `${todayStr}T00:00:00.000Z`;

  const countToday = worklist.filter((w) => w.isToday).length;
  const countOverdue = worklist.filter((w) => !w.isToday).length;

  const filteredWorklist = worklist.filter((w) => {
    // Filter tab: TODAY vs OVERDUE vs ALL
    if (worklistFilter === "TODAY" && !w.isToday) return false;
    if (worklistFilter === "OVERDUE" && w.isToday) return false;

    // Filter teks pencarian (nama anggota, nomor peminjaman, judul buku)
    if (worklistSearch.trim()) {
      const q = worklistSearch.toLowerCase().trim();
      const matchMember = w.memberName.toLowerCase().includes(q);
      const matchLoan = w.loanNumber.toLowerCase().includes(q);
      const matchBook = w.bookTitles.toLowerCase().includes(q);
      if (!matchMember && !matchLoan && !matchBook) return false;
    }

    return true;
  });

  const totalWorklistPages = Math.max(1, Math.ceil(filteredWorklist.length / worklistPageSize));
  const safeWorklistPage = Math.min(Math.max(1, worklistPage), totalWorklistPages);
  const paginatedWorklist = filteredWorklist.slice(
    (safeWorklistPage - 1) * worklistPageSize,
    safeWorklistPage * worklistPageSize
  );

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="page-container py-6">
        {/* Header Dashboard */}
        <div className="mb-6">
          <PageHeader
            title={`Selamat datang, ${name}`}
            description={
              isCompanyAdmin
                ? "Ringkasan dan pengelolaan operasional perpustakaan."
                : "Ringkasan operasional perpustakaan."
            }
          />
        </div>

        {/* Statistik */}
        {loading || !data ? (
          <section
            aria-label="Memuat ringkasan perpustakaan"
            className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                  <Skeleton className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl shrink-0" />
                </div>
              </Card>
            ))}
          </section>
        ) : (
          <section
            aria-label="Ringkasan perpustakaan"
            className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3"
          >
            <DashboardStatCard
              label="Buku Tersedia"
              value={data.booksAvailable}
              icon={<BookIcon />}
              href={isCompanyAdmin ? "/master/books" : undefined}
            />

            <DashboardStatCard
              label="Peminjaman Aktif"
              value={data.activeLoans}
              icon={<TransactionIcon />}
              href={isStaff ? "/returns" : "/transactions?status=ACTIVE"}
            />

            <DashboardStatCard
              label="Peminjaman Terlambat"
              value={data.overdueLoans}
              icon={<WarningIcon />}
              variant={typeof data.overdueLoans === "number" && data.overdueLoans > 0 ? "danger" : "default"}
              href={isStaff ? "/returns?status=OVERDUE" : "/transactions?status=OVERDUE"}
            />
          </section>
        )}

        {/* WORKLIST: JATUH TEMPO HARI INI & TERLAMBAT */}
        <section className="mt-6">
          {configError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-800 flex items-start gap-3">
              <svg className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-semibold text-amber-900">Perhatian: Konfigurasi Denda Belum Dimuat</p>
                <p className="mt-0.5 text-amber-700">{configError}</p>
                <p className="mt-1 text-xs text-amber-600">Nominal denda belum dapat dihitung secara akurat tanpa kebijakan resmi dari server.</p>
              </div>
            </div>
          )}
          <div className="mb-3.5 space-y-3">
            {/* Header Title */}
            <div>
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <span>Worklist Jatuh Tempo & Terlambat</span>
                {worklist.length > 0 && (
                  <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-bold">
                    {worklist.length}
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm text-text-muted">
                Daftar transaksi yang perlu segera diproses pengembaliannya hari ini.
              </p>
            </div>

            {/* Toolbar: Filter Tabs + Search Box */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              {/* Filter Tabs */}
              <div
                role="group"
                aria-label="Filter antrean kerja"
                className="flex items-center gap-1 self-start overflow-x-auto max-w-full rounded-lg bg-surface-muted p-1 text-xs font-medium"
              >
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setWorklistFilter("ALL");
                    setWorklistPage(1);
                  }}
                  aria-pressed={worklistFilter === "ALL"}
                  className={`min-h-0 px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${
                    worklistFilter === "ALL"
                      ? "bg-surface text-text-main font-semibold shadow-xs hover:bg-surface hover:text-text-main"
                      : "text-text-secondary hover:text-text-main hover:bg-surface-muted"
                  }`}
                >
                  Semua ({worklist.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setWorklistFilter("TODAY");
                    setWorklistPage(1);
                  }}
                  aria-pressed={worklistFilter === "TODAY"}
                  className={`min-h-0 px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${
                    worklistFilter === "TODAY"
                      ? "bg-surface text-amber-800 font-semibold shadow-xs hover:bg-surface hover:text-amber-800"
                      : "text-text-secondary hover:text-text-main hover:bg-surface-muted"
                  }`}
                >
                  Jatuh Tempo Hari Ini ({countToday})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setWorklistFilter("OVERDUE");
                    setWorklistPage(1);
                  }}
                  aria-pressed={worklistFilter === "OVERDUE"}
                  className={`min-h-0 px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${
                    worklistFilter === "OVERDUE"
                      ? "bg-surface text-red-700 font-semibold shadow-xs hover:bg-surface hover:text-red-700"
                      : "text-text-secondary hover:text-text-main hover:bg-surface-muted"
                  }`}
                >
                  Terlambat ({countOverdue})
                </Button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64 md:w-72">
                <input
                  type="text"
                  value={worklistSearch}
                  onChange={(e) => {
                    setWorklistSearch(e.target.value);
                    setWorklistPage(1);
                  }}
                  placeholder="Cari anggota, nomor, judul..."
                  aria-label="Cari antrean kerja"
                  className="w-full h-9 rounded-lg border border-border bg-surface pl-8 pr-7 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                <svg
                  className="absolute left-2.5 top-2.5 h-4 w-4 text-text-subtle pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {worklistSearch && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setWorklistSearch("");
                      setWorklistPage(1);
                    }}
                    aria-label="Hapus pencarian"
                    className="absolute right-1 top-1 h-7 w-7 min-h-0 min-w-0 p-0 text-text-subtle hover:text-text-secondary rounded"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Card className="overflow-hidden border-border">
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={3} cols={4} />
              </div>
            ) : filteredWorklist.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="font-semibold text-text-main text-sm">
                  {worklistSearch.trim()
                    ? `Tidak ada transaksi yang cocok dengan "${worklistSearch}".`
                    : worklistFilter === "TODAY"
                    ? "Tidak ada peminjaman yang jatuh tempo hari ini."
                    : worklistFilter === "OVERDUE"
                    ? "Tidak ada peminjaman yang terlambat."
                    : "Tidak ada peminjaman yang jatuh tempo hari ini atau terlambat."}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {worklistSearch.trim()
                    ? "Coba periksa kembali kata kunci pencarian Anda atau ganti tab filter."
                    : "Semua transaksi aktif dalam kondisi tertib."}
                </p>
                {worklistSearch.trim() && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setWorklistSearch("");
                      setWorklistPage(1);
                    }}
                    className="mt-3 text-xs"
                  >
                    Atur Ulang Pencarian
                  </Button>
                )}
              </div>
            ) : (
              <div>
                {/* Mobile View (< md): Stacked Cards */}
                <div className="divide-y divide-border-subtle md:hidden">
                  {paginatedWorklist.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 space-y-3 transition hover:bg-surface-subtle/70"
                    >
                      {/* Baris Atas: Transaksi / Member & Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-xs text-text-main truncate" title={item.loanNumber}>
                            {item.loanNumber}
                          </p>
                          <p className="font-semibold text-text-main text-sm truncate mt-0.5" title={item.memberName}>
                            {item.memberName}
                          </p>
                        </div>

                        <Badge
                          variant={
                            item.status === "COMPLETED"
                              ? "success"
                              : item.status === "OVERDUE"
                              ? "danger"
                              : item.isToday
                              ? "warning"
                              : "neutral"
                          }
                          className="shrink-0"
                        >
                          {item.status === "COMPLETED"
                            ? "Selesai"
                            : item.status === "OVERDUE"
                            ? `${item.daysOverdue} hr terlambat`
                            : item.isToday
                            ? "Hari ini"
                            : "Aktif"}
                        </Badge>
                      </div>

                      {/* Info 2 Kolom: Jatuh Tempo & Denda */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-surface p-2.5 border border-border/80 shadow-2xs">
                          <span className="text-[11px] text-text-muted block">Jatuh Tempo</span>
                          <span className="font-semibold text-text-main tabular-nums">
                            {formatDate(item.dueAt)}
                          </span>
                        </div>
                        <div className={`rounded-lg p-2.5 border shadow-2xs ${
                          item.fineAmount === null
                            ? "bg-warning-soft border-warning-border text-warning-text"
                            : item.fineAmount > 0
                            ? "bg-danger-soft border-danger-border text-danger-text"
                            : "bg-surface-subtle border-border/80 text-text-secondary"
                        }`}>
                          <span className="text-[11px] text-text-muted block">Total Denda</span>
                          <span className={`font-semibold tabular-nums ${
                            item.fineAmount === null
                              ? "text-warning-text"
                              : item.fineAmount > 0
                              ? "text-danger-text font-bold"
                              : "text-text-secondary"
                          }`}>
                            {item.fineAmount === null
                              ? "Menunggu konfigurasi"
                              : item.fineAmount > 0
                              ? `Rp ${item.fineAmount.toLocaleString("id-ID")}`
                              : "-"}
                          </span>
                        </div>
                      </div>

                      {/* Baris Bawah: Tombol Detail */}
                      <div className="pt-2.5 border-t border-border-subtle flex items-center justify-between">
                        <span className="text-xs text-text-secondary">Pilihan Aksi</span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedDetailItem(item)}
                          className="inline-flex items-center gap-1.5"
                        >
                          <svg className="h-3.5 w-3.5 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                          <span>Detail</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop & Tablet View (>= md): Ringkas 5 Kolom Bebas Horizontal Scroll */}
                <div className="hidden md:block w-full overflow-x-auto">
                  <table className="w-full table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[30%]" />
                      <col className="w-[18%]" />
                      <col className="w-[18%]" />
                      <col className="w-[18%]" />
                      <col className="w-[16%]" />
                    </colgroup>
                    <thead className="border-b border-border bg-slate-100 dark:bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <tr>
                        <th className="px-3.5 sm:px-4 py-3 font-semibold">Transaksi / Member</th>
                        <th className="px-3 sm:px-3.5 py-3 font-semibold">Jatuh Tempo</th>
                        <th className="px-3 sm:px-3.5 py-3 font-semibold">Status</th>
                        <th className="px-3 sm:px-3.5 py-3 font-semibold">Denda</th>
                        <th className="px-3.5 sm:px-4 py-3 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle bg-surface">
                      {paginatedWorklist.map((item) => (
                        <tr
                          key={item.id}
                          className="transition hover:bg-surface-subtle/70"
                        >
                          {/* 1. Transaksi / Member */}
                          <td className="px-3.5 sm:px-4 py-3 min-w-0 align-middle">
                            <div className="flex flex-col min-w-0">
                              <span className="font-mono font-semibold text-xs text-text-main tracking-tight truncate" title={item.loanNumber}>
                                {item.loanNumber}
                              </span>
                              <span className="text-xs text-text-secondary truncate mt-0.5" title={item.memberName}>
                                {item.memberName}
                              </span>
                            </div>
                          </td>

                          {/* 2. Jatuh Tempo */}
                          <td className="px-3 sm:px-3.5 py-3 whitespace-nowrap align-middle">
                            <span className="text-xs sm:text-sm font-medium text-text-main tabular-nums">
                              {formatDate(item.dueAt)}
                            </span>
                          </td>

                          {/* 3. Status */}
                          <td className="px-3 sm:px-3.5 py-3 whitespace-nowrap align-middle">
                            <Badge
                              variant={
                                item.status === "COMPLETED"
                                  ? "success"
                                  : item.status === "OVERDUE"
                                  ? "danger"
                                  : item.isToday
                                  ? "warning"
                                  : "neutral"
                              }
                            >
                              {item.status === "COMPLETED"
                                ? "Selesai"
                                : item.status === "OVERDUE"
                                ? `Terlambat (${item.daysOverdue} hr)`
                                : item.isToday
                                ? "Hari Ini"
                                : "Aktif"}
                            </Badge>
                          </td>

                          {/* 4. Denda */}
                          <td className="px-3 sm:px-3.5 py-3 whitespace-nowrap align-middle">
                            {item.fineAmount === null ? (
                              <span className="text-xs font-semibold text-warning-text truncate block" title="Menunggu konfigurasi">
                                Menunggu konfigurasi
                              </span>
                            ) : item.fineAmount > 0 ? (
                              <span className="text-xs sm:text-sm font-bold text-danger-text tabular-nums">
                                Rp {item.fineAmount.toLocaleString("id-ID")}
                              </span>
                            ) : (
                              <span className="text-xs sm:text-sm font-medium text-text-secondary select-none">
                                -
                              </span>
                            )}
                          </td>

                          {/* 5. Aksi: Tombol Detail */}
                          <td className="px-3.5 sm:px-4 py-3 text-right whitespace-nowrap align-middle">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedDetailItem(item)}
                              className="inline-flex items-center gap-1.5"
                            >
                              <svg className="h-3.5 w-3.5 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                              <span>Detail</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          {/* PAGINATION (SEPARATE CARD) */}
          {filteredWorklist.length > worklistPageSize && (
            <div className="mt-4">
              <div className="rounded-xl border border-border bg-surface shadow-2xs">
                <Pagination
                  currentPage={safeWorklistPage}
                  totalPages={totalWorklistPages}
                  onPageChange={(nextPage) => setWorklistPage(nextPage)}
                  totalItems={filteredWorklist.length}
                  pageSize={worklistPageSize}
                  onPageSizeChange={(newSize) => {
                    setWorklistPageSize(newSize);
                    setWorklistPage(1);
                  }}
                  className="border-t-0 rounded-xl"
                />
              </div>
            </div>
          )}
        </section>

        {/* Akses Cepat */}
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-text-main">
            {isCompanyAdmin ? "Pengelolaan" : "Akses cepat"}
          </h2>

          {isCompanyAdmin ? (
            <div className="mt-3 grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              <QuickAccessCard
                href="/master/books"
                title="Master Buku"
                description="Kelola data buku dan eksemplar buku."
                icon={<BookDetailIcon />}
              />

              <QuickAccessCard
                href="/master/members"
                title="Master Anggota"
                description="Kelola data anggota perpustakaan."
                icon={<MemberIcon />}
              />

              <QuickAccessCard
                href="/settings/company"
                title="Konfigurasi Instansi"
                description="Kelola identitas dan aturan instansi."
                icon={<CompanyIcon />}
              />

              <QuickAccessCard
                href="/settings/users"
                title="Kelola Pengguna"
                description="Kelola akun staf dan administrator."
                icon={<UsersIcon />}
              />
            </div>
          ) : (
            <div className="mt-3 grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-3">
              <QuickAccessCard
                href="/loans/new"
                title="Catat Peminjaman"
                description="Catat transaksi peminjaman buku."
                icon={<LoanIcon />}
              />

              <QuickAccessCard
                href="/returns"
                title="Catat Pengembalian"
                description="Proses pengembalian buku."
                icon={<ReturnIcon />}
              />

              <QuickAccessCard
                href="/transactions"
                title="Riwayat Transaksi"
                description="Lihat riwayat transaksi perpustakaan."
                icon={<HistoryIcon />}
              />
            </div>
          )}
        </section>

        {/* Aktivitas Terbaru */}
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold text-text-main">
              {isCompanyAdmin
                ? "Aktivitas Transaksi Terbaru"
                : "Aktivitas Terbaru"}
            </h2>

            {data && data.recentLoans.length > 0 && (
              <Link
                href="/transactions"
                className="text-xs font-semibold text-brand-text hover:text-brand-hover transition"
              >
                Lihat semua →
              </Link>
            )}
          </div>

          {loading || !data ? (
            <div className="p-4">
              <TableSkeleton rows={3} cols={4} />
            </div>
          ) : data.recentLoans.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-medium text-text-secondary">
                Belum ada aktivitas transaksi
              </p>

              <p className="mt-1 text-sm text-text-muted">
                Aktivitas transaksi terbaru akan muncul di sini.
              </p>
            </div>
          ) : (
            <div>
              {/* Tampilan Mobile (< md): 100% Fluid Width, Status Badge selalu terlihat di kanan */}
              <div className="divide-y divide-border-subtle md:hidden">
                {data.recentLoans.slice(0, 10).map((loan) => (
                  <div key={loan.id} className="flex flex-col gap-1.5 p-4 transition hover:bg-surface-subtle/70">
                    {/* Baris 1: No Transaksi (Kiri) & Nama Member (Kanan) */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="shrink-0 font-mono text-sm font-bold text-text-main">
                        {loan.loanNumber}
                      </span>
                      <span className="truncate text-right text-sm font-medium text-text-secondary max-w-[55%]">
                        {loan.memberName}
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
                        {formatDate(loan.dueAt)}
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
                          {statusLabel[loan.status]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tampilan Desktop & Tablet (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <div className="min-w-[660px]">
                  {/* Table Header: Pisahkan Tanggal Pinjam, Jatuh Tempo, dan Dikembalikan */}
                  <div className="grid grid-cols-[minmax(115px,1.2fr)_minmax(115px,1.2fr)_minmax(92px,1fr)_minmax(92px,1fr)_minmax(92px,1fr)_85px] items-center gap-x-3 border-b border-border bg-slate-100 dark:bg-slate-800 px-4 sm:px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    <div>Nomor Peminjaman</div>
                    <div>Anggota</div>
                    <div>Tgl Pinjam</div>
                    <div>Jatuh Tempo</div>
                    <div>Dikembalikan</div>
                    <div className="text-right">Status</div>
                  </div>

                  <div className="divide-y divide-border-subtle">
                    {data.recentLoans.slice(0, 10).map((loan) => (
                      <div
                        key={loan.id}
                        className="grid grid-cols-[minmax(115px,1.2fr)_minmax(115px,1.2fr)_minmax(92px,1fr)_minmax(92px,1fr)_minmax(92px,1fr)_85px] items-center gap-x-3 px-4 sm:px-5 py-3 transition hover:bg-surface-subtle/70"
                      >
                        {/* 1. Nomor transaksi */}
                        <div className="min-w-0">
                          <p className="whitespace-nowrap text-sm font-semibold text-text-main font-mono">
                            {loan.loanNumber}
                          </p>
                        </div>

                        {/* 2. Nama member */}
                        <div className="min-w-0">
                          <p className="truncate text-xs sm:text-sm text-text-secondary">
                            {loan.memberName}
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
                          <span className="whitespace-nowrap text-xs sm:text-sm text-text-secondary">
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
                            {statusLabel[loan.status]}
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
      </div>

      {/* Modal Detail Transaksi Peminjaman */}
      {selectedDetailItem && (() => {
        const detailCirc = calculateTransactionCirculation(
          selectedDetailItem.rawItem.loan,
          selectedDetailItem.rawItem.items,
          dailyFineRate
        );

        return (
          <Modal
            open={Boolean(selectedDetailItem)}
            onClose={() => setSelectedDetailItem(null)}
            size="2xl"
            title="Detail Transaksi Peminjaman"
            description="Informasi lengkap transaksi dan rincian denda per eksemplar."
          >
            <div className="space-y-5 min-w-0 max-w-full">
              {/* Ringkasan Metadata Transaksi */}
              <div className="rounded-xl border border-border bg-surface-subtle p-4 space-y-3.5 text-xs">
                {/* Baris 1: Header (Kode Transaksi & Status) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-subtle">
                  <div>
                    <span className="text-text-muted block text-[11px] uppercase tracking-wider font-semibold">
                      Kode Transaksi
                    </span>
                    <span className="font-mono font-bold text-text-main text-base sm:text-lg">
                      {selectedDetailItem.loanNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        detailCirc.overallStatus === "COMPLETED"
                          ? "success"
                          : detailCirc.overallStatus === "OVERDUE"
                          ? "danger"
                          : selectedDetailItem.isToday
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {detailCirc.overallStatus === "COMPLETED"
                        ? "Selesai"
                        : detailCirc.overallStatus === "OVERDUE"
                        ? `Terlambat (${detailCirc.maxDaysOverdue} hari)`
                        : selectedDetailItem.isToday
                        ? "Jatuh Tempo Hari Ini"
                        : "Aktif"}
                    </Badge>
                    {detailCirc.totalFine !== null && detailCirc.totalFine > 0 && (
                      <span className="rounded-md bg-red-50 dark:bg-red-950/40 px-2.5 py-1 text-xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 tabular-nums">
                        Total Denda: Rp {detailCirc.totalFine.toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Baris 2: Entitas (Member & Petugas) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-border-subtle">
                  <div>
                    <span className="text-text-muted block text-[11px] uppercase tracking-wider font-semibold">
                      Anggota Peminjam
                    </span>
                    <span className="font-semibold text-text-main text-sm block mt-0.5">
                      {selectedDetailItem.memberName}
                    </span>
                    {selectedDetailItem.memberNumber && selectedDetailItem.memberNumber !== "-" && (
                      <span className="text-[11px] text-text-muted font-mono block mt-0.5">
                        No. Anggota: {selectedDetailItem.memberNumber}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-text-muted block text-[11px] uppercase tracking-wider font-semibold">
                      Petugas Pencatat
                    </span>
                    <span className="font-medium text-text-main text-sm block mt-0.5">
                      {canViewOfficer(role ?? undefined)
                        ? selectedDetailItem.rawItem.user?.name || "-"
                        : "Staf Perpustakaan"}
                    </span>
                    {canViewOfficer(role ?? undefined) && selectedDetailItem.rawItem.user?.role && (
                      <span className="text-[11px] text-text-muted block mt-0.5">
                        Hak Akses: {selectedDetailItem.rawItem.user.role}
                      </span>
                    )}
                  </div>
                </div>

                {/* Baris 3: Jadwal Sirkulasi (Selalu 3 Kolom Konsisten) */}
                <div className="grid grid-cols-3 gap-2.5 pt-0.5">
                  <div>
                    <span className="text-text-muted block text-[11px] uppercase tracking-wider font-semibold">
                      Tanggal Pinjam
                    </span>
                    <span className="font-medium text-text-main text-xs sm:text-sm mt-0.5 block whitespace-nowrap">
                      {formatDate(selectedDetailItem.borrowedAt)}
                    </span>
                  </div>

                  <div>
                    <span className="text-text-muted block text-[11px] uppercase tracking-wider font-semibold">
                      Jatuh Tempo
                    </span>
                    <span
                      className={`text-xs sm:text-sm mt-0.5 block whitespace-nowrap font-semibold ${
                        detailCirc.overallStatus === "OVERDUE"
                          ? "text-danger-text"
                          : "text-text-main"
                      }`}
                    >
                      {formatDate(selectedDetailItem.dueAt)}
                    </span>
                  </div>

                  <div>
                    <span className="text-text-muted block text-[11px] uppercase tracking-wider font-semibold">
                      Tanggal Kembali
                    </span>
                    <span className="font-medium text-text-secondary text-xs sm:text-sm mt-0.5 block whitespace-nowrap">
                      {selectedDetailItem.rawItem.loan.returnedAt
                        ? formatDate(selectedDetailItem.rawItem.loan.returnedAt)
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Daftar Eksemplar Buku */}
              <div className="space-y-2 min-w-0 max-w-full">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Daftar Eksemplar ({detailCirc.items.length})
                </h4>

                {/* Tampilan Mobile & Tablet: Kartu Eksemplar Bersih & Tidak Terpotong */}
                <div className="md:hidden space-y-2.5">
                  {detailCirc.items.map((ex) => (
                    <div
                      key={ex.id}
                      className="rounded-lg border border-border bg-surface-subtle p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono font-bold text-text-main">
                          {ex.copyCode}
                        </span>
                        <Badge variant={ex.status === "RETURNED" ? "success" : "neutral"}>
                          {ex.status === "RETURNED" ? "Dikembalikan" : "Dipinjam"}
                        </Badge>
                      </div>

                      <p className="font-medium text-text-main" title={ex.bookTitle}>
                        {ex.bookTitle}
                      </p>

                      <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted tabular-nums">
                        <span>
                          {ex.returnedAt ? `Kembali: ${formatDate(ex.returnedAt)}` : "Belum kembali"}
                        </span>
                        {ex.fineAmount !== null && ex.fineAmount > 0 ? (
                          <span className="font-bold text-danger-text">
                            Denda: Rp {ex.fineAmount.toLocaleString("id-ID")}
                          </span>
                        ) : ex.daysOverdue > 0 ? (
                          <span className="font-semibold text-danger-text">
                            Terlambat {ex.daysOverdue} hari
                          </span>
                        ) : (
                          <span>Tepat waktu</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tampilan Desktop: Tabel Eksemplar Bebas Horizontal Scroll */}
                <div className="hidden md:block rounded-lg border border-border overflow-x-auto min-w-0 max-w-full">
                  <table className="w-full text-left text-xs">
                    <colgroup>
                      <col className="w-[20%]" />
                      <col className="w-[30%]" />
                      <col className="w-[12%]" />
                      <col className="w-[14%]" />
                      <col className="w-[12%]" />
                      <col className="w-[12%]" />
                    </colgroup>
                    <thead className="border-b border-border bg-slate-100 dark:bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <tr>
                        <th className="px-3 py-2.5 whitespace-nowrap">Kode Eksemplar</th>
                        <th className="px-3 py-2.5">Judul Buku</th>
                        <th className="px-2 py-2.5 text-center whitespace-nowrap">Status</th>
                        <th className="px-2 py-2.5 text-center whitespace-nowrap">Tgl Kembali</th>
                        <th className="px-2 py-2.5 text-center whitespace-nowrap">Terlambat</th>
                        <th className="px-3 py-2.5 text-right whitespace-nowrap">Denda</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle bg-surface">
                      {detailCirc.items.map((ex) => (
                        <tr key={ex.id} className="hover:bg-surface-subtle/70">
                          <td className="px-3 py-2.5 font-mono font-medium text-text-main whitespace-nowrap" title={ex.copyCode}>
                            {ex.copyCode}
                          </td>
                          <td className="px-3 py-2.5 text-text-main font-medium truncate max-w-[170px]" title={ex.bookTitle}>
                            {ex.bookTitle}
                          </td>
                          <td className="px-2 py-2.5 text-center whitespace-nowrap">
                            <Badge variant={ex.status === "RETURNED" ? "success" : "neutral"} className="text-[10px] px-1.5 py-0.5">
                              {ex.status === "RETURNED" ? "Kembali" : "Dipinjam"}
                            </Badge>
                          </td>
                          <td className="px-2 py-2.5 text-center text-text-secondary tabular-nums text-[11px] whitespace-nowrap">
                            {ex.returnedAt ? formatDate(ex.returnedAt) : "-"}
                          </td>
                          <td className="px-2 py-2.5 text-center tabular-nums text-[11px] whitespace-nowrap">
                            {ex.daysOverdue > 0 ? (
                              <span className="font-semibold text-danger-text">{ex.daysOverdue} hari</span>
                            ) : (
                              <span className="text-text-muted">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-[11px] font-medium whitespace-nowrap">
                            {ex.fineAmount !== null && ex.fineAmount > 0 ? (
                              <span className="font-bold text-danger-text">
                                Rp {ex.fineAmount.toLocaleString("id-ID")}
                              </span>
                            ) : (
                              <span className="text-text-subtle select-none">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
                {detailCirc.overallStatus !== "COMPLETED" && !isCompanyAdmin && (
                  <Link
                    href={`/returns?loanNumber=${encodeURIComponent(selectedDetailItem.loanNumber)}&loanId=${encodeURIComponent(selectedDetailItem.id)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition"
                  >
                    Proses Pengembalian
                  </Link>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedDetailItem(null)}
                >
                  Tutup
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
