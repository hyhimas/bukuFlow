"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import DatePicker from "@/components/ui/DatePicker";
import BackLink from "@/components/ui/BackLink";
import LoadingState from "@/components/ui/LoadingState";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/components/ui/Pagination";
import RowActions from "@/components/ui/RowActions";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import { useSearchHotkey } from "@/hooks/useHotkeys";
import CompanySwitcher, {
  getStoredOfficeCompanyId,
  setStoredOfficeCompanyId,
} from "@/components/office/CompanySwitcher";

import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import {
  getCompaniesApi,
  searchOfficeLoansApi,
  getErrorMessage,
  type OfficeLoanItem,
} from "@/lib/api";
import type { Company } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { exportToExcel } from "@/lib/export/excel";

type TransactionStatus = "ACTIVE" | "OVERDUE" | "COMPLETED";

const STATUS_OPTIONS: {
  value: TransactionStatus | "";
  label: string;
}[] = [
  { value: "", label: "Semua" },
  { value: "ACTIVE", label: "Dipinjam (Aktif)" },
  { value: "OVERDUE", label: "Terlambat" },
  { value: "COMPLETED", label: "Selesai" },
];

type SortField = "loanNumber" | "borrowedAt" | "dueAt";

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getStatusLabel(status: OfficeLoanItem["status"]) {
  if (status === "ACTIVE") return "Dipinjam";
  if (status === "OVERDUE") return "Terlambat";
  if (status === "COMPLETED") return "Selesai";
  return status;
}

function getStatusVariant(status: OfficeLoanItem["status"]): BadgeVariant {
  if (status === "ACTIVE") return "info";
  if (status === "OVERDUE") return "danger";
  if (status === "COMPLETED") return "success";
  return "neutral";
}

function OfficeLoansContent() {
  const router = useRouter();
  const { toast } = useToast();

  const [isAuthorized] = useState(() => {
    if (typeof window === "undefined") return false;
    const session = getSession();
    return Boolean(session && session.user.role === "SUPER_ADMIN");
  });

  // Companies & Selection
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() =>
    getStoredOfficeCompanyId()
  );

  // Table Data & Loading
  const [loans, setLoans] = useState<OfficeLoanItem[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Search
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // =========================================================
  // APPLIED FILTERS
  // =========================================================
  const [status, setStatus] = useState<TransactionStatus | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [returnedFrom, setReturnedFrom] = useState("");
  const [returnedTo, setReturnedTo] = useState("");

  // =========================================================
  // TEMPORARY FILTERS (Di Drawer)
  // =========================================================
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | "">("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterDueFrom, setFilterDueFrom] = useState("");
  const [filterDueTo, setFilterDueTo] = useState("");
  const [filterReturnedFrom, setFilterReturnedFrom] = useState("");
  const [filterReturnedTo, setFilterReturnedTo] = useState("");

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFilterMounted, setIsFilterMounted] = useState(false);

  // Interactive Sorting
  const [sortBy, setSortBy] = useState<SortField>("borrowedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const savedTotalRef = useRef(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchHotkey(searchInputRef, {
    enabled: Boolean(selectedCompanyId) && !error && !tableLoading,
  });

  // Detail Modal
  const [selectedLoan, setSelectedLoan] = useState<OfficeLoanItem | null>(null);

  // Export to Excel
  const [exportLoading, setExportLoading] = useState(false);
  const selectedCompanyName =
    companies.find((c) => c.id === selectedCompanyId)?.name || "Perpustakaan";

  // Debounce search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  // Guard Super Admin Authentication
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
    if (isAuthorized) {
      getCompaniesApi()
        .then((comps) => {
          setCompanies(comps);
        })
        .catch((err: unknown) => {
          console.warn(
            "Daftar instansi belum tersedia di backend:",
            err instanceof Error ? err.message : err
          );
        });
    }
  }, [isAuthorized]);

  // Load Loans Data from Office Endpoint
  const loadLoans = useCallback(async () => {
    if (!isAuthorized || !selectedCompanyId) return;

    setTableLoading(true);
    setError("");

    try {
      const backendSortBy =
        sortBy === "borrowedAt"
          ? "borrowed_at"
          : sortBy === "dueAt"
          ? "due_at"
          : sortBy === "loanNumber"
          ? "id"
          : undefined;

      const res = await searchOfficeLoansApi(selectedCompanyId, {
        page,
        size: pageSize,
        q: debouncedSearch.trim() || undefined,
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

      setLoans(res.items);

      // Pagination rule for BE (-1 on page > 1)
      if (res.total !== -1) {
        savedTotalRef.current = res.total;
        setTotal(res.total);
        setTotalPages(Math.max(1, Math.ceil(res.total / pageSize)));
      } else {
        setTotal(savedTotalRef.current);
        setTotalPages(
          Math.max(1, Math.ceil(savedTotalRef.current / pageSize))
        );
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Gagal memuat daftar peminjaman.");
      setError(msg);
    } finally {
      setTableLoading(false);
    }
  }, [
    isAuthorized,
    selectedCompanyId,
    page,
    pageSize,
    debouncedSearch,
    status,
    startDate,
    endDate,
    dueFrom,
    dueTo,
    returnedFrom,
    returnedTo,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch daftar peminjaman panel office saat mount atau filter berubah
    void loadLoans();
  }, [loadLoans, reloadKey]);

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

    setPage(1);
    savedTotalRef.current = 0;
    closeFilter();
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

  function resetAllFilters() {
    setSearch("");
    setStatus("");
    setStartDate("");
    setEndDate("");
    setDueFrom("");
    setDueTo("");
    setReturnedFrom("");
    setReturnedTo("");
    setPage(1);
    savedTotalRef.current = 0;
  }

  const hasActiveFilters = Boolean(
    status ||
    startDate ||
    endDate ||
    dueFrom ||
    dueTo ||
    returnedFrom ||
    returnedTo
  );

  const isFiltered = Boolean(hasActiveFilters || search.trim());

  // Column definitions for DataTable
  const columns = useMemo<DataTableColumn<OfficeLoanItem>[]>(
    () => [
      {
        key: "loanNumber",
        header: "Nomor peminjaman",
        width: "145px",
        sortable: true,
        sortKey: "loanNumber",
        render: (loan) => (
          <span
            className="truncate whitespace-nowrap font-semibold tracking-tight text-slate-900 font-mono text-xs tabular-nums block"
            title={
              loan.rawLoanNumber
                ? `ID Sistem: ${loan.rawLoanNumber}`
                : loan.loanNumber
            }
          >
            {loan.loanNumber}
          </span>
        ),
      },
      {
        key: "member",
        header: "Anggota",
        width: "140px",
        render: (loan) => (
          <div>
            <p
              className="truncate text-slate-800 font-medium text-xs font-medium"
              title={loan.memberName || "-"}
            >
              {loan.memberName ||
                (loan.memberNumber
                  ? `Anggota (${loan.memberNumber})`
                  : "Anggota")}
            </p>
            {loan.memberNumber && loan.memberNumber !== "-" && (
              <p className="text-xs text-slate-500 font-mono truncate">
                {loan.memberNumber}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "books",
        header: "Buku",
        render: (loan) => {
          const bookItems =
            loan.items && loan.items.length > 0
              ? loan.items
              : loan.copyIds.map((cid, idx) => ({
                  id: cid,
                  bookTitle: `Salinan Buku #${idx + 1}`,
                  copyCode: cid,
                }));
          if (bookItems.length === 0) {
            return <span className="text-slate-500 text-xs">-</span>;
          }
          return (
            <ul className="min-w-0 space-y-0.5">
              {bookItems.map((item, idx) => (
                <li
                  key={item.id || idx}
                  className="grid min-w-0 grid-cols-[10px_minmax(0,1fr)] text-xs"
                >
                  <span className="text-slate-300 select-none" aria-hidden="true">
                    &bull;
                  </span>
                  <span
                    className="min-w-0 leading-5 text-slate-700 truncate"
                    title={`${item.bookTitle}${item.copyCode ? ` (${item.copyCode})` : ""}`}
                  >
                    <span className="font-medium text-slate-800">
                      {item.bookTitle}
                    </span>
                    {item.copyCode && (
                      <span className="ml-1 text-slate-500 text-xs font-mono">
                        ({item.copyCode})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          );
        },
      },
      {
        key: "officer",
        header: "Petugas",
        width: "105px",
        render: (loan) => (
          <p
            className="truncate text-slate-600 text-xs font-medium"
            title={loan.officerName || "Petugas"}
          >
            {loan.officerName || "Petugas"}
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
        render: (loan) => (
          <span className="whitespace-nowrap text-slate-700 tabular-nums text-xs font-medium">
            {formatDate(loan.borrowedAt)}
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
        render: (loan) => {
          const isOverdue = loan.status === "OVERDUE";
          return (
            <span
              className={`whitespace-nowrap tabular-nums text-xs font-medium ${
                isOverdue ? "font-bold text-red-600" : "text-slate-700"
              }`}
            >
              {formatDate(loan.dueAt)}
            </span>
          );
        },
      },
      {
        key: "returnedAt",
        header: "Pengembalian",
        width: "105px",
        isNumeric: true,
        render: (loan) => (
          <span className="whitespace-nowrap text-slate-700 tabular-nums text-xs font-medium">
            {formatDate(loan.returnedAt)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "100px",
        render: (loan) => (
          <Badge variant={getStatusVariant(loan.status)}>
            {getStatusLabel(loan.status)}
          </Badge>
        ),
      },
      {
        key: "actions",
        header: "Aksi",
        width: "60px",
        align: "right",
        render: (loan) => (
          <RowActions
            actions={[
              {
                label: "Detail",
                onClick: () => setSelectedLoan(loan),
                icon: (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ),
              },
              {
                label: "Lihat Anggota",
                href: "/office/members",
                icon: (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                ),
              },
            ]}
          />
        ),
      },
    ],
    []
  );

  // Export to Excel
  async function handleExportExcel() {
    if (!selectedCompanyId) {
      toast.warning("Pilih instansi terlebih dahulu.");
      return;
    }

    try {
      setExportLoading(true);
      const BATCH_SIZE = 100;
      let allLoans: OfficeLoanItem[] = [];

      const firstRes = await searchOfficeLoansApi(selectedCompanyId, {
        page: 1,
        size: BATCH_SIZE,
        q: debouncedSearch.trim() || undefined,
        status: status || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        due_from: dueFrom || undefined,
        due_to: dueTo || undefined,
        returned_from: returnedFrom || undefined,
        returned_to: returnedTo || undefined,
      });

      allLoans = [...firstRes.items];
      const totalCount = firstRes.total > 0 ? firstRes.total : allLoans.length;
      const totalBatches = Math.max(1, Math.ceil(totalCount / BATCH_SIZE));

      if (totalBatches > 1) {
        toast.info(`Mengunduh seluruh data peminjaman (1/${totalBatches})...`);
        for (let p = 2; p <= totalBatches; p++) {
          const batchRes = await searchOfficeLoansApi(selectedCompanyId, {
            page: p,
            size: BATCH_SIZE,
            q: debouncedSearch.trim() || undefined,
            status: status || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            due_from: dueFrom || undefined,
            due_to: dueTo || undefined,
            returned_from: returnedFrom || undefined,
            returned_to: returnedTo || undefined,
          });
          allLoans.push(...batchRes.items);
          if (batchRes.items.length === 0) break;
        }
      }

      if (allLoans.length === 0) {
        toast.warning("Tidak ada data transaksi peminjaman untuk diekspor.");
        return;
      }

      const rows = allLoans.map((loan, idx) => {
        const bookTitles =
          loan.items && loan.items.length > 0
            ? loan.items
                .map(
                  (it) =>
                    `${it.bookTitle}${it.copyCode ? ` (${it.copyCode})` : ""}`
                )
                .join(", ")
            : loan.copyIds && loan.copyIds.length > 0
            ? loan.copyIds.join(", ")
            : "-";

        return {
          No: idx + 1,
          "Nomor Peminjaman": loan.loanNumber,
          "Nama Peminjam": loan.memberName || "-",
          "Nomor Anggota": loan.memberNumber || "-",
          "Buku / Salinan": bookTitles,
          Petugas: loan.officerName || "-",
          "Tanggal Pinjam": formatDate(loan.borrowedAt || loan.createdAt),
          "Jatuh Tempo": formatDate(loan.dueAt),
          "Tanggal Kembali": loan.returnedAt
            ? formatDate(loan.returnedAt)
            : "-",
          Status:
            loan.status === "ACTIVE"
              ? "Dipinjam"
              : loan.status === "OVERDUE"
              ? "Terlambat"
              : "Selesai",
        };
      });

      const cleanCompName = selectedCompanyName.replace(/[^a-zA-Z0-9]/g, "_");
      exportToExcel(
        rows,
        `Transaksi_Peminjaman_${cleanCompName}_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`,
        "Peminjaman"
      );
      toast.success("Data peminjaman berhasil diekspor ke Excel.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal mengekspor data peminjaman."));
    } finally {
      setExportLoading(false);
    }
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50">
        <LoadingState label="Memeriksa otorisasi Super Admin..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="page-container py-5 sm:py-6">
        {/* HEADER */}
        <PageHeader
          className="mb-6"
          title="Inspeksi Transaksi Peminjaman"
          description="Pencarian dan audit peminjaman buku lintas instansi perpustakaan."
          backLink={<BackLink href="/office/dashboard">Kembali ke Dashboard Office</BackLink>}
          actions={
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              <CompanySwitcher
                size="sm"
                selectedCompanyId={selectedCompanyId}
                onSelectCompany={(id) => {
                  setStoredOfficeCompanyId(id);
                  setSelectedCompanyId(id);
                  setPage(1);
                  setLoans([]);
                  setSelectedLoan(null);
                  setTotal(0);
                  setTotalPages(1);
                  savedTotalRef.current = 0;
                }}
                companies={companies}
              />

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleExportExcel}
                disabled={Boolean(error) || !selectedCompanyId || exportLoading || tableLoading || loans.length === 0}
                loading={exportLoading}
                className="w-full sm:w-auto text-xs h-9 px-3 text-center whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mr-1.5 inline h-4 w-4 text-emerald-600"
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
                Ekspor Excel
              </Button>
            </div>
          }
        />

        {/* State 1: Belum Memilih Instansi */}
        {!selectedCompanyId ? (
          <Card className="mt-6 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <TransactionIcon />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Pilih Instansi Terlebih Dahulu
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Sebelum memuat daftar peminjaman, silakan pilih salah satu instansi
              melalui pemilih instansi di atas.
            </p>
          </Card>
        ) : error ? (
          <ErrorState
            title="Gagal Memuat Peminjaman Office"
            message={error}
            onRetry={() => setReloadKey((k) => k + 1)}
            className="mt-6"
          />
        ) : (
          <>
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
                      disabled={Boolean(error) || tableLoading || !selectedCompanyId}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                        savedTotalRef.current = 0;
                      }}
                      placeholder="Cari nomor peminjaman, anggota, buku, petugas... (tekan /)"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={openFilter}
                    disabled={Boolean(error) || tableLoading || !selectedCompanyId}
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
                      {hasActiveFilters && (
                        <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
                      )}
                    </span>
                  </Button>
                </div>
              </Card>

              {/* ACTIVE FILTER CHIPS */}
              {(hasActiveFilters || search.trim() !== "") && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {search.trim() !== "" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setPage(1);
                        savedTotalRef.current = 0;
                      }}
                      className="rounded-full px-3 py-1 text-xs"
                    >
                      <span className="max-w-[220px] truncate">
                        Pencarian: {search}
                      </span>
                      <svg className="ml-1 h-3.5 w-3.5 text-slate-400 hover:text-slate-600 shrink-0 inline" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </Button>
                  )}

                  {status !== "" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setStatus("");
                        setPage(1);
                        savedTotalRef.current = 0;
                      }}
                      className="rounded-full px-3 py-1 text-xs"
                    >
                      Status: {getStatusLabel(status)}
                      <svg className="ml-1 h-3.5 w-3.5 text-slate-400 hover:text-slate-600 shrink-0 inline" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </Button>
                  )}

                  {startDate !== "" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setStartDate("");
                        setPage(1);
                        savedTotalRef.current = 0;
                      }}
                      className="rounded-full px-3 py-1 text-xs"
                    >
                      Pinjam Dari: {formatDate(startDate)}
                      <svg className="ml-1 h-3.5 w-3.5 text-slate-400 hover:text-slate-600 shrink-0 inline" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </Button>
                  )}

                  {endDate !== "" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEndDate("");
                        setPage(1);
                        savedTotalRef.current = 0;
                      }}
                      className="rounded-full px-3 py-1 text-xs"
                    >
                      Pinjam Sampai: {formatDate(endDate)}
                      <svg className="ml-1 h-3.5 w-3.5 text-slate-400 hover:text-slate-600 shrink-0 inline" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </Button>
                  )}

                  {dueFrom !== "" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setDueFrom("");
                        setPage(1);
                        savedTotalRef.current = 0;
                      }}
                      className="rounded-full px-3 py-1 text-xs"
                    >
                      Jatuh Tempo Dari: {formatDate(dueFrom)}
                      <svg className="ml-1 h-3.5 w-3.5 text-slate-400 hover:text-slate-600 shrink-0 inline" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </Button>
                  )}

                  {dueTo !== "" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setDueTo("");
                        setPage(1);
                        savedTotalRef.current = 0;
                      }}
                      className="rounded-full px-3 py-1 text-xs"
                    >
                      Jatuh Tempo Sampai: {formatDate(dueTo)}
                      <svg className="ml-1 h-3.5 w-3.5 text-slate-400 hover:text-slate-600 shrink-0 inline" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </Button>
                  )}

                  {returnedFrom !== "" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setReturnedFrom("");
                        setPage(1);
                        savedTotalRef.current = 0;
                      }}
                      className="rounded-full px-3 py-1 text-xs"
                    >
                      Kembali Dari: {formatDate(returnedFrom)}
                      <svg className="ml-1 h-3.5 w-3.5 text-slate-400 hover:text-slate-600 shrink-0 inline" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </Button>
                  )}

                  {returnedTo !== "" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setReturnedTo("");
                        setPage(1);
                        savedTotalRef.current = 0;
                      }}
                      className="rounded-full px-3 py-1 text-xs"
                    >
                      Kembali Sampai: {formatDate(returnedTo)}
                      <svg className="ml-1 h-3.5 w-3.5 text-slate-400 hover:text-slate-600 shrink-0 inline" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetAllFilters}
                    className="text-slate-500 hover:text-slate-900"
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

            {/* EMPTY STATE */}
            {loans.length === 0 && !tableLoading ? (
              <Card className="mt-5 p-4 sm:p-5">
                <EmptyState
                  title={
                    isFiltered
                      ? "Transaksi tidak ditemukan"
                      : "Belum ada riwayat transaksi"
                  }
                  description={
                    isFiltered
                      ? "Tidak ada transaksi yang cocok dengan kriteria pencarian atau filter yang diterapkan. Coba sesuaikan kata kunci atau atur ulang filter."
                      : "Belum ada transaksi peminjaman yang tercatat di instansi ini."
                  }
                />
              </Card>
            ) : (
              <div className="mt-5">
                <DataTable
                  rows={loans}
                  columns={columns}
                  keyExtractor={(loan) => loan.id}
                  loading={tableLoading}
                  loadingMessage="Memuat data peminjaman..."
                  sortBy={sortBy}
                  order={sortOrder}
                  onSortChange={(k) => toggleSort(k as SortField)}
                  mobileBreakpoint="lg"
                  rowClassName={(loan) =>
                    loan.status === "OVERDUE"
                      ? "border-l-4 border-l-red-500 bg-red-50/35 hover:bg-red-50/60"
                      : "hover:bg-slate-50/70"
                  }
                  renderMobileCard={(loan) => {
                    const isOverdue = loan.status === "OVERDUE";
                    const bookItems =
                      loan.items && loan.items.length > 0
                        ? loan.items
                        : loan.copyIds.map((cid, idx) => ({
                            id: cid,
                            bookTitle: `Salinan Buku #${idx + 1}`,
                            copyCode: cid,
                          }));

                    return (
                      <Card
                        key={loan.id}
                        className={`p-3.5 sm:p-4 shadow-xs transition flex flex-col justify-between ${
                          isOverdue
                            ? "border-l-4 border-l-red-500 border-red-200 bg-red-50/20"
                            : "hover:border-slate-300"
                        }`}
                      >
                        <div>
                          {/* HEADER */}
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="min-w-0 flex-1">
                              <p
                                className="truncate text-sm font-bold tracking-tight text-slate-900 sm:text-base font-mono tabular-nums"
                                title={
                                  loan.rawLoanNumber
                                    ? `ID Sistem: ${loan.rawLoanNumber}`
                                    : loan.loanNumber
                                }
                              >
                                {loan.loanNumber}
                              </p>

                              <p
                                className="mt-0.5 truncate text-xs text-slate-600 sm:text-sm font-medium"
                                title={loan.memberName || "-"}
                              >
                                {loan.memberName ||
                                  (loan.memberNumber
                                    ? `Anggota (${loan.memberNumber})`
                                    : "Anggota")}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <Badge variant={getStatusVariant(loan.status)}>
                                {getStatusLabel(loan.status)}
                              </Badge>
                            </div>
                          </div>

                          {/* BUKU DIPINJAM */}
                          <div className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-xs font-semibold text-slate-500">
                              Buku Dipinjam ({bookItems.length})
                            </p>

                            {bookItems.length === 0 ? (
                              <p className="mt-0.5 text-xs text-slate-900">-</p>
                            ) : (
                              <ul className="mt-1 space-y-0.5 text-xs text-slate-900 sm:text-sm">
                                {bookItems.map((item, idx) => (
                                  <li
                                    key={item.id || idx}
                                    className="break-words"
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="mr-1.5 text-slate-400 select-none"
                                    >
                                      &bull;
                                    </span>
                                    <span className="font-medium text-slate-800">
                                      {item.bookTitle}
                                    </span>
                                    {item.copyCode && (
                                      <span className="ml-1.5 font-mono text-xs text-slate-500">
                                        ({item.copyCode})
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {/* DATES & PETUGAS GRID (2x2 Grid) */}
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5 text-xs">
                          <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 block">
                              Petugas
                            </span>
                            <p
                              className="mt-0.5 truncate font-semibold text-slate-700"
                              title={loan.officerName || "Petugas"}
                            >
                              {loan.officerName || "Petugas"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 block">
                              Pinjam
                            </span>
                            <p
                              className="mt-0.5 truncate font-semibold text-slate-700 tabular-nums"
                              title={formatDate(loan.borrowedAt)}
                            >
                              {formatDate(loan.borrowedAt)}
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 block">
                              Jatuh Tempo
                            </span>
                            <p
                              className={`mt-0.5 truncate font-semibold tabular-nums ${
                                isOverdue
                                  ? "text-red-600 font-bold"
                                  : "text-slate-700"
                              }`}
                              title={formatDate(loan.dueAt)}
                            >
                              {formatDate(loan.dueAt)}
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 block">
                              Pengembalian
                            </span>
                            <p
                              className="mt-0.5 truncate font-semibold text-slate-700 tabular-nums"
                              title={formatDate(loan.returnedAt)}
                            >
                              {formatDate(loan.returnedAt)}
                            </p>
                          </div>
                        </div>

                        {/* AKSI BARIS (TITIK 3 / ROWACTIONS) */}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                          <span className="text-xs font-medium text-slate-500">
                            Pilihan Aksi
                          </span>
                          <RowActions
                            actions={[
                              {
                                label: "Detail",
                                onClick: () => setSelectedLoan(loan),
                                icon: (
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    aria-hidden="true"
                                  >
                                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                ),
                              },
                              {
                                label: "Lihat Anggota",
                                href: "/office/members",
                                icon: (
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    aria-hidden="true"
                                  >
                                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                  </svg>
                                ),
                              },
                            ]}
                          />
                        </div>
                      </Card>
                    );
                  }}
                />

                {/* PAGINATION */}
                {total > 0 && (
                  <div className="mt-4">
                    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs">
                      <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={total}
                        pageSize={pageSize}
                        pageSizeOptions={[5, 10, 20, 50, 100]}
                        onPageChange={setPage}
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
          </>
        )}

        {/* FILTER DRAWER (SLIDE-OVER DARI KANAN) */}
        <Modal
          open={isFilterMounted}
          onClose={closeFilter}
          raw
          ariaLabelledBy="filter-title"
          overlayClassName={`fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200 ease-out ${
            isFilterOpen ? "opacity-100" : "opacity-0"
          }`}
          className={`fixed inset-y-0 right-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${
            isFilterOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2
                id="filter-title"
                className="text-lg font-semibold tracking-tight text-slate-900"
              >
                Filter Transaksi
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                Filter berdasarkan rentang tanggal peminjaman dan status.
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeFilter}
              aria-label="Tutup filter"
              className="min-h-[32px] min-w-[32px] p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
              <h3 className="text-sm font-semibold text-slate-900">
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

            <div className="my-6 border-t border-slate-100" />

            {/* RENTANG TANGGAL PEMINJAMAN */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900">
                Rentang Tanggal Pinjam
              </h3>
              <p className="mt-1 text-sm text-slate-500">
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

            <div className="my-6 border-t border-slate-100" />

            {/* RENTANG TANGGAL JATUH TEMPO */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900">
                Rentang Tanggal Jatuh Tempo
              </h3>
              <p className="mt-1 text-sm text-slate-500">
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

            <div className="my-6 border-t border-slate-100" />

            {/* RENTANG TANGGAL PENGEMBALIAN */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900">
                Rentang Tanggal Pengembalian
              </h3>
              <p className="mt-1 text-sm text-slate-500">
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

          <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
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

        {/* MODAL DETAIL INFORMASI PEMINJAMAN */}
        {selectedLoan && (
          <Modal
            open={Boolean(selectedLoan)}
            onClose={() => setSelectedLoan(null)}
            title="Detail Informasi Peminjaman"
            size="lg"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    ID Transaksi (Internal)
                  </label>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-900 break-all">
                    {selectedLoan.id}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">
                    ID Instansi
                  </label>
                  <p className="mt-1 font-mono text-sm text-slate-700 break-all">
                    {selectedLoan.companyId}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Nomor Peminjaman
                  </label>
                  <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                    {selectedLoan.loanNumber}
                  </p>
                  {selectedLoan.rawLoanNumber &&
                    selectedLoan.rawLoanNumber !== selectedLoan.loanNumber && (
                      <p
                        className="mt-1 font-mono text-xs text-slate-500 break-all bg-slate-50 p-1.5 rounded border border-slate-200"
                        title="ID Sistem Internal"
                      >
                        ID Sistem: {selectedLoan.rawLoanNumber}
                      </p>
                    )}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Status Peminjaman
                  </label>
                  <div className="mt-1">
                    <Badge variant={getStatusVariant(selectedLoan.status)}>
                      {getStatusLabel(selectedLoan.status)}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Nama Peminjam
                  </label>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedLoan.memberName ||
                      (selectedLoan.memberNumber
                        ? `Anggota (${selectedLoan.memberNumber})`
                        : "Anggota")}
                  </p>
                  {selectedLoan.memberNumber &&
                    selectedLoan.memberNumber !== "-" && (
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        No. Anggota: {selectedLoan.memberNumber}
                      </p>
                    )}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Petugas Peminjaman
                  </label>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedLoan.officerName || "Petugas"}
                  </p>
                  {selectedLoan.borrowedBy &&
                    selectedLoan.borrowedBy !== "-" && (
                      <p
                        className="text-xs text-slate-500 font-mono mt-0.5"
                        title="ID Akun Petugas"
                      >
                        ID Petugas: {selectedLoan.borrowedBy}
                      </p>
                    )}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">
                    ID Member (Sistem)
                  </label>
                  <p className="mt-1 font-mono text-xs text-slate-600 break-all bg-slate-50 p-2 rounded border border-slate-200">
                    {selectedLoan.memberId}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Tanggal Peminjaman
                  </label>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(selectedLoan.borrowedAt)}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Tanggal Jatuh Tempo
                  </label>
                  <p
                    className={`mt-1 text-sm ${
                      selectedLoan.status === "OVERDUE"
                        ? "font-semibold text-red-600"
                        : "text-slate-700"
                    }`}
                  >
                    {formatDate(selectedLoan.dueAt)}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Tanggal Dikembalikan
                  </label>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(selectedLoan.returnedAt)}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-500">
                    Buku & Salinan Dipinjam (
                    {selectedLoan.items?.length || selectedLoan.copyIds.length}{" "}
                    buku)
                  </label>
                  <div className="mt-1.5 space-y-1.5">
                    {selectedLoan.items && selectedLoan.items.length > 0 ? (
                      selectedLoan.items.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                        >
                          <span className="font-semibold text-slate-900">
                            {item.bookTitle}
                          </span>
                          {item.copyCode && (
                            <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {item.copyCode}
                            </span>
                          )}
                        </div>
                      ))
                    ) : selectedLoan.copyIds.length === 0 ? (
                      <span className="text-sm text-slate-500">-</span>
                    ) : (
                      selectedLoan.copyIds.map((cid, idx) => (
                        <span
                          key={idx}
                          className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 mr-1.5 inline-block"
                        >
                          {cid}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Waktu Dibuat
                  </label>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(selectedLoan.createdAt)}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">
                    Waktu Diperbarui
                  </label>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(selectedLoan.updatedAt)}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
                <Link
                  href="/office/members"
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition flex items-center gap-1"
                >
                  Lihat Profil Anggota
                  <span aria-hidden="true">→</span>
                </Link>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedLoan(null)}
                >
                  Tutup
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

function TransactionIcon() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  );
}

export default function OfficeLoansPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <LoadingState label="Memuat inspeksi peminjaman..." />
        </div>
      }
    >
      <OfficeLoansContent />
    </Suspense>
  );
}
