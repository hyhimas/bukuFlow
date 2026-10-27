"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import { canAccessLoans } from "@/lib/authorization";
import { listLoansApi, getErrorMessage } from "@/lib/api";

import type { Loan, TransactionData } from "@/lib/types";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Input from "@/components/ui/Input";
import LoadingState from "@/components/ui/LoadingState";
import Pagination from "@/components/ui/Pagination";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import { useSearchHotkey } from "@/hooks/useHotkeys";

function LoansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams?.get("search") || "";
  const urlLoanId = searchParams?.get("loanId") || "";

  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<TransactionData | null>(
    null
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchHotkey(searchInputRef);

  const [search, setSearch] = useState(() => urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(() => urlSearch);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const savedTotalRef = useRef(0);
  const [error, setError] = useState("");

  /*
   * =========================================================
   * DEBOUNCE SEARCH
   * =========================================================
   */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    const s = searchParams?.get("search");
    if (s !== null && s !== undefined && s !== search) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sinkronisasi kata kunci pencarian dari URL searchParams
      setSearch(s);
      setDebouncedSearch(s);
      setPage(1);
    }
  }, [searchParams]);

  /*
   * =========================================================
   * SESSION / ROLE GUARD
   * =========================================================
   */

  useEffect(() => {
    const session = getSession();

    if (!session) {
      if (!isStoredSessionExpired() && !hasStoredAuth()) {
        router.replace("/login");
      }
      return;
    }

    if (session.user.role === "STAFF") {
      router.replace("/loans/new");
      return;
    }

    if (!canAccessLoans(session.user.role)) {
      router.replace("/dashboard");
      return;
    }
  }, [router]);

  /*
   * =========================================================
   * LOAD DATA (SERVER-SIDE)
   * =========================================================
   */

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await listLoansApi({
        page,
        size: pageSize,
        search: debouncedSearch.trim() || undefined,
        loan_id: (urlLoanId && !debouncedSearch ? urlLoanId : undefined),
        status: ["ACTIVE", "OVERDUE"],
      });

      setTransactions(result.items);
      if (result.items.length > 0 && (urlLoanId || debouncedSearch.trim())) {
        setSelectedLoan(result.items[0]);
      }
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
        getErrorMessage(err, "Daftar peminjaman gagal dimuat.")
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch data transaksi peminjaman saat mount dan parameter berubah
    void loadTransactions();
  }, [loadTransactions]);

  /*
   * =========================================================
   * DATE
   * =========================================================
   */

  function formatDate(value?: string) {
    if (!value) {
      return "-";
    }

    const date = new Date(`${value.slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  /*
   * =========================================================
   * STATUS
   * =========================================================
   */

  function getStatusLabel(status: Loan["status"]) {
    if (status === "ACTIVE") {
      return "Aktif";
    }

    if (status === "OVERDUE") {
      return "Terlambat";
    }

    if (status === "COMPLETED") {
      return "Selesai";
    }

    if (status === "CANCELLED") {
      return "Dibatalkan";
    }

    return status;
  }

  function getStatusVariant(status: Loan["status"]) {
    if (status === "OVERDUE") {
      return "danger" as const;
    }

    if (status === "COMPLETED") {
      return "success" as const;
    }

    if (status === "CANCELLED") {
      return "neutral" as const;
    }

    return "neutral" as const;
  }

  /*
   * =========================================================
   * SELECT TRANSACTION
   * =========================================================
   */

  function selectLoan(transaction: TransactionData) {
    setSelectedLoan(transaction);
    setSearch("");
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */



  /*
   * =========================================================
   * PAGE
   * =========================================================
   */

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="page-container py-5 sm:py-6">
        {/* HEADER */}
        <div className="mb-5 sm:mb-6">
          <PageHeader
            backLink="/dashboard"
            title="Peminjaman Buku"
            description="Lihat daftar dan detail peminjaman buku aktif."
          />
        </div>

        {/* ERROR vs CONTENT */}
        {error ? (
          <ErrorState
            title="Gagal Memuat Peminjaman"
            message={error}
            onRetry={() => void loadTransactions()}
            className="mb-5"
          />
        ) : (
          <>
            {/* SEARCH */}
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-text-main sm:text-lg">
              Daftar Peminjaman
            </h2>

            <p className="text-sm leading-5 text-text-muted">
              Cari berdasarkan nomor peminjaman, anggota, judul buku, atau kode
              eksemplar.
            </p>
          </div>

          <div className="relative mt-4">
            <Input
              ref={searchInputRef}
              id="loan-search"
              label="Pencarian"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Contoh: TRX-001, Budi, Laskar Pelangi... (tekan /)"
            />

            {/* MOBILE SEARCH DROPDOWN (Tampil saat user mencari di mobile) */}
            {search.trim() && (
              <div className="md:hidden">
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
                  {transactions.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto p-2">
                      {transactions.map((transaction) => (
                        <Button
                          key={transaction.loan.id}
                          type="button"
                          variant="ghost"
                          onClick={() => selectLoan(transaction)}
                          className="w-full h-auto rounded-lg p-3 justify-start text-left font-normal hover:bg-surface-subtle"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-text-main">
                                {transaction.loan.loanNumber}
                              </p>

                              <p className="mt-1 truncate text-sm text-text-secondary">
                                {transaction.member?.name ?? "-"}
                              </p>

                              <p className="mt-1 text-xs text-text-muted">
                                {transaction.items.length} buku
                                <span className="mx-1 select-none text-text-subtle" aria-hidden="true">&bull;</span>
                                {formatDate(transaction.loan.borrowedAt)}
                                <span className="mx-1 select-none text-text-subtle" aria-hidden="true">&rarr;</span>
                                {formatDate(transaction.loan.dueAt)}
                              </p>
                            </div>

                            <Badge
                              variant={getStatusVariant(
                                transaction.loan.status
                              )}
                            >
                              {getStatusLabel(transaction.loan.status)}
                            </Badge>
                          </div>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4">
                      <p className="text-sm font-medium text-text-main">
                        Peminjaman tidak ditemukan
                      </p>

                      <p className="mt-1 text-sm text-text-muted">
                        Tidak ada peminjaman yang sesuai dengan &ldquo;{search.trim()}&rdquo;.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* SKELETON LOADING / EMPTY STATE */}
        {loading && transactions.length === 0 ? (
          <div className="mt-5 grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
            <Card className="p-4 sm:p-5 space-y-3">
              <Skeleton className="h-6 w-32" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              ))}
            </Card>
            <div className="hidden md:block">
              <Card className="p-5 space-y-4">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </Card>
            </div>
          </div>
        ) : transactions.length === 0 && !selectedLoan ? (
          <Card className="mt-5 p-4 sm:p-5">
            <EmptyState
              title={
                search.trim()
                  ? "Peminjaman tidak ditemukan"
                  : "Belum ada peminjaman"
              }
              description={
                search.trim()
                  ? `Tidak ada peminjaman yang sesuai dengan "${search.trim()}".`
                  : "Belum ada data peminjaman aktif yang dapat ditampilkan."
              }
            />
          </Card>
        ) : (
          <div className="mt-5">
            {/* MOBILE DETAIL */}
            {selectedLoan && (
              <div className="md:hidden">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedLoan(null)}
                  className="mb-4"
                >
                  <svg className="h-4 w-4 shrink-0 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  <span>Kembali ke daftar</span>
                </Button>

                <LoanDetail
                  transaction={selectedLoan}
                  formatDate={formatDate}
                  getStatusLabel={getStatusLabel}
                  getStatusVariant={getStatusVariant}
                />
              </div>
            )}

            {/* TABLET + DESKTOP (Split view) */}
            <div
              className={[
                "grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]",
                "md:items-start",
                selectedLoan ? "hidden md:grid" : "grid",
              ].join(" ")}
            >
              {/* LIST */}
              <section className="min-w-0">
                <Card className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-text-main">
                        Peminjaman
                      </h2>

                      <p className="mt-1 text-sm text-text-muted">
                        Pilih peminjaman untuk melihat detail.
                      </p>
                    </div>

                    <span className="shrink-0 text-xs text-text-muted sm:text-sm">
                      {totalItems > 0 ? `${totalItems} peminjaman` : `${transactions.length} peminjaman`}
                    </span>
                  </div>

                  {transactions.length > 0 ? (
                    <div className="mt-4 space-y-2.5">
                      {transactions.map((transaction) => {
                        const isSelected =
                          selectedLoan?.loan.id === transaction.loan.id;

                        return (
                          <div
                            key={transaction.loan.id}
                            className={[
                              "rounded-xl border transition",
                              isSelected
                                ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-200"
                                : "border-border bg-surface hover:border-blue-300 hover:bg-blue-50/40",
                            ].join(" ")}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => selectLoan(transaction)}
                              aria-pressed={isSelected}
                              className="w-full h-auto p-3.5 justify-start text-left font-normal"
                            >
                              <div className="w-full">
                                <div className="flex items-start justify-between gap-3">
                                  <p
                                    className="truncate font-mono font-semibold text-text-main"
                                    title={transaction.loan.loanNumber}
                                  >
                                    {transaction.loan.loanNumber}
                                  </p>

                                  <Badge
                                    variant={getStatusVariant(
                                      transaction.loan.status
                                    )}
                                    className="shrink-0"
                                  >
                                    {getStatusLabel(transaction.loan.status)}
                                  </Badge>
                                </div>

                                <p
                                  className="mt-1 truncate text-sm font-medium text-text-secondary"
                                  title={transaction.member?.name ?? "-"}
                                >
                                  {transaction.member?.name ?? "-"}
                                </p>

                                <p className="mt-1 text-xs text-text-muted sm:text-sm">
                                  {transaction.items.length} buku
                                  <span className="mx-1 select-none text-text-subtle" aria-hidden="true">&bull;</span>
                                  {formatDate(transaction.loan.borrowedAt)}
                                  <span className="mx-1 select-none text-text-subtle" aria-hidden="true">&rarr;</span>
                                  {formatDate(transaction.loan.dueAt)}
                                </p>
                              </div>
                            </Button>

                            {/* AKSI BARIS: LIHAT ANGGOTA */}
                            <div className="flex items-center justify-end gap-2 border-t border-border-subtle bg-surface-subtle/40 px-3 py-2 text-xs">
                              <Link
                                href="/master/members"
                                className="font-medium text-text-secondary hover:text-text-main transition flex items-center gap-1"
                              >
                                Lihat Anggota
                                <span aria-hidden="true">→</span>
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <EmptyState
                        title="Peminjaman tidak ditemukan"
                        description={
                          search.trim()
                            ? `Tidak ada peminjaman yang sesuai dengan "${search.trim()}".`
                            : "Belum ada data peminjaman yang dapat ditampilkan."
                        }
                      />
                    </div>
                  )}

                  {/* PAGINATION */}
                  <div className="-mx-4 -mb-4 sm:-mx-5 sm:-mb-5 mt-4">
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
                    />
                  </div>
                </Card>
              </section>

              {/* DETAIL */}
              <section className="min-w-0 md:sticky md:top-20 md:self-start">
                {selectedLoan ? (
                  <LoanDetail
                    transaction={selectedLoan}
                    formatDate={formatDate}
                    getStatusLabel={getStatusLabel}
                    getStatusVariant={getStatusVariant}
                  />
                ) : (
                  <Card className="min-h-[280px] border-dashed p-5">
                    <div className="flex min-h-[240px] items-center justify-center">
                      <EmptyState
                        title="Pilih peminjaman"
                        description="Pilih salah satu peminjaman di sebelah kiri untuk melihat detail."
                      />
                    </div>
                  </Card>
                )}
              </section>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}

/*
 * =========================================================
 * LOAN DETAIL
 * =========================================================
 */

interface LoanDetailProps {
  transaction: TransactionData;
  formatDate: (value?: string) => string;
  getStatusLabel: (status: Loan["status"]) => string;
  getStatusVariant: (
    status: Loan["status"]
  ) => "danger" | "success" | "warning" | "neutral";
}

function LoanDetail({
  transaction,
  formatDate,
  getStatusLabel,
  getStatusVariant,
}: LoanDetailProps) {
  const { loan, member, user, items } = transaction;

  return (
    <Card className="overflow-hidden p-4 sm:p-5">
      {/* DETAIL HEADER */}
      <div className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Nomor Peminjaman
            </p>

            <h2 className="mt-1 break-all text-lg font-bold text-text-main sm:text-xl">
              {loan.loanNumber}
            </h2>
          </div>

          <Badge variant={getStatusVariant(loan.status)}>
            {getStatusLabel(loan.status)}
          </Badge>
        </div>
      </div>

      {/* MEMBER */}
      <div className="border-b border-border py-4">
        <h3 className="text-sm font-semibold text-text-main">
          Informasi Anggota
        </h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <DetailItem label="Nama" value={member?.name ?? "-"} />
          <DetailItem label="Email" value={member?.email ?? "-"} />
          <DetailItem
            label="Nomor Anggota"
            value={member?.memberNumber ?? "-"}
          />
          <DetailItem label="Dicatat oleh" value={user?.name ?? "-"} />
        </div>
      </div>

      {/* LOAN INFO */}
      <div className="border-b border-border py-4">
        <h3 className="text-sm font-semibold text-text-main">
          Informasi Peminjaman
        </h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <DetailItem
            label="Tanggal Pinjam"
            value={formatDate(loan.borrowedAt)}
          />
          <DetailItem label="Jatuh Tempo" value={formatDate(loan.dueAt)} />
        </div>
      </div>

      {/* BOOKS */}
      <div className="pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-text-main">
            Buku yang Dipinjam
          </h3>

          <span className="text-xs text-text-muted sm:text-sm">
            {items.length} buku
          </span>
        </div>

        <div className="mt-3 space-y-3">
          {items.map(({ loanItem, book, bookCopy }) => (
            <div
              key={loanItem.id}
              className="rounded-xl border border-border bg-surface-subtle p-3"
            >
              <p className="font-semibold text-text-main">
                {book?.title ?? "-"}
              </p>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <DetailItem label="Kode Buku" value={book?.code ?? "-"} />
                <DetailItem label="Kode Eksemplar" value={bookCopy?.code ?? "-"} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ACTION FOOTER */}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
        <Link
          href="/master/members"
          className="text-xs font-semibold text-text-secondary hover:text-text-main transition flex items-center gap-1"
        >
          Lihat Profil Anggota
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </Card>
  );
}

/*
 * =========================================================
 * DETAIL ITEM
 * =========================================================
 */

interface DetailItemProps {
  label: string;
  value: string;
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-text-muted">{label}</p>

      <p className="mt-0.5 break-words text-sm font-medium text-text-main">
        {value}
      </p>
    </div>
  );
}


export default function LoansPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-subtle">
          <LoadingState label="Memuat peminjaman..." />
        </div>
      }
    >
      <LoansContent />
    </Suspense>
  );
}
