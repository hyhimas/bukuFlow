"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import DatePicker from "@/components/ui/DatePicker";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import FeedbackPanel from "@/components/ui/FeedbackPanel";
import LoadingState from "@/components/ui/LoadingState";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import RowActions from "@/components/ui/RowActions";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { useSearchHotkey } from "@/hooks/useHotkeys";

import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import {
  canAccessTransactions,
  canAccessMasterData,
  canManageReturns,
} from "@/lib/authorization";
import { listLoansApi, getCompanySettingsApi, getErrorMessage } from "@/lib/api";
import {
  exportToExcel,
  filterByExportDate,
  getExportDateRange,
  type ExportPeriod,
} from "@/lib/export/excel";

import type { Loan, TransactionData, TransactionLoanItem, UserRole } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

type TransactionStatus = "ACTIVE" | "OVERDUE" | "COMPLETED";

const STATUS_OPTIONS: {
  value: TransactionStatus | "";
  label: string;
}[] = [
  {
    value: "",
    label: "Semua",
  },
  {
    value: "ACTIVE",
    label: "Aktif",
  },
  {
    value: "OVERDUE",
    label: "Terlambat",
  },
  {
    value: "COMPLETED",
    label: "Selesai",
  },
];

type SortField = "borrowedAt" | "dueAt" | "loanNumber";

function getOverdueDays(loan: Loan): number {
  if (loan.status === "COMPLETED" && loan.returnedAt) {
    const returnDate = new Date(`${loan.returnedAt.slice(0, 10)}T00:00:00`);
    const dueDate = new Date(`${loan.dueAt.slice(0, 10)}T00:00:00`);
    if (isNaN(returnDate.getTime()) || isNaN(dueDate.getTime()) || returnDate <= dueDate) return 0;
    const diffTime = returnDate.getTime() - dueDate.getTime();
    return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }
  if (loan.status === "COMPLETED") return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${loan.dueAt.slice(0, 10)}T00:00:00`);
  if (isNaN(dueDate.getTime()) || dueDate >= today) return 0;
  const diffTime = today.getTime() - dueDate.getTime();
  return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

function RemoveFilterIcon() {
  return (
    <svg
      className="ml-1 h-3.5 w-3.5 text-text-subtle hover:text-text-secondary shrink-0 inline"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const urlStatusParam = searchParams.get("status")?.toUpperCase();
  const initialStatus: TransactionStatus | "" =
    urlStatusParam === "ACTIVE" || urlStatusParam === "OVERDUE" || urlStatusParam === "COMPLETED"
      ? urlStatusParam
      : "";

  const urlSearchParam = searchParams.get("search") || "";

  // =========================================================
  // DATA
  // =========================================================

  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [dailyFineRate, setDailyFineRate] = useState<number | null>(null);
  const [configError, setConfigError] = useState("");

  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const hasLoadedTransactions = useRef(false);
  const [error, setError] = useState("");

  function getLoanFine(loan: Loan, itemCount: number = 1): number | null {
    const overdueDays = getOverdueDays(loan);
    if (overdueDays <= 0) return 0;
    if (dailyFineRate === null) return null;
    return overdueDays * dailyFineRate * Math.max(1, itemCount);
  }

  // Interactive Sorting
  const [sortBy, setSortBy] = useState<SortField>("borrowedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // =========================================================
  // SEARCH
  // =========================================================

  const [search, setSearch] = useState(urlSearchParam);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearchParam);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchHotkey(searchInputRef);

  // =========================================================
  // APPLIED FILTERS (Berdasarkan borrowedAt)
  // =========================================================

  const [status, setStatus] = useState<TransactionStatus | "">(initialStatus);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [returnedFrom, setReturnedFrom] = useState("");
  const [returnedTo, setReturnedTo] = useState("");

  // =========================================================
  // TEMPORARY FILTERS (Di Drawer)
  // =========================================================

  const [filterStatus, setFilterStatus] = useState<TransactionStatus | "">(initialStatus);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterDueFrom, setFilterDueFrom] = useState("");
  const [filterDueTo, setFilterDueTo] = useState("");
  const [filterReturnedFrom, setFilterReturnedFrom] = useState("");
  const [filterReturnedTo, setFilterReturnedTo] = useState("");

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFilterMounted, setIsFilterMounted] = useState(false);

  // =========================================================
  // EXPORT EXCEL
  // =========================================================

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExportMounted, setIsExportMounted] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("ALL");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  // =========================================================
  // PAGINATION
  // =========================================================

  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const savedTotalRef = useRef(0);

  // =========================================================
  // SESSION CHECK
  // =========================================================

  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    if (typeof window !== "undefined") {
      return getSession()?.user?.role || null;
    }
    return null;
  });

  useEffect(() => {
    const session = getSession();

    if (!session) {
      if (!isStoredSessionExpired() && !hasStoredAuth()) {
        router.replace("/login");
      }
      return;
    }

    if (!canAccessTransactions(session.user.role)) {
      router.replace("/dashboard");
      return;
    }

    if (session.user.companyId) {
      getCompanySettingsApi(session.user.companyId)
        .then((settings) => {
          if (settings && typeof settings.dailyFineRate === "number") {
            setDailyFineRate(settings.dailyFineRate);
          }
        })
        .catch((err: unknown) => {
          setConfigError(
            getErrorMessage(
              err,
              "Gagal memuat konfigurasi tarif denda. Perhitungan nominal denda dinonaktifkan."
            )
          );
        });
    }
  }, [router]);

  const canViewMember = userRole ? canAccessMasterData(userRole) : false;
  const canReturn = userRole ? canManageReturns(userRole) : false;

  // =========================================================
  // SYNC FROM URL QUERY PARAMS (DEEP LINKING / QUICKCARD)
  // =========================================================

  useEffect(() => {
    const rawStatus = searchParams.get("status")?.toUpperCase();
    if (rawStatus === "ACTIVE" || rawStatus === "OVERDUE" || rawStatus === "COMPLETED") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sinkronisasi filter status dan kata kunci pencarian dari URL searchParams
      setStatus((prev) => (prev !== rawStatus ? rawStatus : prev));
      setFilterStatus((prev) => (prev !== rawStatus ? rawStatus : prev));
    } else if (searchParams.has("status") && !rawStatus) {
      setStatus("");
      setFilterStatus("");
    }

    const rawSearch = searchParams.get("search");
    if (rawSearch !== null && rawSearch !== search) {
      setSearch(rawSearch);
      setDebouncedSearch(rawSearch);
    }
  }, [searchParams]);

  // =========================================================
  // DEBOUNCE SEARCH
  // =========================================================

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  // =========================================================
  // LOAD TRANSACTIONS (SERVER-SIDE WITH FILTERS & PAGINATION)
  // =========================================================

  const loadTransactions = useCallback(async () => {
    if (!hasLoadedTransactions.current) {
      setLoading(true);
    } else {
      setTableLoading(true);
    }
    setError("");

    try {
      const backendSortBy =
        sortBy === "borrowedAt"
          ? "borrowed_at"
          : sortBy === "dueAt"
          ? "due_at"
          : sortBy === "loanNumber"
          ? "loan_number"
          : undefined;

      const result = await listLoansApi({
        page,
        size: pageSize,
        search: debouncedSearch.trim() || undefined,
        status: status || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        due_from: dueFrom || undefined,
        due_to: dueTo || undefined,
        returned_from: returnedFrom || undefined,
        returned_to: returnedTo || undefined,
        sortby: backendSortBy,
        order: sortOrder,
      });

      setTransactions(result.items);
      hasLoadedTransactions.current = true;
      if (result.total !== -1) {
        savedTotalRef.current = result.total;
        setTotalItems(result.total);
        setTotalPages(result.totalPages);
      } else {
        setTotalItems(savedTotalRef.current);
        setTotalPages(Math.max(1, Math.ceil(savedTotalRef.current / pageSize)));
      }
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, "Riwayat transaksi gagal dimuat.")
      );
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [page, pageSize, debouncedSearch, status, startDate, endDate, dueFrom, dueTo, returnedFrom, returnedTo, sortBy, sortOrder]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch riwayat transaksi saat mount dan parameter filter/paginasi berubah
    void loadTransactions();
  }, [loadTransactions]);

  // =========================================================
  // SORT TOGGLE
  // =========================================================

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  }

  // Column definitions for DataTable
  const columns = useMemo<DataTableColumn<TransactionData>[]>(
    () => [
      {
        key: "loanNumber",
        header: "Nomor peminjaman",
        width: "145px",
        sortable: true,
        sortKey: "loanNumber",
        render: (t) => (
          <p
            className="truncate whitespace-nowrap font-semibold tracking-tight text-text-main font-mono text-xs tabular-nums"
            title={t.loan.loanNumber}
          >
            {t.loan.loanNumber}
          </p>
        ),
      },
      {
        key: "member",
        header: "Anggota",
        width: "120px",
        render: (t) => (
          <p
            className="truncate text-text-main font-medium text-xs 2xl:text-sm"
            title={t.member?.name ?? "-"}
          >
            {t.member?.name ?? "-"}
          </p>
        ),
      },
      {
        key: "books",
        header: "Buku",
        render: (t) =>
          t.items.length === 0 ? (
            <span className="text-text-muted">-</span>
          ) : (
            <ul className="min-w-0 space-y-0.5">
              {t.items.map(({ book, bookCopy }) => (
                <li
                  key={`${t.loan.id}-${book?.id ?? "book"}-${bookCopy?.id ?? "copy"}`}
                  className="grid min-w-0 grid-cols-[10px_minmax(0,1fr)]"
                >
                  <span className="text-text-secondary select-none" aria-hidden="true">
                    &bull;
                  </span>
                  <span
                    className="min-w-0 leading-5 text-text-secondary text-xs"
                    title={`${book?.title ?? "-"}${bookCopy?.code ? ` (${bookCopy.code})` : ""}`}
                  >
                    <span className="font-medium text-text-main">
                      {book?.title ?? "-"}
                    </span>
                    {bookCopy?.code && (
                      <span className="ml-1 text-text-muted text-xs font-mono">
                        ({bookCopy.code})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ),
      },
      {
        key: "officer",
        header: "Petugas",
        width: "90px",
        render: (t) => (
          <p
            className="truncate text-text-secondary text-xs 2xl:text-sm font-medium"
            title={t.user?.name ?? "-"}
          >
            {t.user?.name ?? "-"}
          </p>
        ),
      },
      {
        key: "borrowedAt",
        header: "Peminjaman",
        width: "105px",
        sortable: true,
        sortKey: "borrowedAt",
        isNumeric: true,
        render: (t) => (
          <span className="whitespace-nowrap text-text-secondary tabular-nums text-xs font-medium">
            {formatDate(t.loan.borrowedAt)}
          </span>
        ),
      },
      {
        key: "dueAt",
        header: "Jatuh tempo",
        width: "105px",
        sortable: true,
        sortKey: "dueAt",
        isNumeric: true,
        render: (t) => (
          <span className="whitespace-nowrap text-text-secondary tabular-nums text-xs font-medium">
            {formatDate(t.loan.dueAt)}
          </span>
        ),
      },
      {
        key: "returnedAt",
        header: "Pengembalian",
        width: "105px",
        isNumeric: true,
        render: (t) => (
          <span className="whitespace-nowrap text-text-secondary tabular-nums text-xs font-medium">
            {formatDate(t.loan.returnedAt)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "120px",
        render: (t) => {
          const overdueDays = getOverdueDays(t.loan);
          const isOverdue = t.loan.status === "OVERDUE" || overdueDays > 0;
          if (isOverdue && overdueDays > 0) {
            return (
              <div>
                <Badge variant="danger">
                  Terlambat ({overdueDays} hr)
                </Badge>
                {getLoanFine(t.loan, t.items.length) === null ? (
                  <span className="mt-0.5 block text-xs font-semibold text-amber-600 whitespace-nowrap">
                    Denda: Menunggu konfigurasi
                  </span>
                ) : (
                  <span className="mt-0.5 block text-xs font-semibold text-red-600 tabular-nums whitespace-nowrap">
                    Denda: Rp {getLoanFine(t.loan, t.items.length)!.toLocaleString("id-ID")}
                  </span>
                )}
              </div>
            );
          }
          return (
            <div>
              <Badge variant={getStatusVariant(t.loan.status)}>
                {getStatusLabel(t.loan.status)}
              </Badge>
              {overdueDays > 0 &&
                (getLoanFine(t.loan, t.items.length) === null ? (
                  <span className="mt-0.5 block text-xs font-medium text-amber-600 whitespace-nowrap">
                    Denda: Menunggu konfigurasi
                  </span>
                ) : (
                  <span className="mt-0.5 block text-xs font-medium text-text-muted tabular-nums whitespace-nowrap">
                    Denda: Rp {getLoanFine(t.loan, t.items.length)!.toLocaleString("id-ID")}
                  </span>
                ))}
            </div>
          );
        },
      },
      {
        key: "actions",
        header: "Aksi",
        width: "50px",
        align: "right",
        render: (t) => (
          <RowActions
            actions={[
              ...(canReturn && t.loan.status !== "COMPLETED"
                ? [
                    {
                      label: "Kembalikan",
                      href: `/returns?loanNumber=${encodeURIComponent(t.loan.loanNumber)}&loanId=${encodeURIComponent(t.loan.id)}`,
                      icon: (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="m9 14-5-5 5-5" />
                          <path d="M4 9h11a4 4 0 0 1 4 4v2" />
                        </svg>
                      ),
                    },
                  ]
                : []),
              ...(canViewMember && (t.member?.id || t.loan.memberId)
                ? [
                    {
                      label: "Lihat Anggota",
                      href: `/master/members?memberId=${encodeURIComponent(t.member?.id || t.loan.memberId)}`,
                      icon: (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ],
    [canReturn, canViewMember, dailyFineRate]
  );

  // =========================================================
  // PAGINATION RESET
  // =========================================================

  function resetPagination() {
    savedTotalRef.current = 0;
    setPage(1);
  }

  // =========================================================
  // DATE HELPERS
  // =========================================================

  function getDateOnly(value?: string) {
    if (!value) {
      return "";
    }

    const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (isoDateMatch) {
      return isoDateMatch[0];
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatDate(value?: string) {
    const dateOnly = getDateOnly(value);

    if (!dateOnly) {
      return "-";
    }

    const [year, month, day] = dateOnly.split("-");

    return `${day}/${month}/${year}`;
  }

  // =========================================================
  // STATUS HELPERS
  // =========================================================

  function getStatusLabel(loanStatus: Loan["status"]) {
    if (loanStatus === "ACTIVE") {
      return "Aktif";
    }

    if (loanStatus === "OVERDUE") {
      return "Terlambat";
    }

    if (loanStatus === "COMPLETED") {
      return "Selesai";
    }

    if (loanStatus === "CANCELLED") {
      return "Dibatalkan";
    }

    return loanStatus;
  }

  function getStatusVariant(loanStatus: Loan["status"]) {
    if (loanStatus === "OVERDUE") {
      return "danger" as const;
    }

    if (loanStatus === "COMPLETED") {
      return "success" as const;
    }

    if (loanStatus === "CANCELLED") {
      return "neutral" as const;
    }

    return "neutral" as const;
  }

  // =========================================================
  // ACTIVE FILTER CHECK
  // =========================================================

  const hasActiveFilters = Boolean(
    status !== "" ||
      startDate !== "" ||
      endDate !== "" ||
      dueFrom !== "" ||
      dueTo !== "" ||
      returnedFrom !== "" ||
      returnedTo !== ""
  );
  const isFiltered = Boolean(search.trim() || hasActiveFilters);

  // =========================================================
  // RESET APPLIED FILTERS
  // =========================================================

  function resetFilters() {
    setSearch("");
    setStatus("");
    setStartDate("");
    setEndDate("");
    setDueFrom("");
    setDueTo("");
    setReturnedFrom("");
    setReturnedTo("");

    resetPagination();

    if (searchParams.has("status") || searchParams.has("search")) {
      router.replace("/transactions", { scroll: false });
    }
  }

  // =========================================================
  // FILTER DRAWER CONTROLS
  // =========================================================

  function openFilter() {
    setFilterStatus(status);
    setFilterStartDate(startDate);
    setFilterEndDate(endDate);
    setFilterDueFrom(dueFrom);
    setFilterDueTo(dueTo);
    setFilterReturnedFrom(returnedFrom);
    setFilterReturnedTo(returnedTo);

    setIsFilterMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsFilterOpen(true);
      });
    });
  }

  function closeFilter() {
    setIsFilterOpen(false);
    setTimeout(() => {
      setIsFilterMounted(false);
    }, 200);
  }

  function applyFilters() {
    setStatus(filterStatus);
    setStartDate(filterStartDate);
    setEndDate(filterEndDate);
    setDueFrom(filterDueFrom);
    setDueTo(filterDueTo);
    setReturnedFrom(filterReturnedFrom);
    setReturnedTo(filterReturnedTo);

    resetPagination();
    closeFilter();

    const nextParams = new URLSearchParams(searchParams.toString());
    if (filterStatus) {
      nextParams.set("status", filterStatus);
    } else {
      nextParams.delete("status");
    }
    const qs = nextParams.toString();
    router.replace(qs ? `/transactions?${qs}` : "/transactions", { scroll: false });
  }

  function resetDrawerFilters() {
    setFilterStatus("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterDueFrom("");
    setFilterDueTo("");
    setFilterReturnedFrom("");
    setFilterReturnedTo("");
  }

  function _removeSearchFilter() {
    setSearch("");
    resetPagination();

    if (searchParams.has("search")) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("search");
      const qs = nextParams.toString();
      router.replace(qs ? `/transactions?${qs}` : "/transactions", { scroll: false });
    }
  }

  function removeStartDateFilter() {
    setStartDate("");
    resetPagination();
  }

  function removeEndDateFilter() {
    setEndDate("");
    resetPagination();
  }

  function removeStatusFilter() {
    setStatus("");
    resetPagination();

    if (searchParams.has("status")) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("status");
      const qs = nextParams.toString();
      router.replace(qs ? `/transactions?${qs}` : "/transactions", { scroll: false });
    }
  }

  // =========================================================
  // EXPORT EXCEL
  // =========================================================

  function openExport() {
    setIsExportMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsExportOpen(true);
      });
    });
  }

  function closeExport() {
    setIsExportOpen(false);
    setTimeout(() => {
      setIsExportMounted(false);
    }, 200);
  }

  async function handleExportExcel() {
    if (exportPeriod === "CUSTOM" && (!exportStartDate || !exportEndDate)) {
      toast.warning("Silakan pilih tanggal mulai dan tanggal selesai untuk periode custom.");
      return;
    }

    try {
      setExportLoading(true);
      const BATCH_SIZE = 100;
      let allItems: TransactionData[] = [];
      const currentPage = 1;

      const { startDate: targetStartDate, endDate: targetEndDate } =
        getExportDateRange(exportPeriod, exportStartDate, exportEndDate);

      const firstRes = await listLoansApi({
        page: currentPage,
        size: BATCH_SIZE,
        search: debouncedSearch.trim() || undefined,
        status: status || undefined,
        startDate: targetStartDate || undefined,
        endDate: targetEndDate || undefined,
        skipEnrich: true,
      });

      allItems = [...firstRes.items];
      const totalCount = firstRes.total > 0 ? firstRes.total : firstRes.items.length;
      const totalBatches = Math.max(1, Math.ceil(totalCount / BATCH_SIZE));

      if (totalBatches > 1) {
        toast.info(`Mengunduh seluruh riwayat transaksi (1/${totalBatches})...`);
        for (let p = 2; p <= totalBatches; p++) {
          const batchRes = await listLoansApi({
            page: p,
            size: BATCH_SIZE,
            search: debouncedSearch.trim() || undefined,
            status: status || undefined,
            startDate: targetStartDate || undefined,
            endDate: targetEndDate || undefined,
            skipEnrich: true,
          });
          allItems.push(...batchRes.items);
          if (batchRes.items.length === 0) break;
        }
      }

      const rawExportItems = status
        ? allItems.filter((tx) => {
            if (status === "ACTIVE") return tx.loan.status === "ACTIVE";
            if (status === "OVERDUE") return tx.loan.status === "OVERDUE";
            if (status === "COMPLETED") return tx.loan.status === "COMPLETED" || Boolean(tx.loan.returnedAt);
            return tx.loan.status === status;
          })
        : allItems;

      const exportTransactions = filterByExportDate(
        rawExportItems,
        ({ loan }) => getDateOnly(loan.borrowedAt || loan.createdAt),
        exportPeriod,
        exportStartDate,
        exportEndDate
      );

      const rows = exportTransactions.map(({ loan, member, items, user }) => {
        const overdueDays = getOverdueDays(loan);
        const fine = getLoanFine(loan, items.length);
        return {
          "Nomor Peminjaman": loan.loanNumber,
          Anggota: member?.name ?? "-",
          Buku: items
            .map(
              ({ book, bookCopy }: TransactionLoanItem) =>
                `${book?.title ?? "-"}${
                  bookCopy?.code ? ` (${bookCopy.code})` : ""
                }`
            )
            .join(", "),
          Petugas: user?.name ?? "-",
          "Tanggal Peminjaman": formatDate(loan.borrowedAt || loan.createdAt),
          "Jatuh Tempo": formatDate(loan.dueAt),
          "Tanggal Pengembalian": formatDate(loan.returnedAt),
          Status: getStatusLabel(loan.status),
          "Hari Terlambat": overdueDays > 0 ? `${overdueDays} hari` : "-",
          Denda:
            fine === null
              ? "Menunggu konfigurasi"
              : fine > 0
              ? `Rp ${fine.toLocaleString("id-ID")}`
              : "Rp 0",
        };
      });

      if (rows.length === 0) {
        toast.warning("Tidak ada transaksi pada periode yang dipilih.");
        return;
      }

      exportToExcel(
        rows,
        `riwayat-transaksi-${getDateOnly(new Date().toISOString())}.xlsx`,
        "Riwayat Transaksi"
      );

      toast.success("Laporan riwayat transaksi berhasil diunduh.");
      closeExport();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Gagal mengunduh laporan excel.");
      toast.error(msg);
    } finally {
      setExportLoading(false);
    }
  }



  // =========================================================
  // MAIN RENDER
  // =========================================================

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="page-container py-5 sm:py-6">
        {/* HEADER */}
        <PageHeader
          className="mb-6"
          title="Riwayat Transaksi"
          description="Lihat dan filter seluruh riwayat transaksi peminjaman perpustakaan."
          backLink="/dashboard"
          actions={
            <Button
              type="button"
              variant="secondary"
              onClick={openExport}
              disabled={Boolean(error) || loading || transactions.length === 0 || exportLoading}
              className="w-full sm:w-auto text-xs h-9 px-3.5 font-semibold text-center whitespace-nowrap"
            >
              <span className="flex items-center justify-center gap-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4 text-emerald-600"
                  aria-hidden="true"
                >
                  <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 2v6h6M8 13h8M8 17h8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Ekspor Excel</span>
              </span>
            </Button>
          }
        />

        {/* CONFIG ERROR PANEL */}
        {!error && configError && (
          <FeedbackPanel tone="info" className="mb-6 border-amber-200 bg-amber-50 text-amber-900">
            <div>
              <p className="font-semibold text-amber-900">Perhatian: Konfigurasi Tarif Denda Belum Dimuat</p>
              <p className="mt-0.5 text-xs text-amber-700">{configError}</p>
              <p className="mt-1 text-xs text-amber-600">Perhitungan nominal denda dinonaktifkan sampai konfigurasi kebijakan sirkulasi disetel di Pengaturan.</p>
            </div>
          </FeedbackPanel>
        )}

        {/* SEARCH & FILTER BAR */}
        <div className="relative z-10 mt-6">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Input
                  ref={searchInputRef}
                  id="transaction-search"
                  label="Pencarian"
                  value={search}
                  disabled={Boolean(error) && !hasLoadedTransactions.current}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetPagination();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setDebouncedSearch(search);
                    }
                  }}
                  placeholder="Cari nomor peminjaman, anggota, buku, petugas... (tekan /)"
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={openFilter}
                disabled={Boolean(error) && !hasLoadedTransactions.current}
                className="shrink-0 self-stretch sm:self-end"
              >
                <span className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 4.5h18M6 9.5h12M9 14.5h6M11 19.5h2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Filter</span>
                </span>
              </Button>
            </div>
          </Card>

          {/* ACTIVE FILTER CHIPS */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2">

              {startDate !== "" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={removeStartDateFilter}
                  className="rounded-full px-3 py-1 text-xs"
                >
                  Pinjam Dari: {formatDate(startDate)}
                  <RemoveFilterIcon />
                </Button>
              )}

              {endDate !== "" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={removeEndDateFilter}
                  className="rounded-full px-3 py-1 text-xs"
                >
                  Pinjam Sampai: {formatDate(endDate)}
                  <RemoveFilterIcon />
                </Button>
              )}

              {dueFrom !== "" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDueFrom("");
                    resetPagination();
                  }}
                  className="rounded-full px-3 py-1 text-xs"
                >
                  Jatuh Tempo Dari: {formatDate(dueFrom)}
                  <RemoveFilterIcon />
                </Button>
              )}

              {dueTo !== "" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setDueTo("");
                    resetPagination();
                  }}
                  className="rounded-full px-3 py-1 text-xs"
                >
                  Jatuh Tempo Sampai: {formatDate(dueTo)}
                  <RemoveFilterIcon />
                </Button>
              )}

              {returnedFrom !== "" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setReturnedFrom("");
                    resetPagination();
                  }}
                  className="rounded-full px-3 py-1 text-xs"
                >
                  Kembali Dari: {formatDate(returnedFrom)}
                  <RemoveFilterIcon />
                </Button>
              )}

              {returnedTo !== "" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setReturnedTo("");
                    resetPagination();
                  }}
                  className="rounded-full px-3 py-1 text-xs"
                >
                  Kembali Sampai: {formatDate(returnedTo)}
                  <RemoveFilterIcon />
                </Button>
              )}

              {status !== "" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={removeStatusFilter}
                  className="rounded-full px-3 py-1 text-xs"
                >
                  Status: {getStatusLabel(status)}
                  <RemoveFilterIcon />
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-text-muted hover:text-text-main"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path
                    d="M4 4v5h5M20 20v-5h-5M5.5 9A7.5 7.5 0 0 1 18 6.5M18.5 15A7.5 7.5 0 0 1 6 17.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Atur ulang semua</span>
              </Button>
            </div>
          )}
        </div>

        {/* FILTER DRAWER */}
        <Modal
          open={isFilterMounted}
          onClose={closeFilter}
          raw
          ariaLabelledBy="filter-title"
          overlayClassName={`fixed inset-0 z-50 overflow-hidden bg-overlay backdrop-blur-[2px] transition-opacity duration-200 ease-out ${
            isFilterOpen ? "opacity-100" : "opacity-0"
          }`}
          className={`fixed inset-y-0 right-0 flex h-full w-full max-w-md flex-col bg-surface shadow-2xl transition-transform duration-200 ease-out ${
            isFilterOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
              <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
                <div>
                  <h2
                    id="filter-title"
                    className="text-lg font-semibold tracking-tight text-text-main"
                  >
                    Filter Transaksi
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-text-muted">
                    Filter berdasarkan rentang tanggal peminjaman dan status.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeFilter}
                  aria-label="Tutup filter"
                  className="min-h-[32px] min-w-[32px] p-2 text-text-muted hover:bg-surface-muted hover:text-text-main"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      d="m6 6 12 12M18 6 6 18"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                {/* STATUS FILTER */}
                <section>
                  <h3 className="text-sm font-semibold text-text-main">
                    Status Transaksi
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((option) => {
                      const selected = filterStatus === option.value;

                      return (
                        <Button
                          key={option.value || "all"}
                          type="button"
                          variant={selected ? "primary" : "secondary"}
                          size="sm"
                          onClick={() => {
                            setFilterStatus(option.value);
                          }}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </section>

                <div className="my-6 border-t border-border-subtle" />

                {/* RENTANG TANGGAL PEMINJAMAN */}
                <section>
                  <h3 className="text-sm font-semibold text-text-main">
                    Rentang Tanggal Pinjam
                  </h3>
                  <p className="mt-1 text-sm text-text-muted">
                    Filter transaksi berdasarkan tanggal peminjaman buku (borrowedAt).
                  </p>

                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <DatePicker
                      id="transaction-start-date"
                      label="Dari tanggal pinjam"
                      value={filterStartDate}
                      showClearButton
                      onChange={(value) => {
                        setFilterStartDate(value);
                        if (
                          filterEndDate !== "" &&
                          value !== "" &&
                          filterEndDate < value
                        ) {
                          setFilterEndDate("");
                        }
                      }}
                    />

                    <DatePicker
                      id="transaction-end-date"
                      label="Sampai tanggal pinjam"
                      value={filterEndDate}
                      min={filterStartDate || undefined}
                      showClearButton
                      onChange={(value) => {
                        setFilterEndDate(value);
                      }}
                    />
                  </div>
                </section>

                <div className="my-6 border-t border-border-subtle" />

                {/* RENTANG TANGGAL JATUH TEMPO */}
                <section>
                  <h3 className="text-sm font-semibold text-text-main">
                    Rentang Tanggal Jatuh Tempo
                  </h3>
                  <p className="mt-1 text-sm text-text-muted">
                    Filter transaksi berdasarkan batas waktu jatuh tempo pengembalian.
                  </p>

                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <DatePicker
                      id="transaction-due-from"
                      label="Dari jatuh tempo"
                      value={filterDueFrom}
                      showClearButton
                      onChange={(value) => {
                        setFilterDueFrom(value);
                        if (
                          filterDueTo !== "" &&
                          value !== "" &&
                          filterDueTo < value
                        ) {
                          setFilterDueTo("");
                        }
                      }}
                    />

                    <DatePicker
                      id="transaction-due-to"
                      label="Sampai jatuh tempo"
                      value={filterDueTo}
                      min={filterDueFrom || undefined}
                      showClearButton
                      onChange={(value) => {
                        setFilterDueTo(value);
                      }}
                    />
                  </div>
                </section>

                <div className="my-6 border-t border-border-subtle" />

                {/* RENTANG TANGGAL PENGEMBALIAN */}
                <section>
                  <h3 className="text-sm font-semibold text-text-main">
                    Rentang Tanggal Pengembalian
                  </h3>
                  <p className="mt-1 text-sm text-text-muted">
                    Filter transaksi berdasarkan tanggal pengembalian buku.
                  </p>

                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <DatePicker
                      id="transaction-returned-from"
                      label="Dari tanggal kembali"
                      value={filterReturnedFrom}
                      showClearButton
                      onChange={(value) => {
                        setFilterReturnedFrom(value);
                        if (
                          filterReturnedTo !== "" &&
                          value !== "" &&
                          filterReturnedTo < value
                        ) {
                          setFilterReturnedTo("");
                        }
                      }}
                    />

                    <DatePicker
                      id="transaction-returned-to"
                      label="Sampai tanggal kembali"
                      value={filterReturnedTo}
                      min={filterReturnedFrom || undefined}
                      showClearButton
                      onChange={(value) => {
                        setFilterReturnedTo(value);
                      }}
                    />
                  </div>
                </section>
              </div>

              <div className="border-t border-border bg-surface px-5 py-4 sm:px-6">
                <div className="flex gap-2.5 sm:gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1 px-3"
                    onClick={resetDrawerFilters}
                  >
                    Atur Ulang Filter
                  </Button>

                  <Button
                    type="button"
                    className="flex-1 px-3"
                    onClick={applyFilters}
                  >
                    Terapkan Filter
                  </Button>
                </div>
              </div>
        </Modal>

        {/* EXPORT EXCEL MODAL */}
        <Modal
          open={isExportMounted}
          onClose={closeExport}
          raw
          size="md"
          ariaLabelledBy="export-title"
          overlayClassName={`fixed inset-0 z-50 flex min-h-full items-center justify-center p-4 overflow-y-auto bg-overlay backdrop-blur-[2px] transition-opacity duration-200 ease-out ${
            isExportOpen ? "opacity-100" : "opacity-0"
          }`}
          className={`w-full max-w-md rounded-xl bg-surface shadow-2xl transition-all duration-200 ease-out ${
            isExportOpen
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-2"
          }`}
        >
                <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
                  <div>
                    <h2
                      id="export-title"
                      className="text-lg font-semibold tracking-tight text-text-main"
                    >
                      Ekspor Excel
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-text-muted">
                      Pilih periode transaksi yang ingin diekspor.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={closeExport}
                    aria-label="Tutup ekspor"
                    className="min-h-[32px] min-w-[32px] p-2 text-text-muted hover:bg-surface-muted hover:text-text-main"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        d="m6 6 12 12M18 6 6 18"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </Button>
                </div>

                <div className="px-5 py-5 sm:px-6 sm:py-6">
                  <div className="space-y-2">
                    {[
                      { value: "ALL" as const, label: "Seluruh transaksi" },
                      { value: "7_DAYS" as const, label: "7 hari terakhir" },
                      { value: "1_MONTH" as const, label: "1 bulan terakhir" },
                      { value: "1_YEAR" as const, label: "1 tahun terakhir" },
                      { value: "CUSTOM" as const, label: "Periode custom" },
                    ].map((option) => {
                      const selected = exportPeriod === option.value;

                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant="ghost"
                          onClick={() => setExportPeriod(option.value)}
                          className={[
                            "w-full h-auto flex items-center justify-start gap-3 rounded-lg border px-4 py-3 text-left text-sm font-normal transition",
                            selected
                              ? "border-blue-600 bg-blue-50 text-blue-700"
                              : "border-border bg-surface text-text-secondary hover:border-border hover:bg-surface-subtle",
                          ].join(" ")}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-border bg-surface"
                            }`}
                          >
                            {selected && (
                              <span className="h-1.5 w-1.5 rounded-full bg-surface" />
                            )}
                          </span>
                          <span className="font-medium">{option.label}</span>
                        </Button>
                      );
                    })}
                  </div>

                  {exportPeriod === "CUSTOM" && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <DatePicker
                        id="export-start-date"
                        label="Dari tanggal"
                        value={exportStartDate}
                        onChange={(value) => setExportStartDate(value)}
                      />
                      <DatePicker
                        id="export-end-date"
                        label="Sampai tanggal"
                        value={exportEndDate}
                        min={exportStartDate || undefined}
                        onChange={(value) => setExportEndDate(value)}
                      />
                    </div>
                  )}
                </div>

                <div className="border-t border-border bg-surface-subtle px-5 py-4 sm:px-6">
                  <div className="flex justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={closeExport}
                      disabled={exportLoading}
                    >
                      Batal
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleExportExcel()}
                      loading={exportLoading}
                      disabled={exportLoading}
                    >
                      Unduh Excel
                    </Button>
                  </div>
                </div>
        </Modal>

        {/* ERROR STATE vs CONTENT */}
        {error ? (
          <ErrorState
            title="Gagal Memuat Riwayat Transaksi"
            message={error}
            onRetry={() => void loadTransactions()}
            className="mt-5"
          />
        ) : (
          <div className="mt-5">
            <DataTable
              rows={transactions}
              columns={columns}
              keyExtractor={(t) => t.loan.id}
              loading={loading || tableLoading}
              sortBy={sortBy}
              order={sortOrder}
              onSortChange={(k) => toggleSort(k as SortField)}
              mobileBreakpoint="xl"
              rowClassName={(transaction) => {
                const overdueDays = getOverdueDays(transaction.loan);
                const isOverdue =
                  transaction.loan.status === "OVERDUE" || overdueDays > 0;
                return isOverdue
                  ? "border-l-4 border-l-red-500 bg-red-50/35 hover:bg-red-50/60"
                  : "hover:bg-surface-subtle";
              }}
              emptyState={
                <Card className="p-4 sm:p-5">
                  <EmptyState
                    title={
                      isFiltered
                        ? "Transaksi tidak ditemukan"
                        : "Belum ada riwayat transaksi"
                    }
                    description={
                      isFiltered
                        ? "Tidak ada transaksi yang sesuai dengan pencarian atau filter yang diterapkan. Coba sesuaikan kata kunci atau atur ulang filter."
                        : "Belum ada data riwayat transaksi peminjaman di sistem."
                    }
                  />
                </Card>
              }
              renderMobileCard={(transaction) => {
                const overdueDays = getOverdueDays(transaction.loan);
                const isOverdue =
                  transaction.loan.status === "OVERDUE" || overdueDays > 0;

                return (
                  <Card
                    key={transaction.loan.id}
                    className={`p-3.5 sm:p-4 shadow-xs transition flex flex-col justify-between h-full ${
                      isOverdue
                        ? "border-l-4 border-l-red-500 border-red-200 bg-red-50/20"
                        : "hover:border-border"
                    }`}
                  >
                    <div>
                      {/* TRANSACTION HEADER */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-bold tracking-tight text-text-main sm:text-base font-mono tabular-nums"
                            title={transaction.loan.loanNumber}
                          >
                            {transaction.loan.loanNumber}
                          </p>

                          <p
                            className="mt-0.5 truncate text-xs text-text-secondary sm:text-sm font-medium"
                            title={transaction.member?.name ?? "-"}
                          >
                            {transaction.member?.name ?? "-"}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          {isOverdue && overdueDays > 0 ? (
                            <div>
                              <Badge variant="danger">
                                Terlambat ({overdueDays} hr)
                              </Badge>
                              {getLoanFine(transaction.loan, transaction.items.length) === null ? (
                                <span className="mt-0.5 block text-xs font-semibold text-amber-600">
                                  Denda: Menunggu konfigurasi
                                </span>
                              ) : (
                                <span className="mt-0.5 block text-xs font-semibold text-red-600 tabular-nums">
                                  Denda: Rp {getLoanFine(transaction.loan, transaction.items.length)!.toLocaleString("id-ID")}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div>
                              <Badge
                                variant={getStatusVariant(
                                  transaction.loan.status
                                )}
                              >
                                {getStatusLabel(transaction.loan.status)}
                              </Badge>
                              {overdueDays > 0 && (
                                getLoanFine(transaction.loan, transaction.items.length) === null ? (
                                  <span className="mt-0.5 block text-xs font-medium text-amber-600">
                                    Denda: Menunggu konfigurasi
                                  </span>
                                ) : (
                                  <span className="mt-0.5 block text-xs font-medium text-text-muted tabular-nums">
                                    Denda: Rp {getLoanFine(transaction.loan, transaction.items.length)!.toLocaleString("id-ID")}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* BUKU */}
                      <div className="mt-2.5 rounded-lg bg-surface-subtle px-3 py-2">
                        <p className="text-xs font-semibold text-text-muted">
                          Buku Dipinjam ({transaction.items.length})
                        </p>

                        {transaction.items.length === 0 ? (
                          <p className="mt-0.5 text-xs text-text-main">-</p>
                        ) : (
                          <ul className="mt-1 space-y-0.5 text-xs text-text-main sm:text-sm">
                            {transaction.items.map(({ book, bookCopy }) => (
                              <li
                                key={`${transaction.loan.id}-${book?.id ?? "book"}-${bookCopy?.id ?? "copy"}`}
                                className="break-words"
                              >
                                <span
                                  aria-hidden="true"
                                  className="mr-1.5 text-text-secondary select-none"
                                >
                                  &bull;
                                </span>

                                <span className="font-medium text-text-main">
                                  {book?.title ?? "-"}
                                </span>

                                {bookCopy?.code && (
                                  <span className="ml-1.5 font-mono text-xs text-text-muted">
                                    ({bookCopy.code})
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* DATES & PETUGAS GRID (2x2 Grid) */}
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border-subtle pt-2.5 text-xs">
                      <div className="rounded-lg border border-border-subtle bg-surface-subtle px-2.5 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted block">
                          Petugas
                        </span>
                        <p
                          className="mt-0.5 truncate font-semibold text-text-secondary"
                          title={transaction.user?.name ?? "-"}
                        >
                          {transaction.user?.name ?? "-"}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border-subtle bg-surface-subtle px-2.5 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted block">
                          Pinjam
                        </span>
                        <p
                          className="mt-0.5 truncate font-semibold text-text-secondary tabular-nums"
                          title={formatDate(transaction.loan.borrowedAt)}
                        >
                          {formatDate(transaction.loan.borrowedAt)}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border-subtle bg-surface-subtle px-2.5 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted block">
                          Jatuh Tempo
                        </span>
                        <p
                          className="mt-0.5 truncate font-semibold text-text-secondary tabular-nums"
                          title={formatDate(transaction.loan.dueAt)}
                        >
                          {formatDate(transaction.loan.dueAt)}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border-subtle bg-surface-subtle px-2.5 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted block">
                          Pengembalian
                        </span>
                        <p
                          className="mt-0.5 truncate font-semibold text-text-secondary tabular-nums"
                          title={formatDate(transaction.loan.returnedAt)}
                        >
                          {formatDate(transaction.loan.returnedAt)}
                        </p>
                      </div>
                    </div>

                    {/* AKSI BARIS (MOBILE / TABLET) */}
                    <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5">
                      <span className="text-xs font-medium text-text-secondary">Pilihan Aksi</span>
                      <RowActions
                        actions={[
                          ...(canReturn && transaction.loan.status !== "COMPLETED"
                            ? [
                                {
                                  label: "Kembalikan",
                                  href: `/returns?loanNumber=${encodeURIComponent(transaction.loan.loanNumber)}&loanId=${encodeURIComponent(transaction.loan.id)}`,
                                  icon: (
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                      <path d="m9 14-5-5 5-5" />
                                      <path d="M4 9h11a4 4 0 0 1 4 4v2" />
                                    </svg>
                                  ),
                                },
                              ]
                            : []),
                          ...(canViewMember && (transaction.member?.id || transaction.loan.memberId)
                            ? [
                                {
                                  label: "Lihat Anggota",
                                  href: `/master/members?memberId=${encodeURIComponent(transaction.member?.id || transaction.loan.memberId)}`,
                                  icon: (
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                      <circle cx="12" cy="7" r="4" />
                                    </svg>
                                  ),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </Card>
                );
              }}
            />

            {/* PAGINATION */}
            {transactions.length > 0 && (
              <div className="mt-4">
                <div className="rounded-xl border border-border bg-surface shadow-2xs">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(nextPage) => setPage(nextPage)}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onPageSizeChange={(newSize) => {
                      setPageSize(newSize);
                      setPage(1);
                    }}
                    className="border-t-0 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-subtle">
          <LoadingState label="Memuat riwayat transaksi..." />
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}
