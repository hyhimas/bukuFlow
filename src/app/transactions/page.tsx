"use client";

import { useEffect, useMemo, useState } from "react";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import AppHeader from "@/components/ui/AppHeader";
import BackLink from "@/components/ui/BackLink";
import EmptyState from "@/components/ui/EmptyState";
import FeedbackPanel from "@/components/ui/FeedbackPanel";
import LoadingState from "@/components/ui/LoadingState";

import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";

import { getTransactions } from "@/lib/mock-api";

import type { Loan, TransactionData } from "@/lib/types";

type TransactionStatus = "ACTIVE" | "OVERDUE" | "COMPLETED";

const PAGE_SIZE = 5;

export default function TransactionsPage() {
  const router = useRouter();

  const [transactions, setTransactions] = useState<TransactionData[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [status, setStatus] = useState<TransactionStatus | "">("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [page, setPage] = useState(1);

  useEffect(() => {
    const session = getSession();

    if (!session) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    async function loadTransactions() {
      setLoading(true);
      setError("");

      try {
        const result = await getTransactions();

        setTransactions(result);
      } catch {
        setError("Riwayat transaksi gagal dimuat.");
      } finally {
        setLoading(false);
      }
    }

    void loadTransactions();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  const filteredTransactions = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    return transactions.filter(({ loan, member, items }) => {
      const matchesSearch =
        keyword === "" ||
        loan.loanNumber.toLowerCase().includes(keyword) ||
        member?.name.toLowerCase().includes(keyword) ||
        items.some(
          ({ book, bookCopy }) =>
            book?.title.toLowerCase().includes(keyword) ||
            bookCopy?.code.toLowerCase().includes(keyword),
        );

      const borrowedDate = getDateOnly(loan.borrowedAt);

      const matchesStatus = status === "" || loan.status === status;

      const dueDate = getDateOnly(loan.dueAt);

      const matchesStartDate =
        startDate === "" || (borrowedDate !== "" && borrowedDate >= startDate);

      const matchesEndDate =
        endDate === "" || (dueDate !== "" && dueDate <= endDate);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesStartDate &&
        matchesEndDate
      );
    });
  }, [transactions, debouncedSearch, status, startDate, endDate]);

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

  function resetFilters() {
    setSearch("");
    setStatus("");
    setStartDate("");
    setEndDate("");
    resetPagination();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <LoadingState label="Memuat riwayat transaksi..." />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <AppHeader subtitle="Riwayat Transaksi" />

      <div className="page-container py-5 sm:py-6">
        {/* HEADER */}
        <div className="mb-5 sm:mb-6">
          <BackLink href="/dashboard" />

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Riwayat Transaksi
          </h1>

          <p className="mt-1 text-sm leading-6 text-slate-500 sm:text-base">
            Lihat riwayat peminjaman dan pengembalian.
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

        {/* FILTER */}
        <Card className="overflow-hidden">
          {/* FILTER HEADER */}
          <div className="px-4 py-4 sm:px-5 sm:py-5 xl:flex xl:items-center xl:justify-between xl:px-6 xl:py-5">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                Filter Transaksi
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Gunakan filter untuk menemukan transaksi dengan lebih cepat.
              </p>
            </div>

            {/* DESKTOP RESET */}
            <div className="hidden xl:block">
              <Button
                type="button"
                variant="secondary"
                onClick={resetFilters}
              >
                Reset Filter
              </Button>
            </div>
          </div>

          {/* FILTER CONTENT */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5 xl:px-6 xl:py-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-5">
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

              <div>
                <label
                  htmlFor="transaction-status"
                  className="block text-sm font-medium text-slate-700"
                >
                  Status
                </label>

                <select
                  id="transaction-status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as TransactionStatus | "");
                    resetPagination();
                  }}
                  className="mt-2 block min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Semua status</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="OVERDUE">Terlambat</option>
                  <option value="COMPLETED">Selesai</option>
                </select>
              </div>

              <Input
                id="transaction-start-date"
                label="Dari tanggal"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  resetPagination();
                }}
              />

              <Input
                id="transaction-end-date"
                label="Sampai tanggal"
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  resetPagination();
                }}
              />
            </div>

            {/* MOBILE + TABLET RESET */}
            <div className="mt-4 flex justify-start md:justify-end xl:hidden">
              <Button
                type="button"
                variant="secondary"
                onClick={resetFilters}
              >
                Reset Filter
              </Button>
            </div>
          </div>
        </Card>

        {/* EMPTY */}
        {filteredTransactions.length === 0 ? (
          <Card className="mt-5 p-4 sm:p-5">
            <EmptyState
              title="Tidak ada transaksi"
              description="Tidak ada transaksi yang sesuai dengan pencarian atau filter."
            />
          </Card>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <Card className="mt-5 hidden overflow-hidden xl:block">
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
                    <th className="px-4 py-4 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Nomor transaksi
                    </th>

                    <th className="px-4 py-4 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Anggota
                    </th>

                    <th className="px-4 py-4 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Buku
                    </th>

                    <th className="px-4 py-4 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Petugas
                    </th>

                    <th className="px-4 py-4 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Peminjaman
                    </th>

                    <th className="px-4 py-4 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Jatuh tempo
                    </th>

                    <th className="px-4 py-4 text-center text-xs font-semibold tracking-wide text-slate-500">
                      Pengembalian
                    </th>

                    <th className="px-5 py-4 text-center text-xs font-semibold tracking-wide text-slate-500">
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
                      <td className="min-w-0 px-4 py-5 align-middle">
                        <p
                          className="truncate whitespace-nowrap font-semibold tracking-tight text-slate-900"
                          title={transaction.loan.loanNumber}
                        >
                          {transaction.loan.loanNumber}
                        </p>
                      </td>

                      {/* ANGGOTA */}
                      <td className="min-w-0 px-4 py-5 align-middle">
                        <p
                          className="truncate text-slate-700"
                          title={transaction.member?.name ?? "-"}
                        >
                          {transaction.member?.name ?? "-"}
                        </p>
                      </td>

                      {/* BUKU */}
                      <td className="min-w-0 px-4 py-5 align-middle">
                        {transaction.items.length === 0 ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <ul className="min-w-0 space-y-1.5">
                            {transaction.items.map(
                              ({ book, bookCopy }) => (
                                <li
                                  key={`${transaction.loan.id}-${book?.id ?? "book"}-${bookCopy?.id ?? "copy"}`}
                                  className="min-w-0 leading-5"
                                >
                                  <span
                                    className="mr-1 text-slate-300"
                                    aria-hidden="true"
                                  >
                                    •
                                  </span>

                                  <span
                                    className="font-medium text-slate-700"
                                    title={book?.title ?? "-"}
                                  >
                                    {book?.title ?? "-"}
                                  </span>

                                  {bookCopy?.code && (
                                    <span className="ml-1 whitespace-nowrap text-slate-400">
                                      ({bookCopy.code})
                                    </span>
                                  )}
                                </li>
                              ),
                            )}
                          </ul>
                        )}
                      </td>

                      {/* PETUGAS */}
                      <td className="min-w-0 px-4 py-5 align-middle">
                        <p
                          className="truncate text-slate-700"
                          title={transaction.user?.name ?? "-"}
                        >
                          {transaction.user?.name ?? "-"}
                        </p>
                      </td>

                      {/* PEMINJAMAN */}
                      <td className="px-4 py-5 text-center align-middle">
                        <span className="whitespace-nowrap text-slate-700">
                          {formatDate(transaction.loan.borrowedAt)}
                        </span>
                      </td>

                      {/* JATUH TEMPO */}
                      <td className="px-4 py-5 text-center align-middle">
                        <span className="whitespace-nowrap text-slate-700">
                          {formatDate(transaction.loan.dueAt)}
                        </span>
                      </td>

                      {/* PENGEMBALIAN */}
                      <td className="px-4 py-5 text-center align-middle">
                        <span className="whitespace-nowrap text-slate-700">
                          {formatDate(transaction.loan.returnedAt)}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-5 py-5 align-middle">
                        <div className="flex justify-center">
                          <div className="flex min-w-[88px] justify-center">
                            <Badge
                              variant={getStatusVariant(
                                transaction.loan.status,
                              )}
                            >
                              {getStatusLabel(transaction.loan.status)}
                            </Badge>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* TABLET + MOBILE */}
            <div className="mt-5 space-y-3 xl:hidden">
              {paginatedTransactions.map((transaction) => (
                <Card
                  key={transaction.loan.id}
                  className="p-4 sm:p-5"
                >
                  {/* TRANSACTION HEADER */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-semibold text-slate-900 sm:text-base"
                        title={transaction.loan.loanNumber}
                      >
                        {transaction.loan.loanNumber}
                      </p>

                      <p
                        className="mt-1 truncate text-sm text-slate-500"
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

                  {/* TRANSACTION DETAILS */}
                  <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm sm:gap-x-6 sm:gap-y-4 md:grid-cols-3">
                    {/* BUKU */}
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">
                        Buku
                      </p>

                      {transaction.items.length === 0 ? (
                        <p className="mt-1 text-slate-900">-</p>
                      ) : (
                        <ul className="mt-1 space-y-1 leading-5 text-slate-900">
                          {transaction.items.map(
                            ({ book, bookCopy }) => (
                              <li
                                key={`${transaction.loan.id}-${book?.id ?? "book"}-${bookCopy?.id ?? "copy"}`}
                                className="break-words"
                              >
                                <span aria-hidden="true">
                                  •{" "}
                                </span>

                                {book?.title ?? "-"}

                                {bookCopy?.code
                                  ? ` (${bookCopy.code})`
                                  : ""}
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                    </div>

                    {/* PETUGAS */}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">
                        Petugas
                      </p>

                      <p
                        className="mt-1 truncate text-slate-900"
                        title={transaction.user?.name ?? "-"}
                      >
                        {transaction.user?.name ?? "-"}
                      </p>
                    </div>

                    {/* PEMINJAMAN */}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">
                        Peminjaman
                      </p>

                      <p className="mt-1 whitespace-nowrap text-slate-900">
                        {formatDate(transaction.loan.borrowedAt)}
                      </p>
                    </div>

                    {/* JATUH TEMPO */}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">
                        Jatuh tempo
                      </p>

                      <p className="mt-1 whitespace-nowrap text-slate-900">
                        {formatDate(transaction.loan.dueAt)}
                      </p>
                    </div>

                    {/* PENGEMBALIAN */}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 sm:text-sm">
                        Pengembalian
                      </p>

                      <p className="mt-1 whitespace-nowrap text-slate-900">
                        {formatDate(transaction.loan.returnedAt)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Halaman {currentPage} dari {totalPages}
                </p>

                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={currentPage === 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                  >
                    Sebelumnya
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(totalPages, current + 1),
                      )
                    }
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}