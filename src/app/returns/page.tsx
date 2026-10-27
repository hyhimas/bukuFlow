"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import { canAccessReturns, canManageReturns } from "@/lib/authorization";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import DatePicker from "@/components/ui/DatePicker";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import type { ReturnLoanData, Loan, Member } from "@/lib/types";
import {
  getActiveReturnsApi,
  listLoansApi,
  getLoanByIdApi,
  returnLoanItemsApi,
  getCompanySettingsApi,
  searchMembersApi,
  getErrorMessage,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useSubmitHotkey } from "@/hooks/useHotkeys";

function getTodayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateLateInfo(
  dueAt?: string,
  returnDateStr?: string,
  dailyRate: number | null = null
) {
  if (!dueAt || !returnDateStr) {
    return { daysOverdue: 0, finePerBook: 0 };
  }
  const dueDate = new Date(`${dueAt.slice(0, 10)}T00:00:00`);
  const retDate = new Date(`${returnDateStr.slice(0, 10)}T00:00:00`);
  if (isNaN(dueDate.getTime()) || isNaN(retDate.getTime())) {
    return { daysOverdue: 0, finePerBook: 0 };
  }
  const diffTime = retDate.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const daysOverdue = diffDays > 0 ? diffDays : 0;
  return {
    daysOverdue,
    finePerBook: dailyRate !== null ? daysOverdue * dailyRate : 0,
  };
}

export default function ReturnsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const detailRef = useRef<HTMLDivElement>(null);
  const successModalCloseRef = useRef<HTMLButtonElement>(null);

  const [loans, setLoans] = useState<ReturnLoanData[]>([]);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<ReturnLoanData | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const savedTotalRef = useRef(0);

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [returnLoading, setReturnLoading] = useState(false);
  const [isStaff, setIsStaff] = useState(() => {
    if (typeof window !== "undefined") {
      const s = getSession();
      return s ? canManageReturns(s.user.role) : false;
    }
    return false;
  });

  const [error, setError] = useState("");

  const [dailyFineRate, setDailyFineRate] = useState<number | null>(null);
  const [settingsPending, setSettingsPending] = useState(false);
  const [returnDate, setReturnDate] = useState<string>(getTodayLocal());

  const [successLoan, setSuccessLoan] = useState<Loan | null>(null);
  const [returnedCopies, setReturnedCopies] = useState<string[]>([]);
  const [lastReturnDetails, setLastReturnDetails] = useState<{
    daysOverdue: number;
    finePerBook: number;
    totalFine: number;
    returnDate: string;
    isPartial: boolean;
    remainingCount: number;
  } | null>(null);

  // =====================================================
  // SCANNER & BARCODE STATE
  // =====================================================
  const [scanLoading, setScanLoading] = useState(false);

  // Refs for stable event listener callbacks
  const loansRef = useRef(loans);
  loansRef.current = loans;
  const selectedLoanRef = useRef(selectedLoan);
  selectedLoanRef.current = selectedLoan;
  const selectedItemIdsRef = useRef(selectedItemIds);
  selectedItemIdsRef.current = selectedItemIds;

  useSubmitHotkey(() => void handleReturn(), {
    enabled: Boolean(selectedLoan && selectedItemIds.length > 0 && !returnLoading),
    loading: returnLoading,
  });

  // =====================================================
  // SCANNER & BARCODE LOOKUP HANDLER
  // =====================================================
  const handleScanCode = useCallback(async (scannedRaw: string) => {
    const rawCode = scannedRaw.trim();
    if (!rawCode || scanLoading) return;
    const code = rawCode.toUpperCase();
    const cleanCode = code.replace(/[^A-Z0-9]/g, "");

    const currentSelectedLoan = selectedLoanRef.current;
    const currentLoans = loansRef.current;

    setScanLoading(true);
    try {
      // 1. IF CURRENTLY HAS A SELECTED LOAN:
      if (currentSelectedLoan) {
        // Check if scanned code matches a copy or book in current selected loan
        const matchedItem = currentSelectedLoan.items.find((it) => {
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

          if (selectedItemIdsRef.current.includes(matchedItem.loanItem.id)) {
            toast.info(`Eksemplar ${matchedItem.bookCopy.code} sudah terpilih.`);
            return;
          }

          // Select this copy item
          setSelectedItemIds((prev) => [...prev, matchedItem.loanItem.id]);
          toast.success(
            `Eksemplar ${matchedItem.bookCopy.code} (${matchedItem.book.title}) berhasil dipilih.`
          );
          return;
        }
      }

      // 2. SEARCH ACROSS ALL ACTIVE LOANS
      // A. Match Loan Number (e.g. TRX-...)
      const matchedLoanByNumber = currentLoans.find(
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
          `Peminjaman ${matchedLoanByNumber.loan.loanNumber} (${matchedLoanByNumber.member.name}) ditemukan.`
        );
        return;
      }

      // B. Match Book Copy code across all active loans
      let foundLoan: ReturnLoanData | null = null;
      let foundLoanItem: (typeof currentLoans)[0]["items"][0] | null = null;

      for (const loanData of currentLoans) {
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
            `Ditemukan peminjaman ${foundLoan.loan.loanNumber}. Eksemplar ${foundLoanItem.bookCopy.code} dipilih.`
          );
        } else {
          setSelectedItemIds([]);
          toast.warning(
            `Peminjaman ${foundLoan.loan.loanNumber} ditemukan, namun eksemplar ${foundLoanItem.bookCopy.code} sudah dikembalikan.`
          );
        }
        return;
      }

      // C. Match Member Number / Name / Identity Number (Support multiple active loans from server)
      let foundMemberObj: Member | null = null;
      try {
        const memberCandidates = await searchMembersApi(rawCode);
        if (Array.isArray(memberCandidates) && memberCandidates.length > 0) {
          foundMemberObj =
            memberCandidates.find(
              (m) =>
                m.memberNumber.toUpperCase() === code ||
                m.identityNumber?.toUpperCase() === code ||
                m.id.toUpperCase() === code
            ) || null;
        }
      } catch {
        // Abaikan jika endpoint search member gagal
      }

      if (foundMemberObj?.id) {
        try {
          // Panggil GET /loan/search?member_id=...&status=ACTIVE&status=OVERDUE
          const memberLoansRes = await listLoansApi({
            member_id: foundMemberObj.id,
            status: ["ACTIVE", "OVERDUE"],
            size: 50,
          });

          if (memberLoansRes.items.length > 0) {
            setQuery(foundMemberObj.memberNumber || rawCode);
            const primaryLoan = memberLoansRes.items[0];
            selectLoan(primaryLoan);
            const borrowedIds = primaryLoan.items
              .filter((it) => it.loanItem.status === "BORROWED")
              .map((it) => it.loanItem.id);
            setSelectedItemIds(borrowedIds);

            if (memberLoansRes.items.length > 1) {
              toast.info(
                `Ditemukan ${memberLoansRes.items.length} peminjaman aktif untuk anggota ${primaryLoan.member.name}. Silakan pilih transaksi di panel kiri.`
              );
            } else {
              toast.success(
                `Peminjaman anggota ${primaryLoan.member.name} (${primaryLoan.loan.loanNumber}) ditemukan.`
              );
            }
            return;
          } else {
            toast.info(`Anggota ${foundMemberObj.name} tidak memiliki peminjaman aktif.`);
            return;
          }
        } catch {
          // Lanjut ke pengecekan berikutnya
        }
      }

      // If not found in active loans:
      toast.error(`Tidak ditemukan peminjaman aktif untuk barcode/kode "${rawCode}".`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal memproses scan barcode."));
    } finally {
      setScanLoading(false);
    }
  }, [scanLoading, toast]);

  const handleScanCodeRef = useRef(handleScanCode);
  handleScanCodeRef.current = handleScanCode;

  // =====================================================
  // GLOBAL HARDWARE USB BARCODE SCANNER LISTENER
  // =====================================================
  useEffect(() => {
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
          void handleScanCodeRef.current(clean);
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
  }, []);

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

  // =====================================================
  // AUTH & COMPANY SETTINGS
  // =====================================================
  useEffect(() => {
    const session = getSession();

    if (!session) {
      if (!isStoredSessionExpired() && !hasStoredAuth()) {
        router.replace("/login");
      }
      return;
    }

    if (!canAccessReturns(session.user.role)) {
      router.replace("/dashboard");
      return;
    }

    const compId = session.user.companyId;
    if (compId) {
      getCompanySettingsApi(compId)
        .then((settings) => {
          if (settings && typeof settings.dailyFineRate === "number") {
            setDailyFineRate(settings.dailyFineRate);
            setSettingsPending(false);
          } else {
            setDailyFineRate(null);
            setSettingsPending(true);
          }
        })
        .catch((_err) => {
          setDailyFineRate(null);
          setSettingsPending(true);
        });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Muat konfigurasi tarif denda instansi atau tandai pending saat mount
      setDailyFineRate(null);
      setSettingsPending(true);
    }
  }, [router]);

  // =====================================================
  // SEARCH TRANSACTION WITH DEBOUNCE
  // =====================================================
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  // =====================================================
  // LOAD LOANS (SERVER-SIDE WITH QUERY & PAGINATION)
  // =====================================================
  const loadLoans = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getActiveReturnsApi({
        page,
        size: pageSize,
        search: debouncedQuery.trim() || undefined,
      });

      setLoans(result.items);
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
        getErrorMessage(err, "Peminjaman aktif gagal dimuat.")
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch daftar peminjaman aktif pengembalian saat mount dan filter berubah
    void loadLoans();
  }, [loadLoans]);

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
    setReturnDate(getTodayLocal());
  }

  // =====================================================
  // AUTO SELECT TARGET LOAN FROM URL PARAMS (DEEP LINKING)
  // =====================================================
  const hasAutoSelectedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || hasAutoSelectedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const targetLoanNumber = params.get("loanNumber");
    const targetLoanId = params.get("loanId");

    if (!targetLoanNumber && !targetLoanId) return;
    hasAutoSelectedRef.current = true;

    // Direct fetch loan by ID so details appear immediately
    const fetchTargetLoan = async () => {
      try {
        let found: ReturnLoanData | null = null;
        if (targetLoanId) {
          found = await getLoanByIdApi(targetLoanId);
        }

        if (!found && targetLoanNumber) {
          const res = await getActiveReturnsApi({
            page: 1,
            size: 10,
            search: targetLoanNumber,
          });
          found =
            res.items.find(
              (item) =>
                item.loan.loanNumber === targetLoanNumber ||
                (targetLoanId && item.loan.id === targetLoanId)
            ) || null;
        }

        if (found) {
          selectLoan(found);
          const borrowedItemIds = found.items
            .filter((it) => it.loanItem.status === "BORROWED")
            .map((it) => it.loanItem.id);
          if (borrowedItemIds.length > 0) {
            setSelectedItemIds(borrowedItemIds);
          }

          setLoans((prev) => {
            if (prev.some((l) => l.loan.id === found!.loan.id)) return prev;
            return [found!, ...prev];
          });

          setTimeout(() => {
            detailRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 150);
        }
      } catch (err) {
        console.warn("Gagal auto-select transaksi dari URL:", err);
      }
    };

    void fetchTargetLoan();
  }, [toast]);

  function toggleItem(itemId: string) {
    setSelectedItemIds((current) => {
      if (current.includes(itemId)) {
        return current.filter((id) => id !== itemId);
      }

      return [...current, itemId];
    });
  }

  // =====================================================
  // EXECUTE RETURN (INLINE CONFIRMATION - SINGLE MODAL)
  // =====================================================
  async function handleReturn() {
    if (!selectedLoan) {
      toast.error("Peminjaman belum dipilih.");
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

      const returnedItemsList = selectedLoan.items
        .filter(({ loanItem }) => selectedItemIds.includes(loanItem.id))
        .map(({ book, bookCopy }) => `${book.title} (${bookCopy.code})`);

      const lateInfo = calculateLateInfo(
        selectedLoan.loan.dueAt,
        returnDate,
        dailyFineRate
      );
      const totalFine =
        dailyFineRate !== null
          ? lateInfo.daysOverdue * dailyFineRate * selectedItemIds.length
          : 0;

      const loan = await returnLoanItemsApi(
        selectedLoan.loan.id,
        selectedCopies,
        selectedItemIds,
        selectedLoan.loan.companyId,
        returnDate
      );

      const returnedIdSet = new Set(selectedItemIds);
      const updatedItems = selectedLoan.items.map((it) => {
        if (returnedIdSet.has(it.loanItem.id)) {
          return {
            ...it,
            loanItem: {
              ...it.loanItem,
              status: "RETURNED" as const,
              returnedAt:
                loan.returnedAt ||
                (returnDate ? `${returnDate}T12:00:00.000Z` : ""),
            },
            bookCopy: {
              ...it.bookCopy,
              status: "AVAILABLE" as const,
            },
          };
        }
        return it;
      });

      const remainingBorrowedCount = updatedItems.filter(
        (it) => it.loanItem.status === "BORROWED"
      ).length;

      const hasRemainingBorrowed = remainingBorrowedCount > 0;

      const updatedLoanData: ReturnLoanData = {
        ...selectedLoan,
        loan: {
          ...selectedLoan.loan,
          ...loan,
          status: hasRemainingBorrowed
            ? loan.status || selectedLoan.loan.status
            : "COMPLETED",
          returnedAt: hasRemainingBorrowed
            ? loan.returnedAt || selectedLoan.loan.returnedAt
            : loan.returnedAt || `${returnDate}T12:00:00.000Z`,
        },
        items: updatedItems,
      };

      setReturnedCopies(returnedItemsList);
      setLastReturnDetails({
        daysOverdue: lateInfo.daysOverdue,
        finePerBook: lateInfo.finePerBook,
        totalFine,
        returnDate,
        isPartial: hasRemainingBorrowed,
        remainingCount: remainingBorrowedCount,
      });

      setSuccessLoan(updatedLoanData.loan);
      setSelectedItemIds([]);

      toast.success(
        hasRemainingBorrowed
          ? "Sebagian buku berhasil dikembalikan."
          : "Semua buku berhasil dikembalikan."
      );

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

      if (hasRemainingBorrowed) {
        setSelectedLoan(updatedLoanData);
      } else {
        setSelectedLoan(null);
      }

      // Re-sync background data from backend
      void getActiveReturnsApi({
        page,
        size: pageSize,
        search: debouncedQuery.trim() || undefined,
      })
        .then((latest) => {
          setLoans(latest.items);
          setTotalItems(latest.total);
          setTotalPages(latest.totalPages);
          if (hasRemainingBorrowed) {
            const currentSelected = latest.items.find(
              (item) => item.loan.id === loan.id
            );
            if (currentSelected) {
              setSelectedLoan(currentSelected);
            }
          }
        })
        .catch((err: unknown) => {
          toast.error(getErrorMessage(err, "Gagal menyinkronkan data peminjaman terbaru."));
        });
    } catch (error) {
      const message = getErrorMessage(error, "Pengembalian gagal diproses.");
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
    isOverdue?: boolean
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
      ({ loanItem }) => loanItem.status === "BORROWED"
    ).length;

    const returnedCount = items.filter(
      ({ loanItem }) => loanItem.status === "RETURNED"
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



  // Active loans for currently selected member (for multi-loan switcher)
  const memberActiveLoans = selectedLoan
    ? loans.filter(
        (l) =>
          l.member.id === selectedLoan.member.id ||
          l.member.memberNumber === selectedLoan.member.memberNumber
      )
    : [];

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="page-container py-5 sm:py-6">
        <div className="mb-5">
          <PageHeader
            backLink="/dashboard"
            title="Pengembalian Buku"
            description="Cari peminjaman aktif atau scan barcode untuk memproses pengembalian buku."
            actions={
              <div className="flex items-center gap-2 self-start rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary shadow-2xs sm:self-auto">
                <span
                  className={`h-2 w-2 rounded-full ${
                    scanLoading ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                  }`}
                />
                <span className="font-medium">
                  {scanLoading ? "Memproses Barcode..." : "Scanner USB Aktif"}
                </span>
              </div>
            }
          />
        </div>

        {/* Banner Durasi/Tarif Denda Belum Dikonfigurasi */}
        {settingsPending && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-bold text-sm">
              <svg className="h-4 w-4 text-amber-600 shrink-0 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p>Belum dikonfigurasi di server</p>
            </div>
            <p className="mt-1 text-xs text-amber-800">
              Pengaturan kebijakan sirkulasi instansi belum disetel di Pengaturan. Denda keterlambatan belum bisa dihitung secara otomatis.
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:gap-5 md:grid-cols-[minmax(0,1.12fr)_minmax(330px,0.98fr)] lg:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.9fr)] md:items-start">
          {/* KOLOM KIRI: CARI & DAFTAR TRANSAKSI */}
          <div className="min-w-0">
            <Card className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text-main">
                    1. Cari Peminjaman
                  </h2>
                  <p className="mt-1 text-sm text-text-muted">
                    Cari berdasarkan nomor peminjaman, nama anggota, judul buku, atau kode eksemplar.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <Input
                  id="return-search"
                  label="Cari peminjaman"
                  value={query}
                  disabled={Boolean(error) || loading}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Contoh: TRX-001, Budi, Laskar Pelangi..."
                />
              </div>

              {error && (
                <ErrorState
                  title="Gagal Memuat Peminjaman Aktif"
                  message={error}
                  onRetry={() => void loadLoans()}
                  className="mt-4"
                  nested
                />
              )}
            </Card>

            {!error && (
              <Card className="mt-5 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-text-main">
                    2. Daftar Peminjaman
                  </h3>
                  <p className="mt-1 text-sm text-text-muted">
                    Pilih peminjaman untuk melihat detail pengembalian.
                  </p>
                </div>

                {loans.length > 0 && (
                  <p className="shrink-0 text-xs text-text-muted">
                    {totalItems > 0 ? `${totalItems} peminjaman` : `${loans.length} peminjaman`}
                  </p>
                )}
              </div>

              {loading && loans.length === 0 && (
                <div className="mt-4 space-y-2.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-border bg-surface space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  ))}
                </div>
              )}

              {!loading && !error && loans.length === 0 && (
                <div className="mt-4">
                  <EmptyState
                    title={
                      query.trim()
                        ? "Peminjaman tidak ditemukan"
                        : "Belum ada peminjaman aktif"
                    }
                    description={
                      query.trim()
                        ? `Tidak ada peminjaman yang sesuai dengan "${query.trim()}". Coba gunakan nomor peminjaman, nama anggota, judul buku, atau kode eksemplar lain.`
                        : "Belum ada peminjaman aktif yang dapat diproses. Peminjaman akan muncul di sini selama masih ada buku yang belum dikembalikan."
                    }
                  />
                </div>
              )}

              {loans.length > 0 && (
                <div className="mt-4 space-y-2">
                  {loans.map((item) => {
                    const overallStatus = getOverallStatus(item);

                    return (
                      <Button
                        key={item.loan.id}
                        type="button"
                        variant="ghost"
                        onClick={() => selectLoan(item)}
                        aria-pressed={selectedLoan?.loan.id === item.loan.id}
                        className={`w-full h-auto rounded-xl border p-3 text-left justify-start font-normal transition ${
                          selectedLoan?.loan.id === item.loan.id
                            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                            : "border-border bg-surface hover:border-blue-300 hover:bg-blue-50"
                        }`}
                      >
                        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-text-main">
                              {item.loan.loanNumber}
                            </p>
                            <p className="mt-1 truncate text-sm text-text-secondary">
                              {item.member.name}
                            </p>
                            <p className="mt-1 text-xs text-text-muted">
                              {item.items.length} item <span className="mx-1 select-none text-text-subtle" aria-hidden="true">&bull;</span>{" "}
                              {formatDate(item.loan.borrowedAt)} <span className="mx-1 select-none text-text-subtle" aria-hidden="true">&rarr;</span>{" "}
                              {formatDate(item.loan.dueAt)}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center">
                            <Badge variant={overallStatus.variant}>
                              {overallStatus.label}
                            </Badge>
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              )}

              {/* PAGINATION */}
              {loans.length > 0 && (
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
                  className="mt-4 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 rounded-b-xl border-t"
                />
              )}
            </Card>
            )}
          </div>

          {/* KOLOM KANAN: DETAIL PENGEMBALIAN */}
          <div
            ref={detailRef}
            className="min-w-0 scroll-mt-20 md:sticky md:top-20 md:self-start"
          >
            {selectedLoan ? (
              <Card className="border-blue-200 p-4 sm:p-5">
                {(() => {
                  const overallStatus = getOverallStatus(selectedLoan);

                  const borrowedItems = selectedLoan.items.filter(
                    ({ loanItem }) => loanItem.status === "BORROWED"
                  );
                  const borrowedCount = borrowedItems.length;

                  const returnedCount = selectedLoan.items.filter(
                    ({ loanItem }) => loanItem.status === "RETURNED"
                  ).length;

                  const allBorrowedSelected =
                    borrowedCount > 0 &&
                    borrowedItems.every((it) =>
                      selectedItemIds.includes(it.loanItem.id)
                    );
                  const isPartiallySelected =
                    borrowedItems.some((it) =>
                      selectedItemIds.includes(it.loanItem.id)
                    ) && !allBorrowedSelected;

                  const handleSelectAllToggle = () => {
                    if (allBorrowedSelected) {
                      setSelectedItemIds([]);
                    } else {
                      setSelectedItemIds(
                        borrowedItems.map((it) => it.loanItem.id)
                      );
                    }
                  };

                  const lateInfo = calculateLateInfo(
                    selectedLoan.loan.dueAt,
                    returnDate,
                    dailyFineRate
                  );
                  const selectedCount =
                    selectedItemIds.length > 0
                      ? selectedItemIds.length
                      : borrowedCount;
                  const estimatedFine =
                    dailyFineRate !== null
                      ? lateInfo.daysOverdue * dailyFineRate * selectedCount
                      : null;

                  return (
                    <>
                      {/* Non-staff Mode Notice */}
                      {!isStaff && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                          <span className="font-semibold">Mode Baca Saja:</span>{" "}
                          Akun Anda tidak memiliki hak akses staf untuk memproses pengembalian buku. Hubungi administrator jika Anda memerlukan akses.
                        </div>
                      )}

                      {/* Multiple Active Loans Switcher for Member */}
                      {memberActiveLoans.length > 1 && (
                        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-blue-900">
                              Anggota ini memiliki {memberActiveLoans.length} transaksi aktif:
                            </p>
                            <span className="text-xs text-blue-700 font-medium">
                              Pilih transaksi untuk diproses
                            </span>
                          </div>

                          {memberActiveLoans.length <= 3 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {memberActiveLoans.map((l) => {
                                const isCurrent =
                                  l.loan.id === selectedLoan.loan.id;
                                const unreturnedCount = l.items.filter(
                                  (it) => it.loanItem.status === "BORROWED"
                                ).length;

                                return (
                                  <Button
                                    key={l.loan.id}
                                    type="button"
                                    variant={isCurrent ? "primary" : "secondary"}
                                    size="sm"
                                    onClick={() => selectLoan(l)}
                                    className="h-auto min-h-0 py-1 px-2.5 text-xs whitespace-nowrap"
                                  >
                                    {l.loan.loanNumber} ({unreturnedCount} buku)
                                  </Button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="mt-2">
                              <div className="relative">
                                <select
                                  id="member-active-loan-switcher"
                                  aria-label="Pilih transaksi aktif anggota"
                                  value={selectedLoan.loan.id}
                                  onChange={(e) => {
                                    const target = memberActiveLoans.find((l) => l.loan.id === e.target.value);
                                    if (target) selectLoan(target);
                                  }}
                                  className="w-full h-9 rounded-lg border border-blue-300 bg-surface pl-3 pr-8 text-xs font-semibold text-text-main shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                                >
                                  {memberActiveLoans.map((l) => {
                                    const unreturnedCount = l.items.filter(
                                      (it) => it.loanItem.status === "BORROWED"
                                    ).length;
                                    return (
                                      <option key={l.loan.id} value={l.loan.id}>
                                        {l.loan.loanNumber} ({unreturnedCount} buku) &bull; Pinjam: {formatDate(l.loan.borrowedAt)} &rarr; Jatuh tempo: {formatDate(l.loan.dueAt)}
                                      </option>
                                    );
                                  })}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-text-muted">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="border-b border-border pb-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                          3. Detail Pengembalian
                        </p>

                        <div className="mt-2 flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <h3
                              className="break-words text-xl font-bold leading-tight text-text-main"
                              title={selectedLoan.loan.loanNumber}
                            >
                              {selectedLoan.loan.loanNumber}
                            </h3>

                            <p
                              className="mt-1 break-words text-sm text-text-secondary"
                              title={`${selectedLoan.member.name} - ${selectedLoan.member.memberNumber}`}
                            >
                              {selectedLoan.member.name} <span className="mx-1 select-none text-text-subtle" aria-hidden="true">&bull;</span>{" "}
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
                        <div className="rounded-lg bg-surface-subtle p-3">
                          <p className="text-xs text-text-muted">Tanggal pinjam</p>
                          <p className="mt-1 font-semibold text-text-main">
                            {formatDate(selectedLoan.loan.borrowedAt)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-surface-subtle p-3">
                          <p className="text-xs text-text-muted">Jatuh tempo</p>
                          <p className="mt-1 font-semibold text-text-main">
                            {formatDate(selectedLoan.loan.dueAt)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-surface-subtle p-3">
                          <p className="text-xs text-text-muted">Dipinjam</p>
                          <p className="mt-1 font-semibold text-amber-700">
                            {borrowedCount} buku
                          </p>
                        </div>

                        <div className="rounded-lg bg-surface-subtle p-3">
                          <p className="text-xs text-text-muted">Dikembalikan</p>
                          <p className="mt-1 font-semibold text-emerald-700">
                            {returnedCount} buku
                          </p>
                        </div>
                      </div>

                      {/* Pemilihan Tanggal Pengembalian (Mendukung Pengembalian Lampau / Book Drop) */}
                      {isStaff && (
                        <div className="mt-4 rounded-xl border border-border bg-surface-subtle p-3.5">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="space-y-0.5">
                              <label htmlFor="return-date-picker" className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-600" aria-hidden="true">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                  <line x1="16" y1="2" x2="16" y2="6" />
                                  <line x1="8" y1="2" x2="8" y2="6" />
                                  <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                Tanggal Pengembalian Fisik
                              </label>
                              <p className="text-[11px] text-text-muted">
                                Default hari ini ({formatDate(getTodayLocal())}). Ubah ke tanggal lampau jika buku dikembalikan melalui kotak pengembalian (book drop).
                              </p>
                            </div>

                            <div className="w-full sm:w-56 shrink-0">
                              <DatePicker
                                id="return-date-picker"
                                value={returnDate}
                                onChange={(val) => setReturnDate(val || getTodayLocal())}
                                max={getTodayLocal()}
                                min={selectedLoan.loan.borrowedAt ? selectedLoan.loan.borrowedAt.slice(0, 10) : undefined}
                              />
                            </div>
                          </div>
                          {returnDate < getTodayLocal() && (
                            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-200">
                              <span className="font-semibold text-amber-900">Mode Pengembalian Lampau:</span>
                              Denda dan keterlambatan dihitung berdasarkan tanggal fisik pengembalian ({formatDate(returnDate)}).
                            </div>
                          )}
                        </div>
                      )}



                      {/* Perhitungan Hari Terlambat & Denda */}
                      {lateInfo.daysOverdue > 0 ? (
                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="flex items-center gap-1.5">
                              <svg className="h-4 w-4 text-red-600 shrink-0 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>{" "}
                              Terlambat {lateInfo.daysOverdue} Hari
                            </span>
                            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                              {dailyFineRate !== null
                                ? `Rp ${dailyFineRate.toLocaleString("id-ID")} / hari / buku`
                                : "belum dikonfigurasi"}
                            </span>
                          </div>
                          <p className="mt-1.5 text-red-700">
                            Estimasi denda ({selectedItemIds.length > 0 ? `${selectedItemIds.length} buku dipilih` : `${borrowedCount} buku dipinjam`}):{" "}
                            <span className="font-bold text-red-900">
                              {estimatedFine !== null
                                ? `Rp ${estimatedFine.toLocaleString("id-ID")}`
                                : "belum bisa dihitung"}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800">
                          <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          <span>Pengembalian tepat waktu (tidak ada denda keterlambatan).</span>
                        </div>
                      )}

                      <div className="mt-5">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-text-main">
                            Detail buku
                          </h4>
                          {isStaff && borrowedCount > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleSelectAllToggle}
                              className="h-auto min-h-0 p-0 text-xs font-semibold text-blue-600 hover:text-blue-800"
                            >
                              {allBorrowedSelected
                                ? "Batal pilih semua"
                                : `Pilih semua (${borrowedCount})`}
                            </Button>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-text-muted">
                          {isStaff
                            ? "Pilih buku yang ingin dikembalikan. Buku yang sudah dikembalikan tetap ditampilkan sebagai riwayat status."
                            : "Daftar buku dalam transaksi peminjaman ini beserta riwayat statusnya."}
                        </p>

                        {/* Checkbox "Pilih semua" Bar */}
                        {isStaff && borrowedCount > 1 && (
                          <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-muted/80 px-3 py-2 text-xs">
                            <label className="flex cursor-pointer items-center gap-2 font-medium text-text-secondary">
                              <input
                                type="checkbox"
                                checked={allBorrowedSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = isPartiallySelected;
                                }}
                                onChange={handleSelectAllToggle}
                                className="h-4 w-4 rounded border-border text-blue-600 focus:ring-2 focus:ring-blue-500"
                              />
                              Pilih Semua Buku Dipinjam
                            </label>
                            <span className="text-text-muted">
                              {selectedItemIds.length} dari {borrowedCount} dipilih
                            </span>
                          </div>
                        )}

                        <div className="mt-3 space-y-2.5">
                          {selectedLoan.items.map(
                            ({ loanItem, book, bookCopy }) => {
                              const isBorrowed = loanItem.status === "BORROWED";
                              const selected = selectedItemIds.includes(
                                loanItem.id
                              );

                              const cardBody = (
                                <>
                                  {isStaff && (
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      disabled={!isBorrowed || returnLoading}
                                      onChange={() => toggleItem(loanItem.id)}
                                      className="mt-1 h-4 w-4 shrink-0 rounded border-border text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                                    />
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <p
                                        className="font-semibold text-sm leading-snug text-text-main line-clamp-2"
                                        title={book.title}
                                      >
                                        {book.title}
                                      </p>

                                      <div className="shrink-0">
                                        <Badge
                                          variant={getItemStatusVariant(
                                            loanItem.status,
                                            selectedLoan.loan.status === "OVERDUE" || lateInfo.daysOverdue > 0
                                          )}
                                        >
                                          {getItemStatusLabel(
                                            loanItem.status,
                                            selectedLoan.loan.status === "OVERDUE" || lateInfo.daysOverdue > 0
                                          )}
                                        </Badge>
                                      </div>
                                    </div>

                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
                                      {book.code && <span>{book.code}</span>}
                                      {book.code && bookCopy.code && (
                                        <span className="text-text-subtle select-none" aria-hidden="true">
                                          &bull;
                                        </span>
                                      )}
                                      <span className="font-medium text-text-secondary">
                                        {bookCopy.code}
                                      </span>
                                    </div>

                                    {loanItem.status === "RETURNED" &&
                                      loanItem.returnedAt && (
                                        <p className="mt-2 text-xs font-medium text-emerald-700">
                                          Dikembalikan: {formatDate(loanItem.returnedAt)}
                                        </p>
                                      )}
                                  </div>
                                </>
                              );

                              // Jika bukan staff (Admin / Mode Baca Saja): Tampilan statis non-interaktif tanpa border atau background biru
                              if (!isStaff) {
                                return (
                                  <div
                                    key={loanItem.id}
                                    className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                                      isBorrowed
                                        ? "border-border bg-surface"
                                        : "border-emerald-200 bg-emerald-50/40"
                                    }`}
                                  >
                                    {cardBody}
                                  </div>
                                );
                              }

                              // Jika staff: Tampilan interaktif dengan checkbox dan highlight biru saat dipilih
                              return (
                                <label
                                  key={loanItem.id}
                                  className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${
                                    isBorrowed
                                      ? selected
                                        ? "border-blue-500 bg-blue-50/70 shadow-2xs cursor-pointer"
                                        : "border-border bg-surface hover:border-blue-300 cursor-pointer"
                                      : "border-emerald-200 bg-emerald-50/40 cursor-default"
                                  }`}
                                >
                                  {cardBody}
                                </label>
                              );
                            }
                          )}
                        </div>
                      </div>

                      {/* INLINE ACTION BUTTONS (SINGLE MODAL FLOW) */}
                      {isStaff && (
                        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
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
                            disabled={selectedItemIds.length === 0 || returnLoading}
                            aria-keyshortcuts="Control+Enter Meta+Enter"
                            onClick={() => void handleReturn()}
                          >
                            {selectedItemIds.length > 0
                              ? `Konfirmasi Pengembalian (${selectedItemIds.length} Buku)`
                              : "Pilih Buku untuk Dikembalikan"}
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
                    description="Pilih salah satu transaksi di sebelah kiri atau scan barcode kartu/eksemplar untuk melihat detail buku dan memproses pengembalian."
                  />
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* SINGLE SUCCESS MODAL */}
      <Modal
        open={Boolean(successLoan)}
        onClose={() => setSuccessLoan(null)}
        raw
        size="lg"
        initialFocusRef={successModalCloseRef}
        ariaLabelledBy="return-success-title"
        className="w-full max-w-lg rounded-2xl bg-surface shadow-2xl"
      >
        {successLoan ? (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden="true"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>

                <div>
                  <h2
                    id="return-success-title"
                    className="text-lg font-semibold text-text-main"
                  >
                    Pengembalian Berhasil
                  </h2>

                  <p className="mt-1 text-sm text-text-muted">
                    {lastReturnDetails?.isPartial
                      ? `Pengembalian sebagian berhasil (${lastReturnDetails.remainingCount} buku masih dipinjam).`
                      : "Semua buku telah dikembalikan dan transaksi selesai."}
                  </p>
                </div>
              </div>

              <Button
                ref={successModalCloseRef}
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Tutup pengembalian berhasil"
                onClick={() => setSuccessLoan(null)}
                className="min-h-[32px] min-w-[32px] p-2 text-text-muted hover:bg-surface-muted hover:text-text-secondary"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div>
                  <p className="text-xs text-text-muted">Nomor peminjaman</p>
                  <p className="mt-1 font-semibold text-text-main">
                    {successLoan.loanNumber}
                  </p>
                </div>

                <Badge
                  variant={
                    lastReturnDetails?.isPartial
                      ? "neutral"
                      : "success"
                  }
                >
                  {lastReturnDetails?.isPartial
                    ? "Sebagian Dikembalikan"
                    : "Selesai"}
                </Badge>
              </div>

              {/* Rincian Keterlambatan & Denda di Modal Sukses */}
              {lastReturnDetails && lastReturnDetails.daysOverdue > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-sm">
                  <div className="flex items-center justify-between font-semibold text-red-800">
                    <span className="flex items-center gap-1.5"><svg className="h-4 w-4 text-red-600 shrink-0 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Keterlambatan Pengembalian</span>
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                      {lastReturnDetails.daysOverdue} Hari Terlambat
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-text-muted">Tarif Denda:</span>
                      <p className="font-semibold text-text-main">
                        {dailyFineRate !== null
                          ? `Rp ${dailyFineRate.toLocaleString("id-ID")} / hari / buku`
                          : "Belum dikonfigurasi"}
                      </p>
                    </div>
                    <div>
                      <span className="text-text-muted">Total Denda:</span>
                      <p className="font-bold text-red-600 text-sm">
                        {dailyFineRate !== null
                          ? `Rp ${lastReturnDetails.totalFine.toLocaleString("id-ID")}`
                          : "belum bisa dihitung"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-text-muted">
                    Buku/copy dikembalikan ({returnedCopies.length})
                  </p>
                  <p className="mt-1 font-medium text-text-main">
                    {returnedCopies.join(", ") || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-text-muted">Tanggal pengembalian</p>
                  <p className="mt-1 font-medium text-text-main">
                    {formatDate(
                      successLoan.returnedAt || lastReturnDetails?.returnDate
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-border px-5 py-4">
              <Button type="button" onClick={() => setSuccessLoan(null)}>
                Selesai
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
