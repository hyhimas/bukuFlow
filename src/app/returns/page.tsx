"use client";

import { useEffect, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import AppHeader from "@/components/ui/AppHeader";
import BackLink from "@/components/ui/BackLink";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import EmptyState from "@/components/ui/EmptyState";
import FeedbackPanel from "@/components/ui/FeedbackPanel";
import LoadingState from "@/components/ui/LoadingState";

import {
  getReturnLoans,
  returnLoanItems,
} from "@/lib/mock-api";

import type { ReturnLoanData, Loan } from "@/lib/types";

export default function ReturnsPage() {
  const detailRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
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
  const [returnedCopies, setReturnedCopies] = useState<string[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

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

  useEffect(() => {
    if (selectedLoan) {
      detailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [selectedLoan]);

  useEffect(() => {
    if (successLoan) {
      successRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [successLoan]);

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
      setReturnedCopies(
        selectedLoan.items
          .filter(({ loanItem }) => selectedItemIds.includes(loanItem.id))
          .map(({ book, bookCopy }) => `${book.title} (${bookCopy.code})`),
      );
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
        <div className="page-container py-8">
          <LoadingState label="Memuat transaksi aktif..." />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <AppHeader subtitle="Catat Pengembalian" />

      <div className="page-container py-6">
        <div className="mb-6">
          <BackLink href="/dashboard" />
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Pengembalian Buku
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Cari transaksi aktif untuk memproses pengembalian.
          </p>
        </div>

        {successLoan && (
          <div ref={successRef} className="scroll-mt-6">
            <Card role="status" aria-live="polite" className="mb-5 border-green-200 bg-green-50 p-4 sm:p-6">
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

            <div className="mt-4 grid gap-4 border-t border-green-200 pt-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-slate-500">Buku/copy dikembalikan</p>
                <p className="mt-1 font-medium text-slate-900">
                  {returnedCopies.join(", ") || "-"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Tanggal pengembalian</p>
                <p className="mt-1 font-medium text-slate-900">
                  {formatDate(successLoan.returnedAt)}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600">
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
          </div>
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
            <FeedbackPanel tone="error" className="mt-4">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Coba lagi
              </button>
            </FeedbackPanel>
          )}

          {!error &&
            filteredLoans.length === 0 && (
              <div className="mt-5">
                <EmptyState
                  title="Tidak ada transaksi aktif"
                  description="Semua buku telah dikembalikan atau belum ada transaksi aktif."
                />
              </div>
            )}

          {filteredLoans.length > 0 && (
            <div className="mt-5 space-y-3">
              {filteredLoans.map((item) => (
                <button
                  key={item.loan.id}
                  type="button"
                  onClick={() => selectLoan(item)}
                  aria-pressed={selectedLoan?.loan.id === item.loan.id}
                  className={`w-full rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    selectedLoan?.loan.id === item.loan.id
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                      : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                  }`}
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

                    <div className="flex items-center gap-2">
                      {selectedLoan?.loan.id === item.loan.id && (
                        <span className="text-xs font-semibold text-blue-700">Dipilih</span>
                      )}
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
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {selectedLoan && (
          <div ref={detailRef} className="scroll-mt-6">
            <Card className="mt-5 border-blue-200 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Transaksi Dipilih
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
                <p className="text-sm text-slate-500">Jumlah item</p>
                <p className="mt-1 font-medium text-slate-900">
                  {selectedLoan.items.length} item
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Tanggal peminjaman</p>
                <p className="mt-1 font-medium text-slate-900">
                  {formatDate(selectedLoan.loan.borrowedAt)}
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
                  {formatDate(selectedLoan.loan.dueAt)}
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

              <div className="sm:col-span-2">
                <p className="text-sm text-slate-500">
                  Buku/copy terkait
                </p>

                <p className="mt-1 font-medium text-slate-900">
                  {selectedLoan.items
                    .map(({ book, bookCopy }) =>
                      `${book.title} (${bookCopy.code})`,
                    )
                    .join(", ")}
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Detail Pengembalian
              </h3>
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
                onClick={() => setShowConfirmation(true)}
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
          </div>
        )}
      </div>
      <ConfirmationDialog
        open={showConfirmation}
        title="Konfirmasi pengembalian"
        description={`Anda akan mencatat pengembalian ${selectedItemIds.length} copy buku. Pastikan copy yang dipilih sudah sesuai.`}
        confirmLabel="Ya, catat pengembalian"
        onClose={() => setShowConfirmation(false)}
        onConfirm={() => {
          setShowConfirmation(false);
          void handleReturn();
        }}
      />
    </main>
  );
}
