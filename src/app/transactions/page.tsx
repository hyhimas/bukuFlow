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

import { getTransactions } from "@/lib/mock-api";

import type { Loan, TransactionData } from "@/lib/types";

type TransactionStatus = "ACTIVE" | "OVERDUE" | "COMPLETED";

const PAGE_SIZE = 5;

export default function TransactionsPage() {
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

    loadTransactions();
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
        matchesSearch && matchesStatus && matchesStartDate && matchesEndDate
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
      return "warning" as const;
    }

    if (loanStatus === "COMPLETED") {
      return "success" as const;
    }

    return "neutral" as const;
  }

  function getBookList(transaction: TransactionData) {
    if (transaction.items.length === 0) {
      return "-";
    }

    return transaction.items
      .map(({ book, bookCopy }) => {
        if (!book) {
          return "-";
        }

        if (!bookCopy) {
          return book.title;
        }

        return `${book.title} (${bookCopy.code})`;
      })
      .join(", ");
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
        <div className="page-container py-8">
          <Card className="p-6">
            <LoadingState label="Memuat riwayat transaksi..." />
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <AppHeader subtitle="Riwayat Transaksi" />

      <div className="page-container py-6">
        <div className="mb-6">
          <BackLink href="/dashboard" />
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Riwayat Transaksi
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Lihat riwayat peminjaman dan pengembalian.
          </p>
        </div>

        {error && (
          <FeedbackPanel tone="error" className="mb-5">
            <div>
              <p>{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 min-h-11 rounded-lg border border-red-300 px-4 py-2 font-semibold transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Coba lagi
              </button>
            </div>
          </FeedbackPanel>
        )}

        <Card className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Filter Transaksi
          </h3>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
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

          <div className="mt-4 flex justify-start md:justify-end">
            <Button type="button" variant="secondary" onClick={resetFilters}>
              Reset Filter
            </Button>
          </div>
        </Card>

        {filteredTransactions.length === 0 ? (
          <Card className="mt-5 p-4">
            <EmptyState
              title="Tidak ada transaksi"
              description="Tidak ada transaksi yang sesuai dengan pencarian atau filter."
            />
          </Card>
        ) : (
          <>
            <Card className="mt-5 hidden overflow-hidden xl:block">
              <div>
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                        Nomor transaksi
                      </th>

                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                        Anggota
                      </th>

                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Buku
                      </th>

                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                        Petugas
                      </th>

                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                        Peminjaman
                      </th>

                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                        Jatuh tempo
                      </th>

                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                        Pengembalian
                      </th>

                      <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {paginatedTransactions.map((transaction) => (
                      <tr key={transaction.loan.id} className="bg-white">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {transaction.loan.loanNumber}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {transaction.member?.name ?? "-"}
                        </td>

                        <td className="max-w-xs px-4 py-3 leading-5 text-slate-700">
                          {getBookList(transaction)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {transaction.user?.name ?? "-"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatDate(transaction.loan.borrowedAt)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatDate(transaction.loan.dueAt)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatDate(transaction.loan.returnedAt)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge
                            variant={getStatusVariant(transaction.loan.status)}
                          >
                            {getStatusLabel(transaction.loan.status)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="mt-5 space-y-4 xl:hidden">
              {paginatedTransactions.map((transaction) => (
                <Card key={transaction.loan.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {transaction.loan.loanNumber}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {transaction.member?.name ?? "-"}
                      </p>
                    </div>

                    <Badge variant={getStatusVariant(transaction.loan.status)}>
                      {getStatusLabel(transaction.loan.status)}
                    </Badge>
                  </div>

                  <div className="mt-5 space-y-4 text-sm">
                    <div>
                      <p className="text-slate-500">Buku</p>

                      <p className="mt-1 text-slate-900">
                        {getBookList(transaction)}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">Petugas</p>

                      <p className="mt-1 text-slate-900">
                        {transaction.user?.name ?? "-"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-slate-500">Peminjaman</p>

                        <p className="mt-1 text-slate-900">
                          {formatDate(transaction.loan.borrowedAt)}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500">Jatuh tempo</p>

                        <p className="mt-1 text-slate-900">
                          {formatDate(transaction.loan.dueAt)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-slate-500">Pengembalian</p>

                      <p className="mt-1 text-slate-900">
                        {formatDate(transaction.loan.returnedAt)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Halaman {currentPage} dari {totalPages}
                </p>

                <div className="flex gap-2">
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
                      setPage((current) => Math.min(totalPages, current + 1))
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
