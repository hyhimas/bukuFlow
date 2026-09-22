"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import DatePicker from "@/components/ui/DatePicker";
import BackLink from "@/components/ui/BackLink";
import EmptyState from "@/components/ui/EmptyState";
import FeedbackPanel from "@/components/ui/FeedbackPanel";
import LoadingState from "@/components/ui/LoadingState";

import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessTransactions } from "@/lib/authorization";

import { getTransactions } from "@/lib/mock-api";
import {
  exportToExcel,
  filterByExportDate,
  type ExportPeriod,
} from "@/lib/export/excel";

import type { Loan, TransactionData } from "@/lib/types";

type TransactionStatus = "ACTIVE" | "OVERDUE" | "COMPLETED";

const PAGE_SIZE = 5;

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

export default function TransactionsPage() {
  const router = useRouter();

  // =========================================================
  // DATA
  // =========================================================

  const [transactions, setTransactions] = useState<TransactionData[]>([]);

  const [tableLoading, setTableLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasLoadedTransactions = useRef(false);

  // =========================================================
  // SEARCH
  // Search memang langsung diterapkan
  // =========================================================

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // =========================================================
  // APPLIED FILTERS
  // Filter yang benar-benar sedang digunakan tabel
  // =========================================================

  const [status, setStatus] = useState<TransactionStatus | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // =========================================================
  // TEMPORARY FILTERS
  // Filter yang sedang diedit di drawer
  //
  // TIDAK memengaruhi tabel sampai klik:
  // "Terapkan Filter"
  // =========================================================

  const [filterStatus, setFilterStatus] = useState<TransactionStatus | "">("");

  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // =========================================================
  // EXPORT EXCEL
  // =========================================================

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("ALL");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");

  // =========================================================
  // PAGINATION
  // =========================================================

  const [page, setPage] = useState(1);

  // =========================================================
  // SESSION CHECK
  // =========================================================

  useEffect(() => {
    const session = getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    if (!canAccessTransactions(session.user.role)) {
      router.replace("/dashboard");
    }
  }, [router]);

  // =========================================================
  // LOAD TRANSACTIONS
  // =========================================================

  useEffect(() => {
    async function loadTransactions() {
      if (!hasLoadedTransactions.current) {
        setLoading(true);
      } else {
        setTableLoading(true);
      }

      setError("");

      try {
        const result = await getTransactions();

        setTransactions(result);
        hasLoadedTransactions.current = true;
      } catch {
        setError("Riwayat transaksi gagal dimuat.");
      } finally {
        setLoading(false);
        setTableLoading(false);
      }
    }

    void loadTransactions();
  }, []);

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

  useEffect(() => {
    if (!hasLoadedTransactions.current) {
      return;
    }

    setTableLoading(true);

    const timer = window.setTimeout(() => {
      setTableLoading(false);
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [debouncedSearch, status, startDate, endDate, page]);

  // =========================================================
  // FILTER
  //
  // Hanya menggunakan APPLIED FILTERS:
  // status
  // startDate
  // endDate
  //
  // filterStatus / filterStartDate / filterEndDate
  // TIDAK digunakan di sini karena masih temporary.
  // =========================================================

  const filteredTransactions = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    return transactions.filter(({ loan, member, items }) => {
      // -------------------------------------------------------
      // SEARCH
      // -------------------------------------------------------

      const matchesSearch =
        keyword === "" ||
        loan.loanNumber.toLowerCase().includes(keyword) ||
        member?.name.toLowerCase().includes(keyword) ||
        items.some(
          ({ book, bookCopy }) =>
            book?.title.toLowerCase().includes(keyword) ||
            bookCopy?.code.toLowerCase().includes(keyword),
        );

      // -------------------------------------------------------
      // STATUS
      // -------------------------------------------------------

      const matchesStatus = status === "" || loan.status === status;

      // -------------------------------------------------------
      // DATE
      // -------------------------------------------------------

      const borrowedDate = getDateOnly(loan.borrowedAt);
      const dueDate = getDateOnly(loan.dueAt);

      const matchesStartDate =
        startDate === "" || (borrowedDate !== "" && borrowedDate >= startDate);

      const matchesEndDate =
        endDate === "" || (dueDate !== "" && dueDate <= endDate);

      return (
        matchesSearch && matchesStatus && matchesStartDate && matchesEndDate
      );
    });
  }, [transactions, debouncedSearch, status, startDate, endDate]);

  // =========================================================
  // PAGINATION
  // =========================================================

  function resetPagination() {
    setPage(1);
  }

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / PAGE_SIZE),
  );

  const currentPage = Math.min(page, totalPages);

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

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

    return loanStatus;
  }

  function getStatusVariant(loanStatus: Loan["status"]) {
    if (loanStatus === "OVERDUE") {
      return "danger" as const;
    }

    if (loanStatus === "COMPLETED") {
      return "success" as const;
    }

    return "warning" as const;
  }

  // =========================================================
  // ACTIVE FILTER CHECK
  // =========================================================

  const hasActiveFilters = status !== "" || startDate !== "" || endDate !== "";

  // =========================================================
  // RESET APPLIED FILTERS
  //
  // Ini benar-benar mengubah tabel.
  // =========================================================

  function resetFilters() {
    setSearch("");
    setStatus("");
    setStartDate("");
    setEndDate("");

    resetPagination();
  }

  // =========================================================
  // OPEN FILTER DRAWER
  //
  // Applied filter disalin ke temporary filter.
  // =========================================================

  function openFilter() {
    setFilterStatus(status);
    setFilterStartDate(startDate);
    setFilterEndDate(endDate);

    setIsFilterOpen(true);
  }

  // =========================================================
  // CLOSE FILTER DRAWER
  //
  // Temporary changes otomatis dibuang karena tidak pernah
  // masuk ke applied state.
  // =========================================================

  function closeFilter() {
    setIsFilterOpen(false);
  }

  // =========================================================
  // APPLY FILTER
  //
  // Temporary -> Applied
  // Baru setelah ini tabel berubah.
  // =========================================================

  function applyFilters() {
    setStatus(filterStatus);
    setStartDate(filterStartDate);
    setEndDate(filterEndDate);

    resetPagination();
    setIsFilterOpen(false);
  }

  // =========================================================
  // RESET TEMPORARY FILTER
  //
  // Hanya mengubah isi drawer.
  // Tabel BELUM berubah.
  // =========================================================

  function resetDrawerFilters() {
    setFilterStatus("");
    setFilterStartDate("");
    setFilterEndDate("");
  }

  // =========================================================
  // REMOVE INDIVIDUAL FILTER CHIP
  // =========================================================

  function removeSearchFilter() {
    setSearch("");
    resetPagination();
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
  }

  // =========================================================
  // EXPORT EXCEL
  // =========================================================

  function handleExportExcel() {
    const exportTransactions = filterByExportDate(
      transactions,
      ({ loan }) => getDateOnly(loan.borrowedAt),
      exportPeriod,
      exportStartDate,
      exportEndDate,
    );

    const rows = exportTransactions.map(({ loan, member, items, user }) => ({
      "Nomor Transaksi": loan.loanNumber,
      Anggota: member?.name ?? "-",
      Buku: items
        .map(
          ({ book, bookCopy }) =>
            `${book?.title ?? "-"}${
              bookCopy?.code ? ` (${bookCopy.code})` : ""
            }`,
        )
        .join(", "),
      Petugas: user?.name ?? "-",
      "Tanggal Peminjaman": formatDate(loan.borrowedAt),
      "Jatuh Tempo": formatDate(loan.dueAt),
      "Tanggal Pengembalian": formatDate(loan.returnedAt),
      Status: getStatusLabel(loan.status),
    }));

    if (rows.length === 0) {
      alert("Tidak ada transaksi pada periode yang dipilih.");
      return;
    }

    exportToExcel(
      rows,
      `riwayat-transaksi-${getDateOnly(new Date().toISOString())}.xlsx`,
      "Riwayat Transaksi",
    );

    setIsExportOpen(false);
  }

  function closeExport() {
    setIsExportOpen(false);
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <LoadingState label="Memuat riwayat transaksi..." />
      </main>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="page-container py-5 sm:py-6">
        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="mb-5 sm:mb-6">
          <BackLink href="/dashboard" />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Riwayat Transaksi
              </h1>

              <p className="mt-1 text-sm leading-6 text-slate-500 sm:text-base">
                Lihat riwayat peminjaman dan pengembalian.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => setIsExportOpen(true)}
              className="w-full sm:w-auto"
            >
              Export Excel
            </Button>
          </div>
        </div>

        {/* =====================================================
            ERROR
        ====================================================== */}

        {error && (
          <FeedbackPanel tone="error" className="mb-5">
            <div>
              <p>{error}</p>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 min-h-10 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Coba lagi
              </button>
            </div>
          </FeedbackPanel>
        )}

        {/* =====================================================
            SEARCH + FILTER TOOLBAR
        ====================================================== */}

        <div className="mb-5">
          <Card className="mb-3 p-3 sm:p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2.5 sm:gap-3">
              {/* SEARCH */}

              <div className="min-w-0">
                <Input
                  id="transaction-search"
                  label="Pencarian"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetPagination();
                  }}
                  placeholder="Nomor, anggota, buku, copy..."
                />
              </div>

              {/* FILTER BUTTON */}

              <Button
                type="button"
                variant="secondary"
                onClick={openFilter}
                className="!w-[92px] !shrink-0 !px-3"
              >
                <span className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 6h16M7 12h10M10 18h4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>

                  <span>Filter</span>
                </span>
              </Button>
            </div>
          </Card>

          {/* ===================================================
              ACTIVE FILTER CHIPS
          ==================================================== */}

          {(hasActiveFilters || search.trim() !== "") && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {search.trim() !== "" && (
                <button
                  type="button"
                  onClick={removeSearchFilter}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:text-sm"
                >
                  <span className="max-w-[220px] truncate">
                    Pencarian: {search}
                  </span>

                  <span className="text-slate-400" aria-hidden="true">
                    ×
                  </span>
                </button>
              )}

              {startDate !== "" && (
                <button
                  type="button"
                  onClick={removeStartDateFilter}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:text-sm"
                >
                  Dari: {formatDate(startDate)}
                  <span className="text-slate-400" aria-hidden="true">
                    ×
                  </span>
                </button>
              )}

              {endDate !== "" && (
                <button
                  type="button"
                  onClick={removeEndDateFilter}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:text-sm"
                >
                  Sampai: {formatDate(endDate)}
                  <span className="text-slate-400" aria-hidden="true">
                    ×
                  </span>
                </button>
              )}

              {status !== "" && (
                <button
                  type="button"
                  onClick={removeStatusFilter}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:text-sm"
                >
                  Status: {getStatusLabel(status)}
                  <span className="text-slate-400" aria-hidden="true">
                    ×
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 sm:text-sm"
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

                <span>Reset semua</span>
              </button>
            </div>
          )}
        </div>

        {/* =====================================================
            FILTER DRAWER
        ====================================================== */}

        {isFilterOpen && (
          <div
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-title"
          >
            {/* OVERLAY */}

            <button
              type="button"
              aria-label="Tutup filter"
              onClick={closeFilter}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
            />

            {/* DRAWER */}

            <aside
              className="
                absolute right-0 top-0
                flex h-full w-full max-w-md
                flex-col bg-white shadow-2xl
              "
            >
              {/* =================================================
                  DRAWER HEADER
              ================================================== */}

              <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                  <h2
                    id="filter-title"
                    className="text-lg font-semibold tracking-tight text-slate-900"
                  >
                    Filter Transaksi
                  </h2>

                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Atur filter untuk menemukan transaksi.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeFilter}
                  aria-label="Tutup filter"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
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
                </button>
              </div>

              {/* =================================================
                  DRAWER CONTENT
              ================================================== */}

              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                {/* =================================================
                    PERIODE
                ================================================== */}

                <section>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Periode
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Pilih rentang tanggal transaksi.
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {/* DARI */}

                    <DatePicker
                      id="transaction-start-date"
                      label="Dari tanggal"
                      value={filterStartDate}
                      showClearButton
                      onChange={(value) => {
                        setFilterStartDate(value);

                        // Kalau tanggal awal digeser melewati
                        // tanggal akhir, kosongkan tanggal akhir.
                        if (
                          filterEndDate !== "" &&
                          value !== "" &&
                          filterEndDate < value
                        ) {
                          setFilterEndDate("");
                        }
                      }}
                    />

                    {/* SAMPAI */}

                    <DatePicker
                      id="transaction-end-date"
                      label="Sampai tanggal"
                      value={filterEndDate}
                      min={filterStartDate || undefined}
                      showClearButton
                      onChange={(value) => {
                        setFilterEndDate(value);
                      }}
                    />
                  </div>
                </section>

                {/* DIVIDER */}

                <div className="my-6 border-t border-slate-100" />

                {/* =================================================
                    STATUS
                ================================================== */}

                <section>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Status
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((option) => {
                      const selected = filterStatus === option.value;

                      return (
                        <button
                          key={option.value || "all"}
                          type="button"
                          onClick={() => {
                            setFilterStatus(option.value);
                          }}
                          className={[
                            "min-h-10 rounded-lg border px-4 py-2 text-sm font-medium transition",
                            selected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                          ].join(" ")}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* =================================================
                  DRAWER FOOTER
              ================================================== */}

              <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                <div className="flex gap-2.5 sm:gap-3">
                  {/* RESET */}

                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1 px-3"
                    onClick={resetDrawerFilters}
                  >
                    Reset Filter
                  </Button>

                  {/* APPLY */}

                  <Button
                    type="button"
                    className="flex-1 px-3"
                    onClick={applyFilters}
                  >
                    Terapkan Filter
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* =====================================================
            EXPORT EXCEL MODAL
        ====================================================== */}

        {isExportOpen && (
          <div
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
          >
            <button
              type="button"
              aria-label="Tutup export"
              onClick={closeExport}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
            />

            <div className="relative flex min-h-full items-center justify-center p-4">
              <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
                  <div>
                    <h2
                      id="export-title"
                      className="text-lg font-semibold tracking-tight text-slate-900"
                    >
                      Export Excel
                    </h2>

                    <p className="mt-1 text-sm leading-5 text-slate-500">
                      Pilih periode transaksi yang ingin diexport.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeExport}
                    aria-label="Tutup export"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
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
                  </button>
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
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setExportPeriod(option.value)}
                          className={[
                            "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition",
                            selected
                              ? "border-blue-600 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                              selected
                                ? "border-blue-600 bg-white"
                                : "border-slate-300 bg-white",
                            ].join(" ")}
                          >
                            <span
                              className="block rounded-full"
                              style={{
                                width: selected ? 10 : 0,
                                height: selected ? 10 : 0,
                                backgroundColor: selected
                                  ? "#2563eb"
                                  : "transparent",
                              }}
                            />
                          </span>

                          <span className="font-medium">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {exportPeriod === "CUSTOM" && (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <DatePicker
                        id="export-start-date"
                        label="Dari tanggal"
                        value={exportStartDate}
                        showClearButton
                        onChange={(value) => setExportStartDate(value)}
                      />

                      <DatePicker
                        id="export-end-date"
                        label="Sampai tanggal"
                        value={exportEndDate}
                        min={exportStartDate || undefined}
                        showClearButton
                        onChange={(value) => setExportEndDate(value)}
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={closeExport}
                  >
                    Batal
                  </Button>

                  <Button
                    type="button"
                    className="flex-1"
                    onClick={handleExportExcel}
                    disabled={
                      exportPeriod === "CUSTOM" &&
                      (exportStartDate === "" || exportEndDate === "")
                    }
                  >
                    Export Excel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            EMPTY STATE
        ====================================================== */}

        {filteredTransactions.length === 0 && !tableLoading ? (
          <Card className="mt-5 p-4 sm:p-5">
            <EmptyState
              title="Tidak ada transaksi"
              description="Tidak ada transaksi yang sesuai dengan pencarian atau filter."
            />
          </Card>
        ) : (
          <>
            {/* =================================================
                DESKTOP TABLE
            ================================================== */}

            <Card className="relative mt-5 hidden overflow-hidden xl:block">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col className="w-[15%]" />
                  <col className="w-[12%]" />
                  <col className="w-[19%]" />
                  <col className="w-[13%]" />
                  <col className="w-[10%]" />
                  <col className="w-[9%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                </colgroup>

                {/* TABLE HEADER */}

                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Nomor transaksi
                    </th>

                    <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Anggota
                    </th>

                    <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Buku
                    </th>

                    <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Petugas
                    </th>

                    <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Peminjaman
                    </th>

                    <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Jatuh tempo
                    </th>

                    <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Pengembalian
                    </th>

                    <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>

                {/* TABLE BODY */}

                <tbody>
                  {paginatedTransactions.map((transaction) => (
                    <tr
                      key={transaction.loan.id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                    >
                      {/* NOMOR TRANSAKSI */}

                      <td className="min-w-0 px-4 py-3.5 align-middle">
                        <p
                          className="truncate whitespace-nowrap font-semibold tracking-tight text-slate-900"
                          title={transaction.loan.loanNumber}
                        >
                          {transaction.loan.loanNumber}
                        </p>
                      </td>

                      {/* ANGGOTA */}

                      <td className="min-w-0 px-4 py-3.5 align-middle">
                        <p
                          className="truncate text-slate-700"
                          title={transaction.member?.name ?? "-"}
                        >
                          {transaction.member?.name ?? "-"}
                        </p>
                      </td>

                      {/* BUKU */}

                      <td className="min-w-0 px-4 py-3.5 align-middle">
                        {transaction.items.length === 0 ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <ul className="min-w-0 space-y-1">
                            {transaction.items.map(({ book, bookCopy }) => (
                              <li
                                key={`${transaction.loan.id}-${book?.id ?? "book"}-${bookCopy?.id ?? "copy"}`}
                                className="grid min-w-0 grid-cols-[10px_minmax(0,1fr)]"
                              >
                                <span
                                  className="text-slate-300"
                                  aria-hidden="true"
                                >
                                  •
                                </span>

                                <span
                                  className="min-w-0 leading-5 text-slate-700"
                                  title={`${book?.title ?? "-"}${bookCopy?.code ? ` (${bookCopy.code})` : ""}`}
                                >
                                  <span className="font-medium">
                                    {book?.title ?? "-"}
                                  </span>

                                  {bookCopy?.code && (
                                    <span className="ml-1 text-slate-400">
                                      ({bookCopy.code})
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>

                      {/* PETUGAS */}

                      <td className="min-w-0 px-4 py-3.5 align-middle">
                        <p
                          className="truncate text-slate-700"
                          title={transaction.user?.name ?? "-"}
                        >
                          {transaction.user?.name ?? "-"}
                        </p>
                      </td>

                      {/* PEMINJAMAN */}

                      <td className="px-4 py-3.5 text-center align-middle">
                        <span className="whitespace-nowrap text-slate-700">
                          {formatDate(transaction.loan.borrowedAt)}
                        </span>
                      </td>

                      {/* JATUH TEMPO */}

                      <td className="px-4 py-3.5 text-center align-middle">
                        <span className="whitespace-nowrap text-slate-700">
                          {formatDate(transaction.loan.dueAt)}
                        </span>
                      </td>

                      {/* PENGEMBALIAN */}

                      <td className="px-4 py-3.5 text-center align-middle">
                        <span className="whitespace-nowrap text-slate-700">
                          {formatDate(transaction.loan.returnedAt)}
                        </span>
                      </td>

                      {/* STATUS */}

                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex justify-center">
                          <Badge
                            variant={getStatusVariant(transaction.loan.status)}
                          >
                            {getStatusLabel(transaction.loan.status)}
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tableLoading && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-white/70"
                  role="status"
                  aria-live="polite"
                  aria-label="Memuat riwayat transaksi"
                >
                  <div className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                    Memuat data...
                  </div>
                </div>
              )}
            </Card>

            {/* =================================================
                TABLET + MOBILE
            ================================================== */}

            <div className="relative mt-5 space-y-3 xl:hidden">
              {paginatedTransactions.map((transaction) => (
                <Card key={transaction.loan.id} className="p-4 sm:p-5">
                  {/* =================================================
                      TRANSACTION HEADER
                  ================================================== */}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-semibold tracking-tight text-slate-900 sm:text-base"
                        title={transaction.loan.loanNumber}
                      >
                        {transaction.loan.loanNumber}
                      </p>

                      <p
                        className="mt-0.5 truncate text-sm text-slate-500"
                        title={transaction.member?.name ?? "-"}
                      >
                        {transaction.member?.name ?? "-"}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <Badge
                        variant={getStatusVariant(transaction.loan.status)}
                      >
                        {getStatusLabel(transaction.loan.status)}
                      </Badge>
                    </div>
                  </div>

                  {/* =================================================
                      BUKU
                  ================================================== */}

                  <div className="mt-4">
                    <p className="text-xs font-medium text-slate-500 sm:text-sm">
                      Buku
                    </p>

                    {transaction.items.length === 0 ? (
                      <p className="mt-1 text-sm text-slate-900">-</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-sm leading-5 text-slate-900 sm:text-base">
                        {transaction.items.map(({ book, bookCopy }) => (
                          <li
                            key={`${transaction.loan.id}-${book?.id ?? "book"}-${bookCopy?.id ?? "copy"}`}
                            className="break-words"
                          >
                            <span
                              aria-hidden="true"
                              className="mr-1 text-slate-400"
                            >
                              •
                            </span>

                            <span className="font-medium">
                              {book?.title ?? "-"}
                            </span>

                            {bookCopy?.code && (
                              <span className="ml-1 text-slate-400">
                                ({bookCopy.code})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* DIVIDER */}

                  <div className="my-4 border-t border-slate-100" />

                  {/* =================================================
                      PETUGAS
                  ================================================== */}

                  <div className="mb-4">
                    <p className="text-xs font-medium text-slate-500 sm:text-sm">
                      Petugas
                    </p>

                    <p
                      className="mt-0.5 truncate text-sm text-slate-900 sm:text-base"
                      title={transaction.user?.name ?? "-"}
                    >
                      {transaction.user?.name ?? "-"}
                    </p>
                  </div>

                  {/* =================================================
                      DATE INFORMATION
                  ================================================== */}

                  <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                    {/* PEMINJAMAN */}

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">
                        Peminjaman
                      </p>

                      <p className="mt-0.5 whitespace-nowrap text-sm text-slate-900 sm:text-base">
                        {formatDate(transaction.loan.borrowedAt)}
                      </p>
                    </div>

                    {/* JATUH TEMPO */}

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">
                        Jatuh tempo
                      </p>

                      <p className="mt-0.5 whitespace-nowrap text-sm text-slate-900 sm:text-base">
                        {formatDate(transaction.loan.dueAt)}
                      </p>
                    </div>

                    {/* PENGEMBALIAN */}

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">
                        Pengembalian
                      </p>

                      <p className="mt-0.5 whitespace-nowrap text-sm text-slate-900 sm:text-base">
                        {formatDate(transaction.loan.returnedAt)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
              {tableLoading && (
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70"
                  role="status"
                  aria-live="polite"
                  aria-label="Memuat riwayat transaksi"
                >
                  <div className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                    Memuat data...
                  </div>
                </div>
              )}
            </div>

            {/* =================================================
                PAGINATION
            ================================================== */}

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2.5 sm:px-4">
                <p className="text-xs text-slate-500">
                  Halaman {currentPage} dari {totalPages}
                </p>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ←
                  </button>

                  {Array.from(
                    {
                      length: totalPages,
                    },
                    (_, index) => index + 1,
                  )
                    .filter(
                      (number) =>
                        number === 1 ||
                        number === totalPages ||
                        Math.abs(number - currentPage) <= 1,
                    )
                    .map((number) => (
                      <button
                        key={number}
                        type="button"
                        onClick={() => setPage(number)}
                        className={`h-8 min-w-8 rounded-md px-2 text-xs font-semibold ${
                          number === currentPage
                            ? "bg-blue-600 text-white"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {number}
                      </button>
                    ))}

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
