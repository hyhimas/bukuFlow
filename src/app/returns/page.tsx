"use client";

import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";

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

import { getReturnLoans, returnLoanItems } from "@/lib/mock-api";

import type { ReturnLoanData, Loan } from "@/lib/types";

export default function ReturnsPage() {
  const router = useRouter();

  const detailRef = useRef<HTMLDivElement>(null);
  const successModalCloseRef = useRef<HTMLButtonElement>(null);

  const [loans, setLoans] = useState<ReturnLoanData[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<ReturnLoanData[]>([]);

  const [query, setQuery] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<ReturnLoanData | null>(
    null,
  );

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [returnLoading, setReturnLoading] = useState(false);

  const [error, setError] = useState("");
  const [returnError, setReturnError] = useState("");

  const [successLoan, setSuccessLoan] = useState<Loan | null>(null);
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
    const session = getSession();

    if (!session) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    async function loadLoans() {
      setLoading(true);
      setError("");

      try {
        const result = await getReturnLoans();

        setLoans(result);
        setFilteredLoans(result);
      } catch {
        setError("Transaksi aktif gagal dimuat.");
      } finally {
        setLoading(false);
      }
    }

    void loadLoans();
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
          loan.loanNumber.toLowerCase().includes(keyword) ||
          member.name.toLowerCase().includes(keyword) ||
          items.some(
            (item) =>
              item.book.title.toLowerCase().includes(keyword) ||
              item.bookCopy.code.toLowerCase().includes(keyword),
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
    if (!successLoan) return;

    successModalCloseRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSuccessLoan(null);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => document.removeEventListener("keydown", handleEscape);
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
        return current.filter((id) => id !== itemId);
      }

      return [...current, itemId];
    });
  }

  async function handleReturn() {
    setReturnError("");

    if (!selectedLoan) {
      setReturnError("Transaksi belum dipilih.");
      return;
    }

    if (selectedItemIds.length === 0) {
      setReturnError("Pilih minimal satu buku yang dikembalikan.");
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
          .map(
            ({ book, bookCopy }) =>
              `${book.title} (${bookCopy.code})`,
          ),
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

  function getItemStatusLabel(status: string) {
    return status === "BORROWED" ? "Dipinjam" : "Dikembalikan";
  }

  function getItemStatusVariant(
    status: string,
  ): "success" | "warning" | "danger" | "neutral" {
    return status === "BORROWED" ? "warning" : "success";
  }

  function getOverallStatus(loanData: ReturnLoanData) {
    const items = loanData.items;

    if (items.length === 0) {
      return {
        label: "Selesai",
        variant: "success" as const,
      };
    }

    const borrowedCount = items.filter(
      ({ loanItem }) => loanItem.status === "BORROWED",
    ).length;

    const returnedCount = items.filter(
      ({ loanItem }) => loanItem.status === "RETURNED",
    ).length;

    // Semua buku sudah dikembalikan
    if (borrowedCount === 0) {
      return {
        label: "Selesai",
        variant: "success" as const,
      };
    }

    // Masih ada buku yang dipinjam dan transaksi terlambat
    if (loanData.loan.status === "OVERDUE") {
      return {
        label: "Terlambat",
        variant: "danger" as const,
      };
    }

    // Sebagian buku sudah dikembalikan
    if (returnedCount > 0 && borrowedCount > 0) {
      return {
        label: "Sebagian dikembalikan",
        variant: "neutral" as const,
      };
    }

    return {
      label: "Dipinjam",
      variant: "warning" as const,
    };
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <AppHeader subtitle="Catat Pengembalian" />

        <div className="page-container py-5 sm:py-6">
          <div className="mb-5">
            <BackLink href="/dashboard" />

            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              Pengembalian Buku
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Cari transaksi aktif untuk memproses pengembalian.
            </p>
          </div>

          <Card className="p-6">
            <LoadingState label="Memuat transaksi aktif..." />
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <AppHeader subtitle="Catat Pengembalian" />

      <div className="page-container py-5 sm:py-6">
        <div className="mb-5">
          <BackLink href="/dashboard" />

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Pengembalian Buku
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Cari transaksi aktif untuk memproses pengembalian.
          </p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)] lg:items-start">
          <div className="min-w-0">
            <Card className="p-4 sm:p-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  1. Cari Transaksi
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Cari berdasarkan nomor transaksi, nama anggota, judul buku,
                  atau kode copy.
                </p>
              </div>

              <div className="mt-4">
                <Input
                  id="return-search"
                  label="Cari transaksi"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Contoh: TRX-001, Budi, Laskar Pelangi..."
                />
              </div>

              {error && (
                <FeedbackPanel tone="error" className="mt-4">
                  <p>{error}</p>

                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-3 min-h-10 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    Coba lagi
                  </button>
                </FeedbackPanel>
              )}
            </Card>

            <Card className="mt-5 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    2. Daftar Transaksi
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Pilih transaksi untuk melihat detail pengembalian.
                  </p>
                </div>

                {filteredLoans.length > 0 && (
                  <p className="shrink-0 text-xs text-slate-500">
                    {filteredLoans.length} transaksi
                  </p>
                )}
              </div>

              {!error && filteredLoans.length === 0 && (
                <div className="mt-4">
                  <EmptyState
                    title={
                      query.trim()
                        ? "Transaksi tidak ditemukan"
                        : "Belum ada transaksi aktif"
                    }
                    description={
                      query.trim()
                        ? `Tidak ada transaksi yang sesuai dengan "${query.trim()}". Coba gunakan nomor transaksi, nama anggota, judul buku, atau kode copy lain.`
                        : "Belum ada transaksi aktif yang dapat diproses. Transaksi akan muncul di sini selama masih ada buku yang belum dikembalikan."
                    }
                  />
                </div>
              )}

              {filteredLoans.length > 0 && (
                <div className="mt-4 space-y-2">
                  {filteredLoans.map((item) => {
                    const overallStatus = getOverallStatus(item);

                    return (
                      <button
                        key={item.loan.id}
                        type="button"
                        onClick={() => selectLoan(item)}
                        aria-pressed={selectedLoan?.loan.id === item.loan.id}
                        className={`w-full rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          selectedLoan?.loan.id === item.loan.id
                            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                            : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                        }`}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {item.loan.loanNumber}
                            </p>

                            <p className="mt-1 truncate text-sm text-slate-600">
                              {item.member.name}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {item.items.length} item ·{" "}
                              {formatDate(item.loan.borrowedAt)} →{" "}
                              {formatDate(item.loan.dueAt)}
                            </p>
                          </div>

                          <span className="w-fit max-w-full sm:shrink-0">
                            <Badge variant={overallStatus.variant}>
                              {overallStatus.label}
                            </Badge>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <div
            ref={detailRef}
            className="min-w-0 scroll-mt-5 lg:sticky lg:top-5"
          >
            {selectedLoan ? (
              <Card className="border-blue-200 p-4 sm:p-5">
                {(() => {
                  const overallStatus = getOverallStatus(selectedLoan);

                  const borrowedCount = selectedLoan.items.filter(
                    ({ loanItem }) => loanItem.status === "BORROWED",
                  ).length;

                  const returnedCount = selectedLoan.items.filter(
                    ({ loanItem }) => loanItem.status === "RETURNED",
                  ).length;

                  return (
                    <>
                      <div className="border-b border-slate-200 pb-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          3. Detail Pengembalian
                        </p>

                        <div className="mt-2 flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <h3
                              className="break-words text-xl font-bold leading-tight text-slate-900"
                              title={selectedLoan.loan.loanNumber}
                            >
                              {selectedLoan.loan.loanNumber}
                            </h3>

                            <p
                              className="mt-1 break-words text-sm text-slate-600"
                              title={`${selectedLoan.member.name} · ${selectedLoan.member.memberNumber}`}
                            >
                              {selectedLoan.member.name} ·{" "}
                              {selectedLoan.member.memberNumber}
                            </p>
                          </div>

                          <span className="mt-0.5 shrink-0">
                            <Badge variant={overallStatus.variant}>
                              {overallStatus.label}
                            </Badge>
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">
                            Tanggal pinjam
                          </p>

                          <p className="mt-1 font-semibold text-slate-900">
                            {formatDate(selectedLoan.loan.borrowedAt)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">
                            Jatuh tempo
                          </p>

                          <p className="mt-1 font-semibold text-slate-900">
                            {formatDate(selectedLoan.loan.dueAt)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">
                            Dipinjam
                          </p>

                          <p className="mt-1 font-semibold text-amber-700">
                            {borrowedCount} buku
                          </p>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">
                            Dikembalikan
                          </p>

                          <p className="mt-1 font-semibold text-green-700">
                            {returnedCount} buku
                          </p>
                        </div>
                      </div>

                      <div className="mt-5">
                        <h4 className="font-semibold text-slate-900">
                          Detail buku
                        </h4>

                        <p className="mt-1 text-sm text-slate-500">
                          Pilih buku yang ingin dikembalikan. Buku yang sudah
                          dikembalikan tetap ditampilkan sebagai riwayat status.
                        </p>

                        <div className="mt-3 space-y-2">
                          {selectedLoan.items.map(
                            ({ loanItem, book, bookCopy }) => {
                              const isBorrowed =
                                loanItem.status === "BORROWED";

                              const selected = selectedItemIds.includes(
                                loanItem.id,
                              );

                              return (
                                <label
                                  key={loanItem.id}
                                  className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 transition ${
                                    isBorrowed
                                      ? selected
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-slate-200 bg-white hover:border-blue-300"
                                      : "border-green-200 bg-green-50/40"
                                  } ${
                                    isBorrowed
                                      ? "cursor-pointer"
                                      : "cursor-default"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    disabled={!isBorrowed || returnLoading}
                                    onChange={() => toggleItem(loanItem.id)}
                                    className="h-4 w-4 self-center rounded border-slate-300 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                                  />

                                  <div className="min-w-0 self-center">
                                    <p
                                      className="truncate font-medium leading-tight text-slate-900"
                                      title={book.title}
                                    >
                                      {book.title}
                                    </p>

                                    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                                      <span className="truncate">
                                        {book.code}
                                      </span>

                                      <span aria-hidden="true">·</span>

                                      <span className="shrink-0 font-semibold text-slate-700">
                                        {bookCopy.code}
                                      </span>
                                    </div>
                                  </div>

                                  <span className="flex min-w-[108px] justify-center self-center">
                                    <Badge
                                      variant={getItemStatusVariant(
                                        loanItem.status,
                                      )}
                                    >
                                      {getItemStatusLabel(loanItem.status)}
                                    </Badge>
                                  </span>
                                </label>
                              );
                            },
                          )}
                        </div>
                      </div>

                      {returnError && (
                        <p
                          role="alert"
                          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                        >
                          {returnError}
                        </p>
                      )}

                      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
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

                        <Button
                          type="button"
                          loading={returnLoading}
                          disabled={selectedItemIds.length === 0}
                          onClick={() => setShowConfirmation(true)}
                        >
                          Konfirmasi Pengembalian
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </Card>
            ) : (
              <Card className="min-h-[280px] border-dashed p-5">
                <div className="flex min-h-[240px] items-center justify-center">
                  <EmptyState
                    title="Pilih transaksi"
                    description="Pilih salah satu transaksi di sebelah kiri untuk melihat detail buku dan memproses pengembalian."
                  />
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {successLoan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSuccessLoan(null);
            }
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-success-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700"
                  aria-hidden="true"
                >
                  ✓
                </div>

                <div>
                  <h2
                    id="return-success-title"
                    className="text-lg font-semibold text-slate-900"
                  >
                    Pengembalian berhasil
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Transaksi berhasil diperbarui.
                  </p>
                </div>
              </div>

              <button
                ref={successModalCloseRef}
                type="button"
                aria-label="Tutup pengembalian berhasil"
                onClick={() => setSuccessLoan(null)}
                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span
                  aria-hidden="true"
                  className="text-xl leading-none"
                >
                  ×
                </span>
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div>
                  <p className="text-xs text-slate-500">
                    Nomor transaksi
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {successLoan.loanNumber}
                  </p>
                </div>

                <Badge
                  variant={
                    successLoan.status === "COMPLETED"
                      ? "success"
                      : successLoan.status === "OVERDUE"
                        ? "danger"
                        : "warning"
                  }
                >
                  {successLoan.status === "COMPLETED"
                    ? "Selesai"
                    : successLoan.status === "OVERDUE"
                      ? "Terlambat"
                      : "Aktif"}
                </Badge>
              </div>

              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">
                    Buku/copy dikembalikan
                  </p>

                  <p className="mt-1 font-medium text-slate-900">
                    {returnedCopies.join(", ") || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Tanggal pengembalian
                  </p>

                  <p className="mt-1 font-medium text-slate-900">
                    {formatDate(successLoan.returnedAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
              <Button
                type="button"
                onClick={() => setSuccessLoan(null)}
              >
                Selesai
              </Button>
            </div>
          </div>
        </div>
      )}

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