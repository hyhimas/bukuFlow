"use client";

import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";

import {
  getReturnLoans,
  returnLoanItems,
} from "@/lib/mock-api";

import type { ReturnLoanData, Loan } from "@/lib/types";

export default function ReturnsPage() {
  const [loans, setLoans] = useState<ReturnLoanData[]>([]);
  const [filteredLoans, setFilteredLoans] =
    useState<ReturnLoanData[]>([]);

  const [query, setQuery] = useState("");
  const [selectedLoan, setSelectedLoan] =
    useState<ReturnLoanData | null>(null);

  const [selectedItemIds, setSelectedItemIds] =
    useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [returnLoading, setReturnLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [returnError, setReturnError] =
    useState("");

  const [successLoan, setSuccessLoan] =
    useState<Loan | null>(null);

  useEffect(() => {
    async function loadLoans() {
      setLoading(true);
      setError("");

      try {
        const result = await getReturnLoans();

        setLoans(result);
        setFilteredLoans(result);
      } catch {
        setError(
          "Transaksi aktif gagal dimuat.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadLoans();
  }, []);

  // =====================================================
  // SEARCH TRANSACTION WITH DEBOUNCE
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      const keyword = query.trim().toLowerCase();

      if (!keyword) {
        setFilteredLoans(loans);
        return;
      }

      const result = loans.filter(
        ({ loan, member, items }) =>
          loan.loanNumber
            .toLowerCase()
            .includes(keyword) ||
          member.name
            .toLowerCase()
            .includes(keyword) ||
          items.some((item) =>
            item.book.title
              .toLowerCase()
              .includes(keyword) ||
            item.bookCopy.code
              .toLowerCase()
              .includes(keyword),
          ),
      );

      if (!cancelled) {
        setFilteredLoans(result);
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, loans]);

  function selectLoan(loanData: ReturnLoanData) {
    setSelectedLoan(loanData);
    setSelectedItemIds([]);
    setReturnError("");
    setSuccessLoan(null);
  }

  function toggleItem(itemId: string) {
    setSelectedItemIds((current) => {
      if (current.includes(itemId)) {
        return current.filter(
          (id) => id !== itemId,
        );
      }

      return [...current, itemId];
    });
  }

  async function handleReturn() {
    setReturnError("");

    if (!selectedLoan) {
      setReturnError(
        "Transaksi belum dipilih.",
      );
      return;
    }

    if (selectedItemIds.length === 0) {
      setReturnError(
        "Pilih minimal satu buku yang dikembalikan.",
      );
      return;
    }

    setReturnLoading(true);

    try {
      const loan = await returnLoanItems(
        selectedLoan.loan.id,
        selectedItemIds,
      );

      setSuccessLoan(loan);
      setSelectedItemIds([]);

      const updatedLoans = loans
        .map((item) => {
          if (item.loan.id !== loan.id) {
            return item;
          }

          return {
            ...item,
            loan,
            items: item.items.filter(
              (returnItem) =>
                returnItem.loanItem.status ===
                "BORROWED",
            ),
          };
        })
        .filter(
          (item) =>
            item.loan.status === "ACTIVE" ||
            item.loan.status === "OVERDUE",
        );

      setLoans(updatedLoans);
      setFilteredLoans(updatedLoans);
      setSelectedLoan(null);
    } catch (error) {
      setReturnError(
        error instanceof Error
          ? error.message
          : "Pengembalian gagal diproses.",
      );
    } finally {
      setReturnLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <p className="text-sm text-slate-500">
            Memuat transaksi aktif...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              BukuFlow
            </h1>

            <p className="text-sm text-slate-500">
              Catat Pengembalian
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            Pengembalian Buku
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Cari transaksi aktif untuk memproses pengembalian.
          </p>
        </div>

        {successLoan && (
          <Card className="mb-5 p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Pengembalian Berhasil
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Pengembalian untuk transaksi{" "}
              <span className="font-medium text-slate-900">
                {successLoan.loanNumber}
              </span>{" "}
              berhasil dicatat.
            </p>

            <p className="mt-3 text-sm text-slate-600">
              Status transaksi:{" "}
              <span className="font-semibold">
                {successLoan.status === "COMPLETED"
                  ? "Selesai"
                  : successLoan.status === "OVERDUE"
                    ? "Terlambat"
                    : "Aktif"}
              </span>
            </p>
          </Card>
        )}

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900">
            1. Cari Transaksi Aktif
          </h3>

          <div className="mt-5">
            <Input
              id="return-search"
              label="Transaksi"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Cari nomor transaksi, anggota, buku, atau copy..."
            />
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 text-sm text-red-600"
            >
              {error}
            </p>
          )}

          {!error &&
            filteredLoans.length === 0 && (
              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="font-medium text-slate-800">
                  Tidak ada transaksi aktif
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Semua buku telah dikembalikan atau belum ada transaksi aktif.
                </p>
              </div>
            )}

          {filteredLoans.length > 0 && (
            <div className="mt-5 space-y-3">
              {filteredLoans.map((item) => (
                <button
                  key={item.loan.id}
                  type="button"
                  onClick={() => selectLoan(item)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {item.loan.loanNumber}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {item.member.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {item.items.length} item
                      </p>
                    </div>

                    <Badge
                      variant={
                        item.loan.status ===
                        "OVERDUE"
                          ? "warning"
                          : "success"
                      }
                    >
                      {item.loan.status ===
                      "OVERDUE"
                        ? "Terlambat"
                        : "Aktif"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {selectedLoan && (
          <Card className="mt-5 p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              2. Detail Pengembalian
            </h3>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">
                  Nomor transaksi
                </p>

                <p className="mt-1 font-medium text-slate-900">
                  {selectedLoan.loan.loanNumber}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Anggota
                </p>

                <p className="mt-1 font-medium text-slate-900">
                  {selectedLoan.member.name}
                </p>

                <p className="text-sm text-slate-500">
                  {selectedLoan.member.memberNumber}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Jatuh tempo
                </p>

                <p className="mt-1 font-medium text-slate-900">
                  {new Date(
                    `${selectedLoan.loan.dueAt}T00:00:00`,
                  ).toLocaleDateString("id-ID")}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Status
                </p>

                <div className="mt-1">
                  <Badge
                    variant={
                      selectedLoan.loan.status ===
                      "OVERDUE"
                        ? "warning"
                        : "success"
                    }
                  >
                    {selectedLoan.loan.status ===
                    "OVERDUE"
                      ? "Terlambat"
                      : "Aktif"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-medium text-slate-900">
                Buku yang belum dikembalikan
              </h4>

              {selectedLoan.items.length === 0 ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">
                    Semua buku dalam transaksi sudah dikembalikan.
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {selectedLoan.items.map(
                    ({
                      loanItem,
                      book,
                      bookCopy,
                    }) => {
                      const selected =
                        selectedItemIds.includes(
                          loanItem.id,
                        );

                      return (
                        <label
                          key={loanItem.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${
                            selected
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              toggleItem(
                                loanItem.id,
                              )
                            }
                            className="mt-1 h-4 w-4 rounded border-slate-300 focus:ring-2 focus:ring-blue-500"
                          />

                          <div>
                            <p className="font-medium text-slate-900">
                              {book.title}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              Kode copy:{" "}
                              {bookCopy.code}
                            </p>

                            <p className="mt-1 text-sm text-slate-600">
                              Status:{" "}
                              {loanItem.status ===
                              "BORROWED"
                                ? "Dipinjam"
                                : "Dikembalikan"}
                            </p>
                          </div>
                        </label>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            {returnError && (
              <p
                role="alert"
                className="mt-5 text-sm text-red-600"
              >
                {returnError}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                loading={returnLoading}
                disabled={
                  selectedItemIds.length === 0
                }
                onClick={handleReturn}
              >
                Konfirmasi Pengembalian
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={returnLoading}
                onClick={() => {
                  setSelectedLoan(null);
                  setSelectedItemIds([]);
                  setReturnError("");
                }}
              >
                Batal
              </Button>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
