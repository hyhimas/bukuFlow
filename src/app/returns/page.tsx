"use client";

import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessReturns, canManageReturns } from "@/lib/authorization";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import BackLink from "@/components/ui/BackLink";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import EmptyState from "@/components/ui/EmptyState";
import FeedbackPanel from "@/components/ui/FeedbackPanel";
import LoadingState from "@/components/ui/LoadingState";
import Pagination from "@/components/ui/Pagination";
import type { ReturnLoanData, Loan } from "@/lib/types";
import { getActiveReturnsApi, returnLoanItemsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

const PAGE_SIZE = 10;

export default function ReturnsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const detailRef = useRef<HTMLDivElement>(null);
  const successModalCloseRef = useRef<HTMLButtonElement>(null);

  const [loans, setLoans] = useState<ReturnLoanData[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<ReturnLoanData[]>([]);

  const [query, setQuery] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<ReturnLoanData | null>(null);
  const [page, setPage] = useState(1);

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [returnLoading, setReturnLoading] = useState(false);
  const [isStaff, setIsStaff] = useState(false);

  const [error, setError] = useState("");

  const [successLoan, setSuccessLoan] = useState<Loan | null>(null);
  const [returnedCopies, setReturnedCopies] = useState<string[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // =====================================================
  // SCANNER & BARCODE STATE
  // =====================================================
  const [scanLoading, setScanLoading] = useState(false);

  // =====================================================
  // SCANNER & BARCODE LOOKUP HANDLER
  // =====================================================
  async function handleScanCode(scannedRaw: string) {
    const rawCode = scannedRaw.trim();
    if (!rawCode || scanLoading) return;
    const code = rawCode.toUpperCase();
    const cleanCode = code.replace(/[^A-Z0-9]/g, "");

    setScanLoading(true);
    try {
      // 1. IF CURRENTLY HAS A SELECTED LOAN:
      if (selectedLoan) {
        // Check if scanned code matches a copy or book in current selected loan
        const matchedItem = selectedLoan.items.find((it) => {
          const cCode = it.bookCopy.code.toUpperCase();
          const cId = it.bookCopy.id.toUpperCase();
          const bCode = it.book.code.toUpperCase();
          const bIsbn = (it.book.isbn || "").toUpperCase();
          const lItemId = it.loanItem.id.toUpperCase();

          return (
            cCode === code ||
            cId === code ||
            cCode.replace(/[^A-Z0-9]/g, "") === cleanCode ||
            lItemId === code ||
            bCode === code ||
            (bIsbn && bIsbn === code)
          );
        });

        if (matchedItem) {
          if (matchedItem.loanItem.status !== "BORROWED") {
            toast.warning(
              `Buku "${matchedItem.book.title}" (${matchedItem.bookCopy.code}) sudah dikembalikan sebelumnya.`
            );
            return;
          }

          if (selectedItemIds.includes(matchedItem.loanItem.id)) {
            toast.info(`Copy ${matchedItem.bookCopy.code} sudah terpilih.`);
            return;
          }

          // Select this copy item
          setSelectedItemIds((prev) => [...prev, matchedItem.loanItem.id]);
          toast.success(
            `Copy ${matchedItem.bookCopy.code} (${matchedItem.book.title}) berhasil dipilih!`
          );
          return;
        }
      }

      // 2. SEARCH ACROSS ALL ACTIVE LOANS
      // A. Match Loan Number (e.g. TRX-...)
      const matchedLoanByNumber = loans.find(
        (it) =>
          it.loan.loanNumber.toUpperCase() === code ||
          it.loan.loanNumber.toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanCode ||
          it.loan.id.toUpperCase() === code
      );

      if (matchedLoanByNumber) {
        selectLoan(matchedLoanByNumber);
        // Auto-check all borrowed copies in this loan
        const borrowedIds = matchedLoanByNumber.items
          .filter((it) => it.loanItem.status === "BORROWED")
          .map((it) => it.loanItem.id);
        setSelectedItemIds(borrowedIds);
        toast.success(
          `Transaksi ${matchedLoanByNumber.loan.loanNumber} (${matchedLoanByNumber.member.name}) ditemukan!`
        );
        return;
      }

      // B. Match Book Copy code across all active loans
      let foundLoan: ReturnLoanData | null = null;
      let foundLoanItem: (typeof loans)[0]["items"][0] | null = null;

      for (const loanData of loans) {
        const item = loanData.items.find((it) => {
          const cCode = it.bookCopy.code.toUpperCase();
          const cId = it.bookCopy.id.toUpperCase();
          const bCode = it.book.code.toUpperCase();
          const bIsbn = (it.book.isbn || "").toUpperCase();
          const lItemId = it.loanItem.id.toUpperCase();

          return (
            cCode === code ||
            cId === code ||
            cCode.replace(/[^A-Z0-9]/g, "") === cleanCode ||
            lItemId === code ||
            bCode === code ||
            (bIsbn && bIsbn === code)
          );
        });

        if (item) {
          foundLoan = loanData;
          foundLoanItem = item;
          break;
        }
      }

      if (foundLoan && foundLoanItem) {
        selectLoan(foundLoan);
        if (foundLoanItem.loanItem.status === "BORROWED") {
          setSelectedItemIds([foundLoanItem.loanItem.id]);
          toast.success(
            `Ditemukan transaksi ${foundLoan.loan.loanNumber}! Copy ${foundLoanItem.bookCopy.code} dipilih.`
          );
        } else {
          setSelectedItemIds([]);
          toast.warning(
            `Transaksi ${foundLoan.loan.loanNumber} ditemukan, namun copy ${foundLoanItem.bookCopy.code} sudah dikembalikan.`
          );
        }
        return;
      }

      // C. Match Member Number / Name / Identity Number
      const matchedLoanByMember = loans.find(
        (it) =>
          it.member.memberNumber.toUpperCase() === code ||
          it.member.memberNumber.toUpperCase().replace(/[^A-Z0-9]/g, "") === cleanCode ||
          it.member.id.toUpperCase() === code ||
          (it.member.identityNumber && it.member.identityNumber.toUpperCase() === code) ||
          it.member.name.toUpperCase() === code
      );

      if (matchedLoanByMember) {
        selectLoan(matchedLoanByMember);
        const borrowedIds = matchedLoanByMember.items
          .filter((it) => it.loanItem.status === "BORROWED")
          .map((it) => it.loanItem.id);
        setSelectedItemIds(borrowedIds);
        toast.success(
          `Transaksi anggota ${matchedLoanByMember.member.name} (${matchedLoanByMember.loan.loanNumber}) ditemukan!`
        );
        return;
      }

      // If not found in active loans:
      toast.error(`Tidak ditemukan transaksi aktif untuk barcode/kode "${rawCode}".`);
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses scan barcode.");
    } finally {
      setScanLoading(false);
    }
  }

  // =====================================================
  // GLOBAL HARDWARE USB BARCODE SCANNER LISTENER
  // =====================================================
  useEffect(() => {
    if (successLoan ) {
      return;
    }

    let buffer = "";
    let lastKeyTime = 0;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab" || e.key.startsWith("F")) {
        return;
      }

      const activeEl = document.activeElement as HTMLElement | null;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT");

      const now = Date.now();
      const elapsed = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === "Enter") {
        const clean = buffer.trim();
        if (clean.length >= 2) {
          e.preventDefault();
          buffer = "";
          void handleScanCode(clean);
        }
        return;
      }

      // If user typing slowly in input, reset buffer
      if (elapsed > 100) {
        buffer = "";
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (isInputFocused && elapsed > 60) {
          return;
        }
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [loans, selectedLoan, selectedItemIds, successLoan, scanLoading]);

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
      return;
    }

    if (!canAccessReturns(session.user.role)) {
      router.replace("/dashboard");
      return;
    }

    setIsStaff(canManageReturns(session.user.role));
  }, [router]);

  useEffect(() => {
    async function loadLoans() {
      setLoading(true);
      setError("");

      try {
        const result = await getActiveReturnsApi();

        const activeOnly = result.filter(
          (item) =>
            item.loan.status !== "COMPLETED" &&
            item.items.some((it) => it.loanItem.status === "BORROWED")
        );

        setLoans(activeOnly);
        setFilteredLoans(activeOnly);
      } catch (err: any) {
        setError(
          err instanceof Error ? err.message : "Transaksi aktif gagal dimuat."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadLoans();
  }, []);

  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / PAGE_SIZE));

  const currentPage = Math.min(page, totalPages);

  const paginatedLoans = filteredLoans.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

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
    if (!selectedLoan) {
      toast.error("Transaksi belum dipilih.");
      return;
    }

    if (selectedItemIds.length === 0) {
      toast.error("Pilih minimal satu buku yang dikembalikan.");
      return;
    }

    setReturnLoading(true);

    try {
      const selectedCopies = selectedLoan.items
        .filter(({ loanItem }) => selectedItemIds.includes(loanItem.id))
        .map(
          ({ bookCopy, loanItem }) =>
            bookCopy.id || loanItem.bookCopyId || loanItem.id
        );

      const loan = await returnLoanItemsApi(
        selectedLoan.loan.id,
        selectedCopies,
        selectedItemIds,
        selectedLoan.loan.companyId
      );

      toast.success("Buku berhasil dikembalikan.");
      setSuccessLoan(loan);

      setReturnedCopies(
        selectedLoan.items
          .filter(({ loanItem }) => selectedItemIds.includes(loanItem.id))
          .map(({ book, bookCopy }) => `${book.title} (${bookCopy.code})`),
      );

      const returnedIdSet = new Set(selectedItemIds);
      const updatedItems = selectedLoan.items.map((it) => {
        if (returnedIdSet.has(it.loanItem.id)) {
          return {
            ...it,
            loanItem: {
              ...it.loanItem,
              status: "RETURNED" as const,
              returnedAt: new Date().toISOString(),
            },
            bookCopy: {
              ...it.bookCopy,
              status: "AVAILABLE" as const,
            },
          };
        }
        return it;
      });

      const hasRemainingBorrowed = updatedItems.some(
        (it) => it.loanItem.status === "BORROWED"
      );

      const updatedLoanData: ReturnLoanData = {
        ...selectedLoan,
        loan: {
          ...selectedLoan.loan,
          ...loan,
          status: hasRemainingBorrowed
            ? loan.status || selectedLoan.loan.status
            : "COMPLETED",
        },
        items: updatedItems,
      };

      setSelectedItemIds([]);

      // Update loans state
      setLoans((prev) =>
        prev
          .map((item) => (item.loan.id === loan.id ? updatedLoanData : item))
          .filter(
            (item) =>
              item.loan.status !== "COMPLETED" &&
              item.items.some((it) => it.loanItem.status === "BORROWED")
          )
      );

      setFilteredLoans((prev) =>
        prev
          .map((item) => (item.loan.id === loan.id ? updatedLoanData : item))
          .filter(
            (item) =>
              item.loan.status !== "COMPLETED" &&
              item.items.some((it) => it.loanItem.status === "BORROWED")
          )
      );

      if (hasRemainingBorrowed) {
        setSelectedLoan(updatedLoanData);
      } else {
        setSelectedLoan(null);
      }

      // Re-sync background data from backend
      void getActiveReturnsApi()
        .then((latest) => {
          const activeOnly = latest.filter(
            (item) =>
              item.loan.status !== "COMPLETED" &&
              item.items.some((it) => it.loanItem.status === "BORROWED")
          );
          setLoans(activeOnly);
          setFilteredLoans(activeOnly);
          if (hasRemainingBorrowed) {
            const currentSelected = activeOnly.find(
              (item) => item.loan.id === loan.id
            );
            if (currentSelected) {
              setSelectedLoan(currentSelected);
            }
          }
        })
        .catch(() => {});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pengembalian gagal diproses.";
      toast.error(message);
    } finally {
      setReturnLoading(false);
    }
  }

  function getItemStatusLabel(status: string, isOverdue?: boolean) {
    if (status === "BORROWED") {
      return isOverdue ? "Terlambat" : "Dipinjam";
    }
    return "Dikembalikan";
  }

  function getItemStatusVariant(
    status: string,
    isOverdue?: boolean,
  ): "success" | "warning" | "danger" | "neutral" {
    if (status === "BORROWED") {
      return isOverdue ? "danger" : "warning";
    }
    return "success";
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(`${loanData.loan.dueAt.slice(0, 10)}T00:00:00`);
    const isOverdue =
      loanData.loan.status === "OVERDUE" ||
      (!Number.isNaN(dueDate.getTime()) && dueDate.getTime() < today.getTime());

    // Masih ada buku yang dipinjam dan transaksi terlambat
    if (isOverdue) {
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
        <LoadingState label="Memuat pengembalian..." />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
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

        <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)] lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)] md:items-start">
          <div className="min-w-0">
            <Card className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    1. Cari Transaksi
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Cari berdasarkan nomor transaksi, nama anggota, judul buku,
                    atau kode copy.
                  </p>
                </div>

              </div>

              <div className="mt-4">
                <Input
                  id="return-search"
                  label="Cari transaksi"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
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
                  {paginatedLoans.map((item) => {
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
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
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

                          <div className="flex shrink-0 items-center">
                            <Badge variant={overallStatus.variant}>
                              {overallStatus.label}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* PAGINATION (MOBILE, TABLET & DESKTOP) */}

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(nextPage) => setPage(nextPage)}
                totalItems={filteredLoans.length}
                pageSize={PAGE_SIZE}
                className="mt-4 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 rounded-b-xl border-t"
              />
            </Card>
          </div>

          <div
            ref={detailRef}
            className="min-w-0 scroll-mt-20 md:sticky md:top-20 md:self-start"
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
                          <p className="text-xs text-slate-500">Jatuh tempo</p>

                          <p className="mt-1 font-semibold text-slate-900">
                            {formatDate(selectedLoan.loan.dueAt)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Dipinjam</p>

                          <p className="mt-1 font-semibold text-amber-700">
                            {borrowedCount} buku
                          </p>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Dikembalikan</p>

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
                              const isBorrowed = loanItem.status === "BORROWED";

                              const selected = selectedItemIds.includes(
                                loanItem.id,
                              );

                              return (
                                <label
                                  key={loanItem.id}
                                  className={`grid items-center gap-3 rounded-xl border p-3 transition ${
                                    isStaff
                                      ? "grid-cols-[auto_minmax(0,1fr)_auto]"
                                      : "grid-cols-[minmax(0,1fr)_auto]"
                                  } ${
                                    isBorrowed
                                      ? selected
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-slate-200 bg-white hover:border-blue-300"
                                      : "border-green-200 bg-green-50/40"
                                  } ${
                                    isStaff && isBorrowed
                                      ? "cursor-pointer"
                                      : "cursor-default"
                                  }`}
                                >
                                  {isStaff && (
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      disabled={!isBorrowed || returnLoading}
                                      onChange={() => toggleItem(loanItem.id)}
                                      className="h-4 w-4 rounded border-slate-300 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                                    />
                                  )}

                                  <div className="min-w-0">
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

                                  <div className="flex min-w-24 shrink-0 flex-col items-center justify-center text-center">
                                    <Badge
                                      variant={getItemStatusVariant(
                                        loanItem.status,
                                        selectedLoan.loan.status === "OVERDUE",
                                      )}
                                    >
                                      {getItemStatusLabel(
                                        loanItem.status,
                                        selectedLoan.loan.status === "OVERDUE",
                                      )}
                                    </Badge>

                                    {loanItem.status === "RETURNED" &&
                                      loanItem.returnedAt && (
                                        <span className="mt-1 text-xs text-green-700">
                                          {formatDate(loanItem.returnedAt)}
                                        </span>
                                      )}
                                  </div>
                                </label>
                              );
                            },
                          )}
                        </div>
                      </div>

                      {isStaff && (
                        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={returnLoading}
                            onClick={() => {
                              setSelectedLoan(null);
                              setSelectedItemIds([]);
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
                      )}
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
                <span aria-hidden="true" className="text-xl leading-none">
                  ×
                </span>
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div>
                  <p className="text-xs text-slate-500">Nomor transaksi</p>

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
                  <p className="text-xs text-slate-500">Tanggal pengembalian</p>

                  <p className="mt-1 font-medium text-slate-900">
                    {formatDate(successLoan.returnedAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
              <Button type="button" onClick={() => setSuccessLoan(null)}>
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
