"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getSession } from "@/lib/auth";
import { getTransactions } from "@/lib/mock-api";

import type { Loan, TransactionData } from "@/lib/types";

import Badge from "@/components/ui/Badge";
import BackLink from "@/components/ui/BackLink";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FeedbackPanel from "@/components/ui/FeedbackPanel";
import Input from "@/components/ui/Input";
import LoadingState from "@/components/ui/LoadingState";

export default function LoansPage() {
  const router = useRouter();

  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [selectedLoan, setSelectedLoan] =
    useState<TransactionData | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * =========================================================
   * SESSION / ROLE GUARD
   * =========================================================
   */

  useEffect(() => {
    const session = getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    if (session.user.role === "STAFF") {
      router.replace("/loans/new");
      return;
    }

    if (session.user.role !== "COMPANY_ADMIN") {
      router.replace("/dashboard");
      return;
    }
  }, [router]);

  /*
   * =========================================================
   * LOAD DATA
   * =========================================================
   */

  useEffect(() => {
    async function loadTransactions() {
      setLoading(true);
      setError("");

      try {
        const result = await getTransactions();
        setTransactions(result);
      } catch {
        setError("Daftar peminjaman gagal dimuat.");
      } finally {
        setLoading(false);
      }
    }

    void loadTransactions();
  }, []);

  /*
   * =========================================================
   * SEARCH
   * =========================================================
   */

  const filteredTransactions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return transactions;
    }

    return transactions.filter(({ loan, member, items }) => {
      const matchesLoanNumber = loan.loanNumber
        .toLowerCase()
        .includes(keyword);

      const matchesMember = member?.name
        .toLowerCase()
        .includes(keyword);

      const matchesBook = items.some(
        ({ book, bookCopy }) =>
          book?.title.toLowerCase().includes(keyword) ||
          bookCopy?.code.toLowerCase().includes(keyword),
      );

      return matchesLoanNumber || matchesMember || matchesBook;
    });
  }, [transactions, search]);

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

    return status;
  }

  function getStatusVariant(status: Loan["status"]) {
    if (status === "OVERDUE") {
      return "danger" as const;
    }

    if (status === "COMPLETED") {
      return "success" as const;
    }

    return "warning" as const;
  }

  /*
   * =========================================================
   * SELECT TRANSACTION
   * =========================================================
   */

  function selectLoan(transaction: TransactionData) {
    setSelectedLoan(transaction);

    // Setelah transaksi dipilih, kosongkan pencarian.
    setSearch("");
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <LoadingState label="Memuat daftar peminjaman..." />
      </main>
    );
  }

  /*
   * =========================================================
   * PAGE
   * =========================================================
   */

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="page-container py-5 sm:py-6">
        {/* HEADER */}

        <div className="mb-5 sm:mb-6">
          <BackLink href="/dashboard" />

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Peminjaman Buku
          </h1>

          <p className="mt-1 text-sm leading-6 text-slate-500 sm:text-base">
            Lihat daftar dan detail transaksi peminjaman buku.
          </p>
        </div>

        {/* ERROR */}

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

        {/* SEARCH */}

        <Card className="relative z-20 p-4 sm:p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
              Daftar Peminjaman
            </h2>

            <p className="text-sm leading-5 text-slate-500">
              Cari berdasarkan nomor transaksi, anggota, judul buku, atau kode
              copy.
            </p>
          </div>

          <div className="relative mt-4">
            <Input
              id="loan-search"
              label="Pencarian"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Contoh: TRX-001, Budi, Laskar Pelangi..."
            />

            {/* =================================================
                MOBILE SEARCH DROPDOWN
                Hanya muncul:
                1. Pada mobile
                2. Setelah transaksi dipilih
                3. Ketika user mengetik pencarian baru
            ================================================== */}

            {selectedLoan && search.trim() && (
              <div className="md:hidden">
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {filteredTransactions.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto p-2">
                      {filteredTransactions.map((transaction) => (
                        <button
                          key={transaction.loan.id}
                          type="button"
                          onClick={() => selectLoan(transaction)}
                          className="w-full rounded-lg p-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {transaction.loan.loanNumber}
                              </p>

                              <p className="mt-1 truncate text-sm text-slate-600">
                                {transaction.member?.name ?? "-"}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {transaction.items.length} buku
                                <span className="mx-1">·</span>
                                {formatDate(transaction.loan.borrowedAt)}
                                <span className="mx-1">→</span>
                                {formatDate(transaction.loan.dueAt)}
                              </p>
                            </div>

                            <Badge
                              variant={getStatusVariant(
                                transaction.loan.status,
                              )}
                            >
                              {getStatusLabel(transaction.loan.status)}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4">
                      <p className="text-sm font-medium text-slate-900">
                        Peminjaman tidak ditemukan
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Tidak ada transaksi yang sesuai dengan "
                        {search.trim()}".
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* =====================================================
            EMPTY STATE
        ====================================================== */}

        {!error && filteredTransactions.length === 0 && !selectedLoan ? (
          <Card className="mt-5 p-4 sm:p-5">
            <EmptyState
              title={
                search.trim()
                  ? "Peminjaman tidak ditemukan"
                  : "Belum ada peminjaman"
              }
              description={
                search.trim()
                  ? `Tidak ada transaksi yang sesuai dengan "${search.trim()}".`
                  : "Belum ada data peminjaman yang dapat ditampilkan."
              }
            />
          </Card>
        ) : (
          <div className="mt-5">
            {/* =================================================
                MOBILE DETAIL
                Hanya muncul di mobile ketika transaksi dipilih.
            ================================================== */}

            {selectedLoan && (
              <div className="md:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedLoan(null)}
                  className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <span aria-hidden="true">←</span>
                  <span>Kembali ke daftar</span>
                </button>

                <LoanDetail
                  transaction={selectedLoan}
                  formatDate={formatDate}
                  getStatusLabel={getStatusLabel}
                  getStatusVariant={getStatusVariant}
                />
              </div>
            )}

            {/* =================================================
                TABLET + DESKTOP
                List kiri + detail kanan.
                Tidak menggunakan dropdown search.
            ================================================== */}

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
                      <h2 className="text-lg font-semibold text-slate-900">
                        Peminjaman
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Pilih transaksi untuk melihat detail.
                      </p>
                    </div>

                    <span className="shrink-0 text-xs text-slate-500 sm:text-sm">
                      {filteredTransactions.length} transaksi
                    </span>
                  </div>

                  {filteredTransactions.length > 0 ? (
                    <div className="mt-4 space-y-2.5">
                      {filteredTransactions.map((transaction) => {
                        const isSelected =
                          selectedLoan?.loan.id === transaction.loan.id;

                        return (
                          <button
                            key={transaction.loan.id}
                            type="button"
                            onClick={() => selectLoan(transaction)}
                            aria-pressed={isSelected}
                            className={[
                              "w-full rounded-xl border p-3 text-left transition",
                              "focus:outline-none focus-visible:ring-2",
                              "focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                              isSelected
                                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                                : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50",
                            ].join(" ")}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <p
                                  className="truncate font-semibold text-slate-900"
                                  title={transaction.loan.loanNumber}
                                >
                                  {transaction.loan.loanNumber}
                                </p>

                                <p
                                  className="mt-1 truncate text-sm text-slate-600"
                                  title={transaction.member?.name ?? "-"}
                                >
                                  {transaction.member?.name ?? "-"}
                                </p>

                                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                                  {transaction.items.length} buku
                                  <span className="mx-1">·</span>
                                  {formatDate(transaction.loan.borrowedAt)}
                                  <span className="mx-1">→</span>
                                  {formatDate(transaction.loan.dueAt)}
                                </p>
                              </div>

                              <span className="w-fit max-w-full shrink-0">
                                <Badge
                                  variant={getStatusVariant(
                                    transaction.loan.status,
                                  )}
                                >
                                  {getStatusLabel(transaction.loan.status)}
                                </Badge>
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <EmptyState
                        title="Peminjaman tidak ditemukan"
                        description={
                          search.trim()
                            ? `Tidak ada transaksi yang sesuai dengan "${search.trim()}".`
                            : "Belum ada data peminjaman yang dapat ditampilkan."
                        }
                      />
                    </div>
                  )}
                </Card>
              </section>

              {/* DETAIL */}

              <section className="min-w-0 md:sticky md:top-5">
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
                        description="Pilih salah satu transaksi di sebelah kiri untuk melihat detail peminjaman."
                      />
                    </div>
                  </Card>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
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
    status: Loan["status"],
  ) => "danger" | "success" | "warning";
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

      <div className="border-b border-slate-200 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Nomor Peminjaman
            </p>

            <h2 className="mt-1 break-all text-lg font-bold text-slate-900 sm:text-xl">
              {loan.loanNumber}
            </h2>
          </div>

          <Badge variant={getStatusVariant(loan.status)}>
            {getStatusLabel(loan.status)}
          </Badge>
        </div>
      </div>

      {/* MEMBER */}

      <div className="border-b border-slate-200 py-4">
        <h3 className="text-sm font-semibold text-slate-900">
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

      <div className="border-b border-slate-200 py-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Informasi Peminjaman
        </h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <DetailItem
            label="Tanggal Pinjam"
            value={formatDate(loan.borrowedAt)}
          />

          <DetailItem
            label="Jatuh Tempo"
            value={formatDate(loan.dueAt)}
          />
        </div>
      </div>

      {/* BOOKS */}

      <div className="pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Buku yang Dipinjam
          </h3>

          <span className="text-xs text-slate-500 sm:text-sm">
            {items.length} buku
          </span>
        </div>

        <div className="mt-3 space-y-3">
          {items.map(({ loanItem, book, bookCopy }) => (
            <div
              key={loanItem.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <p className="font-semibold text-slate-900">
                {book?.title ?? "-"}
              </p>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <DetailItem
                  label="Kode Buku"
                  value={book?.code ?? "-"}
                />

                <DetailItem
                  label="Kode Copy"
                  value={bookCopy?.code ?? "-"}
                />

                <DetailItem
                  label="Status"
                  value={loanItem.status ?? "-"}
                />

                <DetailItem
                  label="Dikembalikan"
                  value={formatDate(loanItem.returnedAt)}
                />
              </div>
            </div>
          ))}
        </div>
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
      <p className="text-xs text-slate-500">{label}</p>

      <p className="mt-0.5 break-words text-sm font-medium text-slate-900">
        {value}
      </p>
    </div>
  );
}