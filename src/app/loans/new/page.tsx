"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import { canManageLoans } from "@/lib/authorization";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import DatePicker from "@/components/ui/DatePicker";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";

import {
  searchMembersApi,
  createMemberApi,
  searchBooksApi,
  createBookApi,
  getBookCopiesApi,
  createLoanApi,
  getCompanySettingsApi,
  listLoansApi,
  getErrorMessage,
} from "@/lib/api";
import { masterDataRepository } from "@/lib/master-data/repository";

import type { Book, BookCopy, Loan, Member } from "@/lib/types";
import LoadingState from "@/components/ui/LoadingState";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { useToast } from "@/components/ui/Toast";
import { useSubmitHotkey } from "@/hooks/useHotkeys";

type MemberFormErrors = {
  memberNumber: string;
  name: string;
  phone: string;
  identityNumber: string;
  email: string;
};

const EMPTY_MEMBER_ERRORS: MemberFormErrors = {
  memberNumber: "",
  name: "",
  phone: "",
  identityNumber: "",
  email: "",
};

type BookFormErrors = {
  code: string;
  title: string;
  isbn: string;
  author: string;
  category: string;
  totalCopies: string;
};

const EMPTY_BOOK_ERRORS: BookFormErrors = {
  code: "",
  title: "",
  isbn: "",
  author: "",
  category: "",
  totalCopies: "",
};

const COPY_PAGE_SIZE = 10;

export default function NewLoanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const successModalCloseRef = useRef<HTMLButtonElement>(null);
  const newLoanBtnRef = useRef<HTMLButtonElement>(null);
  const memberModalCloseRef = useRef<HTMLButtonElement>(null);
  const bookModalCloseRef = useRef<HTMLButtonElement>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // =====================================================
  // MEMBER SEARCH
  // =====================================================

  const [memberQuery, setMemberQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageSize, setMemberPageSize] = useState(10);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberTotalPages, setMemberTotalPages] = useState(1);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState("");

  // =====================================================
  // CREATE MEMBER
  // =====================================================

  const [showMemberForm, setShowMemberForm] = useState(false);
  const [showChangeMemberConfirm, setShowChangeMemberConfirm] = useState(false);

  const [memberNumber, setMemberNumber] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberIdentityNumber, setMemberIdentityNumber] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  const [memberFormErrors, setMemberFormErrors] =
    useState<MemberFormErrors>(EMPTY_MEMBER_ERRORS);

  const [memberFormLoading, setMemberFormLoading] = useState(false);

  useEffect(() => {
    if (!showMemberForm) return;

    memberModalCloseRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !memberFormLoading) {
        setShowMemberForm(false);
        setMemberFormErrors(EMPTY_MEMBER_ERRORS);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showMemberForm, memberFormLoading]);

  // =====================================================
  // BOOK SEARCH
  // =====================================================

  const [bookQuery, setBookQuery] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [bookPage, setBookPage] = useState(1);
  const [bookPageSize, setBookPageSize] = useState(10);
  const [bookTotal, setBookTotal] = useState(0);
  const [bookTotalPages, setBookTotalPages] = useState(1);

  const [bookLoading, setBookLoading] = useState(false);
  const [bookError, setBookError] = useState("");

  // =====================================================
  // CREATE BOOK
  // =====================================================

  const [showBookForm, setShowBookForm] = useState(false);
  const [bookCode, setBookCode] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookIsbn, setBookIsbn] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookPublisher, setBookPublisher] = useState("");
  const [bookPublicationYear, setBookPublicationYear] = useState("");
  const [bookCategory, setBookCategory] = useState("");
  const [bookTotalCopies, setBookTotalCopies] = useState("1");
  const [bookFormErrors, setBookFormErrors] =
    useState<BookFormErrors>(EMPTY_BOOK_ERRORS);
  const [bookFormLoading, setBookFormLoading] = useState(false);

  useEffect(() => {
    if (!showBookForm) return;

    bookModalCloseRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !bookFormLoading) {
        setShowBookForm(false);
        setBookFormErrors(EMPTY_BOOK_ERRORS);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showBookForm, bookFormLoading]);

  // =====================================================
  // BOOK COPY
  // =====================================================

  type SelectedBook = {
    book: Book;
    copies: BookCopy[];
    selectedCopyIds: string[];
  };

  const [selectedBooks, setSelectedBooks] = useState<SelectedBook[]>([]);
  const [copyLoadingBookId, setCopyLoadingBookId] = useState<string | null>(
    null,
  );
  const [copyPageByBookId, setCopyPageByBookId] = useState<
    Record<string, number>
  >({});

  // =====================================================
  // SCANNER & BARCODE STATE
  // =====================================================

  const [scanLoading, setScanLoading] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState("");
  const [highlightedBookId, setHighlightedBookId] = useState<string | null>(
    null,
  );

  // =====================================================
  // COMPANY SETTINGS & POLICIES
  // =====================================================

  const [companyName, setCompanyName] = useState(() => {
    if (typeof window !== "undefined") {
      const sess = getSession();
      const u = sess?.user as Record<string, unknown> | undefined;
      const comp = u?.company as { name?: string } | undefined;
      return (typeof u?.companyName === "string" ? u.companyName : comp?.name) || "Perpustakaan";
    }
    return "Perpustakaan";
  });
  const [defaultLoanDuration, setDefaultLoanDuration] = useState<number | null>(null);
  const [maxActiveLoans, setMaxActiveLoans] = useState<number | null>(null);
  const [memberActiveLoanCount, setMemberActiveLoanCount] = useState(0);
  const [memberHasOverdue, setMemberHasOverdue] = useState(false);
  const [memberLoanStatsLoading, setMemberLoanStatsLoading] = useState(false);
  const [memberActiveLoanCounts, setMemberActiveLoanCounts] = useState<Record<string, number>>({});
  const [settingsPending, setSettingsPending] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  function getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getDefaultDueDateString(durationDays: number | null) {
    if (!durationDays || durationDays <= 0) return "";
    const d = new Date();
    d.setDate(d.getDate() + durationDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  async function loadCompanySettings(compId: string) {
    setSettingsError("");
    const settings = await getCompanySettingsApi(compId);
    if (settings) {
      setDefaultLoanDuration(settings.defaultLoanDuration);
      setMaxActiveLoans(settings.maxActiveLoans);
      setBorrowedAt(getTodayString());
      setDueAt(getDefaultDueDateString(settings.defaultLoanDuration));
      setSettingsPending(false);
    } else {
      setDefaultLoanDuration(null);
      setMaxActiveLoans(null);
      setSettingsPending(true);
      setBorrowedAt(getTodayString());
      setDueAt("");
    }
  }

  function formatCopyStatusLabel(status?: string) {
    switch (status) {
      case "AVAILABLE":
        return "Tersedia";
      case "BORROWED":
        return "Dipinjam";
      case "LOST":
        return "Hilang";
      case "DAMAGED":
        return "Rusak";
      case "INACTIVE":
        return "Tidak Aktif";
      default:
        return status || "-";
    }
  }

  // =====================================================
  // DATE
  // =====================================================

  const [borrowedAt, setBorrowedAt] = useState(getTodayString());
  const [dueAt, setDueAt] = useState("");
  const [dateError, setDateError] = useState("");

  // =====================================================
  // SUBMIT
  // =====================================================

  const [submitLoading, setSubmitLoading] = useState(false);
  const [successLoan, setSuccessLoan] = useState<Loan | null>(null);

  // REFS FOR KEYBOARD SCANNER LISTENER (Stabil tanpa re-subscribe)
  const selectedMemberRef = useRef(selectedMember);
  selectedMemberRef.current = selectedMember;
  const showMemberFormRef = useRef(showMemberForm);
  showMemberFormRef.current = showMemberForm;
  const showBookFormRef = useRef(showBookForm);
  showBookFormRef.current = showBookForm;
  const successLoanRef = useRef(successLoan);
  successLoanRef.current = successLoan;
  const scanLoadingRef = useRef(scanLoading);
  scanLoadingRef.current = scanLoading;
  const defaultLoanDurationRef = useRef(defaultLoanDuration);
  defaultLoanDurationRef.current = defaultLoanDuration;
  const maxActiveLoansRef = useRef(maxActiveLoans);
  maxActiveLoansRef.current = maxActiveLoans;
  const settingsPendingRef = useRef(settingsPending);
  settingsPendingRef.current = settingsPending;
  const handleScanCodeRef = useRef(handleScanCode);
  handleScanCodeRef.current = handleScanCode;

  const isLoanValid = Boolean(
    selectedMember &&
    (typeof maxActiveLoans !== "number" || memberActiveLoanCount < maxActiveLoans) &&
    !memberLoanStatsLoading &&
    selectedBooks.length > 0 &&
    selectedBooks.every((item) => item.selectedCopyIds.length > 0) &&
    borrowedAt &&
    dueAt &&
    !dateError &&
    !submitLoading &&
    !successLoan
  );

  useSubmitHotkey(() => void handleSubmitLoan(), {
    enabled: isLoanValid && !showMemberForm && !showBookForm,
    loading: submitLoading,
  });

  useSubmitHotkey(() => void handleCreateMember(), {
    enabled: showMemberForm,
    loading: memberFormLoading,
  });

  useSubmitHotkey(() => void handleCreateBook(), {
    enabled: showBookForm,
    loading: bookFormLoading,
  });

  // =====================================================
  // GLOBAL HARDWARE USB BARCODE SCANNER LISTENER
  // =====================================================

  useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        showMemberFormRef.current ||
        showBookFormRef.current ||
        successLoanRef.current
      ) {
        return;
      }

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

  function formatDate(value: string) {
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);

    return Number.isNaN(date.getTime())
      ? "-"
      : date.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
  }

  function printLoanReceipt(
    loan: Loan,
    member: Member | null,
    booksList: SelectedBook[],
    instansiName: string,
  ) {
    let printFrame = document.getElementById(
      "loan-print-iframe",
    ) as HTMLIFrameElement | null;
    if (!printFrame) {
      printFrame = document.createElement("iframe");
      printFrame.id = "loan-print-iframe";
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      document.body.appendChild(printFrame);
    }

    const frameDoc =
      printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!frameDoc) {
      window.print();
      return;
    }

    const copiesListHtml = booksList
      .map((item) => {
        const selectedCopies = item.copies
          .filter((c) => item.selectedCopyIds.includes(c.id))
          .map((c) => c.code)
          .join(", ");
        return `
          <div style="margin-bottom: 6px;">
            <div style="font-weight: bold; font-size: 13px;">${item.book.title}</div>
            <div style="font-size: 11px; color: #444;">Kode: ${item.book.code} | Eksemplar: ${selectedCopies || "-"}</div>
          </div>
        `;
      })
      .join("");

    const formatReceiptDate = (value: string) => {
      const d = new Date(`${value.slice(0, 10)}T00:00:00`);
      return isNaN(d.getTime())
        ? "-"
        : d.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
    };

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Struk Peminjaman - ${loan.loanNumber}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 4mm;
            }
            body {
              font-family: 'Courier New', Courier, monospace, sans-serif;
              width: 72mm;
              margin: 0 auto;
              padding: 8px 4px;
              color: #000;
              background: #fff;
              font-size: 12px;
              line-height: 1.4;
            }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-top: 2px dashed #000; margin: 6px 0; }
            .title { font-size: 15px; font-weight: bold; text-transform: uppercase; }
            .subtitle { font-size: 11px; margin-top: 2px; }
            .meta-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px; }
            .footer { font-size: 10px; margin-top: 10px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="title">${instansiName}</div>
            <div class="subtitle">BUKTI PEMINJAMAN BUKU</div>
          </div>
          <div class="double-divider"></div>
          <div class="meta-row"><span>No. Peminjaman</span><span class="bold">${loan.loanNumber}</span></div>
          <div class="meta-row"><span>Tanggal Pinjam</span><span>${formatReceiptDate(loan.borrowedAt)}</span></div>
          <div class="meta-row"><span>Jatuh Tempo</span><span class="bold">${formatReceiptDate(loan.dueAt)}</span></div>
          <div class="divider"></div>
          <div class="meta-row"><span>Anggota</span><span class="bold">${member?.name || "-"}</span></div>
          <div class="meta-row"><span>No. Anggota</span><span>${member?.memberNumber || "-"}</span></div>
          <div class="divider"></div>
          <div style="font-weight: bold; margin-bottom: 4px; font-size: 11px;">DAFTAR BUKU:</div>
          ${copiesListHtml}
          <div class="double-divider"></div>
          <div class="footer">
            <div>Simpan struk ini sebagai bukti peminjaman.</div>
            <div>Harap kembalikan buku tepat waktu.</div>
            <div style="margin-top: 4px;">Terima Kasih</div>
          </div>
        </body>
      </html>
    `;

    frameDoc.open();
    frameDoc.write(content);
    frameDoc.close();

    setTimeout(() => {
      printFrame?.contentWindow?.focus();
      printFrame?.contentWindow?.print();
    }, 250);
  }

  function closeSuccessModal() {
    setSuccessLoan(null);
    resetLoanForm();
  }

  useEffect(() => {
    if (!successLoan) return;

    newLoanBtnRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSuccessLoan(null);
        resetLoanForm();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [successLoan]);

  async function loadMemberLoanStats(memberId: string) {
    setMemberLoanStatsLoading(true);
    try {
      const activeRes = await listLoansApi({
        member_id: memberId,
        status: "ACTIVE",
        size: 10,
        skipEnrich: true,
      });
      const activeCount =
        typeof activeRes.total === "number" && activeRes.total >= 0
          ? activeRes.total
          : activeRes.items.length;
      const now = new Date();
      const hasOverdue = activeRes.items.some(
        (it) => it.loan.status === "OVERDUE" || (it.loan.dueAt && new Date(it.loan.dueAt) < now)
      );
      setMemberActiveLoanCount(activeCount);
      setMemberHasOverdue(hasOverdue);
      setMemberActiveLoanCounts((prev) => ({ ...prev, [memberId]: activeCount }));
    } catch (_err) {
      toast.error("Gagal memuat status transaksi aktif anggota dari server.");
    } finally {
      setMemberLoanStatsLoading(false);
    }
  }

  useEffect(() => {
    const session = getSession();

    if (!session) {
      if (!isStoredSessionExpired() && !hasStoredAuth()) {
        router.replace("/login");
      }
      return;
    }

    if (!canManageLoans(session.user.role)) {
      router.replace("/dashboard");
      return;
    }

    const compId = session.user.companyId || "";

    if (compId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Muat konfigurasi durasi dan batas pinjaman instansi saat mount
      loadCompanySettings(compId)
        .catch((_err) => {
          setSettingsError(getErrorMessage(_err, "Gagal memuat konfigurasi peminjaman."));
          setDefaultLoanDuration(null);
          setMaxActiveLoans(null);
          setSettingsPending(true);
          setBorrowedAt(getTodayString());
          setDueAt("");
        })
        .finally(() => {
          setPageLoading(false);
        });
    } else {
      setSettingsPending(true);
      setBorrowedAt(getTodayString());
      setDueAt("");
      setPageLoading(false);
    }
  }, [router]);

  // =====================================================
  // SEARCH MEMBER WITH DEBOUNCE 
  // =====================================================

  useEffect(() => {
    if (selectedMember || showMemberForm) {
      return;
    }

    let cancelled = false;
    const delay = memberQuery.trim().length === 0 ? 0 : 350;

    const timer = window.setTimeout(() => {
      async function loadMembers() {
        const session = getSession();

        if (!session) {
          if (!isStoredSessionExpired() && !hasStoredAuth()) {
            router.replace("/login");
          }
          return;
        }

        setMemberLoading(true);
        setMemberError("");

        try {
          const result = await masterDataRepository.listMembers({
            search: memberQuery.trim(),
            status: "ACTIVE",
            page: memberPage,
            pageSize: memberPageSize,
          });

          if (!cancelled) {
            setMembers(result.data);
            setMemberTotal(result.total);
            setMemberTotalPages(result.totalPages);

            // Fetch kuota transaksi aktif anggota yang tampil di halaman ini secara paralel
            if (result.data.length > 0) {
              void (async () => {
                const counts: Record<string, number> = {};
                await Promise.all(
                  result.data.map(async (m) => {
                    try {
                      const res = await listLoansApi({
                        member_id: m.id,
                        status: "ACTIVE",
                        size: 10,
                        skipEnrich: true,
                      });
                      counts[m.id] =
                        typeof res.total === "number" && res.total >= 0
                          ? res.total
                          : res.items.length;
                    } catch {
                      counts[m.id] = 0;
                    }
                  })
                );
                if (!cancelled) {
                  setMemberActiveLoanCounts((prev) => ({ ...prev, ...counts }));
                }
              })();
            }
          }
        } catch (err: unknown) {
          if (!cancelled) {
            setMemberError(
              getErrorMessage(err, "Data anggota gagal dimuat.")
            );
            setMembers([]);
            setMemberTotal(0);
            setMemberTotalPages(1);
          }
        } finally {
          if (!cancelled) {
            setMemberLoading(false);
          }
        }
      }

      void loadMembers();
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [memberQuery, memberPage, memberPageSize, selectedMember, showMemberForm, router]);

  // =====================================================
  // BOOK SEARCH WITH DEBOUNCE
  // =====================================================

  useEffect(() => {
    if (!selectedMember) {
      return;
    }

    let cancelled = false;
    const delay = bookQuery.trim().length === 0 ? 0 : 350;

    const timer = window.setTimeout(() => {
      async function loadBooks() {
        setBookLoading(true);
        setBookError("");

        try {
          const result = await masterDataRepository.listBooks({
            search: bookQuery.trim(),
            page: bookPage,
            pageSize: bookPageSize,
          });

          if (!cancelled) {
            setBooks(result.data);
            setBookTotal(result.total);
            setBookTotalPages(result.totalPages);
          }
        } catch (err: unknown) {
          if (!cancelled) {
            setBookError(
              getErrorMessage(err, "Data buku gagal dimuat.")
            );
            setBooks([]);
            setBookTotal(0);
            setBookTotalPages(1);
          }
        } finally {
          if (!cancelled) {
            setBookLoading(false);
          }
        }
      }

      void loadBooks();
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bookQuery, bookPage, bookPageSize, selectedMember]);

  // =====================================================
  // SELECT MEMBER
  // =====================================================

  async function handleSelectMember(member: Member): Promise<boolean> {
    if (member.status === "INACTIVE") {
      toast.warning("Anggota tidak aktif dan tidak dapat membuat peminjaman baru.");
      return false;
    }

    // Cek kuota transaksi aktif anggota
    let activeCount = memberActiveLoanCounts[member.id];
    if (typeof activeCount !== "number") {
      try {
        const res = await listLoansApi({
          member_id: member.id,
          status: "ACTIVE",
          size: 10,
          skipEnrich: true,
        });
        activeCount =
          typeof res.total === "number" && res.total >= 0
            ? res.total
            : res.items.length;
        setMemberActiveLoanCounts((prev) => ({ ...prev, [member.id]: activeCount }));
      } catch (_err) {
        toast.error("Gagal memeriksa transaksi aktif anggota dari server. Silakan coba lagi.");
        return false;
      }
    }

    setSelectedMember(member);

    setMembers([]);
    setMemberPage(1);
    setMemberQuery("");
    setMemberError("");

    // Reset pemilihan buku
    setBookQuery("");
    setBooks([]);
    setBookPage(1);
    setSelectedBooks([]);
    setBookError("");

    // Set tanggal pinjam & jatuh tempo otomatis dari pengaturan
    setBorrowedAt(getTodayString());
    const duration = defaultLoanDurationRef.current;
    const isPending = settingsPendingRef.current;
    setDueAt(isPending || duration === null ? "" : getDefaultDueDateString(duration));
    setDateError("");

    // Muat statistik pinjaman aktif & riwayat keterlambatan anggota
    void loadMemberLoanStats(member.id);

    // Reset submit
    setSuccessLoan(null);

    // Scroll ke atas agar langkah 1 & langkah 2 tampil rapi dan tidak terpotong
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    return true;
  }

  // =====================================================
  // VALIDATE MEMBER FORM
  // =====================================================

  function validateMemberForm() {
    const errors: MemberFormErrors = {
      memberNumber: "",
      name: "",
      phone: "",
      identityNumber: "",
      email: "",
    };

    const cleanNumber = memberNumber.trim();
    const name = memberName.trim();
    const phone = memberPhone.trim();
    const identityNumber = memberIdentityNumber.trim();
    const email = memberEmail.trim();

    // Nomor Anggota
    if (!cleanNumber) {
      errors.memberNumber = "Nomor anggota wajib diisi.";
    }

    // Nama
    if (!name) {
      errors.name = "Nama wajib diisi.";
    } else if (name.length < 2) {
      errors.name = "Nama harus terdiri dari minimal 2 karakter.";
    }

    // Nomor HP
    if (!phone) {
      errors.phone = "Nomor HP wajib diisi.";
    } else if (!/^\d+$/.test(phone)) {
      errors.phone = "Nomor HP hanya boleh berisi angka.";
    } else if (phone.length < 10 || phone.length > 15) {
      errors.phone = "Nomor HP harus terdiri dari 10-15 digit.";
    }

    // NIK
    if (!identityNumber) {
      errors.identityNumber = "NIK wajib diisi.";
    } else if (!/^\d+$/.test(identityNumber)) {
      errors.identityNumber = "NIK hanya boleh berisi angka.";
    } else if (identityNumber.length !== 16) {
      errors.identityNumber = "NIK harus terdiri dari 16 digit.";
    }

    // Email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Format email tidak valid.";
    }

    setMemberFormErrors(errors);

    return !Object.values(errors).some(Boolean);
  }

  // =====================================================
  // CREATE MEMBER
  // =====================================================

  async function handleCreateMember(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (memberFormLoading) {
      return;
    }

    const valid = validateMemberForm();

    if (!valid) {
      return;
    }

    setMemberFormLoading(true);

    try {
      const member = await createMemberApi({
        memberNumber: memberNumber.trim(),
        name: memberName.trim(),
        phone: memberPhone.trim(),
        identityNumber: memberIdentityNumber.trim(),
        email: memberEmail.trim() || undefined,
      });

      // Langsung pilih anggota yang baru dibuat
      setSelectedMember(member);

      setShowMemberForm(false);

      // Reset form
      setMemberNumber("");
      setMemberName("");
      setMemberPhone("");
      setMemberIdentityNumber("");
      setMemberEmail("");

      setMemberFormErrors(EMPTY_MEMBER_ERRORS);

      setMembers([]);
      setMemberQuery("");
      toast.success(
        `${member.name} berhasil ditambahkan dan dipilih sebagai anggota.`
      );
    } catch (error) {
      const message = getErrorMessage(error, "Anggota gagal dibuat.");

      const lowerMessage = message.toLowerCase();
      if (
        lowerMessage.includes("nik") ||
        lowerMessage.includes("sudah terdaftar") ||
        lowerMessage.includes("terdaftar")
      ) {
        setMemberFormErrors((current) => ({
          ...current,
          identityNumber: message,
        }));
      } else if (lowerMessage.includes("email")) {
        setMemberFormErrors((current) => ({
          ...current,
          email: message,
        }));
      } else if (
        lowerMessage.includes("nomor hp") ||
        lowerMessage.includes("phone")
      ) {
        setMemberFormErrors((current) => ({
          ...current,
          phone: message,
        }));
      } else {
        setMemberFormErrors((current) => ({
          ...current,
          name: message,
        }));
      }
    } finally {
      setMemberFormLoading(false);
    }
  }

  // =====================================================
  // VALIDATE BOOK FORM
  // =====================================================

  function validateBookForm() {
    const errors: BookFormErrors = {
      code: "",
      title: "",
      isbn: "",
      author: "",
      category: "",
      totalCopies: "",
    };

    const code = bookCode.trim();
    const title = bookTitle.trim();
    const isbn = bookIsbn.trim();
    const totalCopies = Number(bookTotalCopies);

    if (!code) {
      errors.code = "Kode buku wajib diisi.";
    }

    if (!title) {
      errors.title = "Judul buku wajib diisi.";
    } else if (title.length < 2) {
      errors.title = "Judul buku harus terdiri dari minimal 2 karakter.";
    }

    if (isbn && !/^[0-9Xx-]+$/.test(isbn)) {
      errors.isbn = "ISBN hanya boleh berisi angka, tanda hubung, atau X.";
    }

    if (!bookTotalCopies.trim()) {
      errors.totalCopies = "Jumlah eksemplar wajib diisi.";
    } else if (!Number.isInteger(totalCopies) || totalCopies < 1) {
      errors.totalCopies = "Jumlah eksemplar minimal 1.";
    }

    setBookFormErrors(errors);

    return !Object.values(errors).some(Boolean);
  }

  // =====================================================
  // CREATE BOOK
  // =====================================================

  async function handleCreateBook(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (bookFormLoading || !validateBookForm()) return;

    setBookFormLoading(true);
    setBookError("");

    try {
      const book = await createBookApi({
        code: bookCode.trim(),
        title: bookTitle.trim(),
        isbn: bookIsbn.trim() || undefined,
        author: bookAuthor.trim() || undefined,
        publisher: bookPublisher.trim() || undefined,
        publicationYear: bookPublicationYear.trim()
          ? Number(bookPublicationYear)
          : undefined,
        category: bookCategory.trim() || undefined,
        totalCopies: Number(bookTotalCopies),
      });

      setShowBookForm(false);
      setBookFormErrors(EMPTY_BOOK_ERRORS);
      setBookCode("");
      setBookTitle("");
      setBookIsbn("");
      setBookAuthor("");
      setBookPublisher("");
      setBookPublicationYear("");
      setBookCategory("");
      setBookTotalCopies("1");

      setBookQuery("");
      setBooks([book]);
      setBookError("");
      await selectBook(book, true);
      toast.success(
        `${book.title} berhasil ditambahkan dan dipilih untuk peminjaman.`
      );
    } catch (error) {
      const message = getErrorMessage(error, "Buku gagal dibuat.");
      setBookFormErrors((current) => ({ ...current, title: message }));
    } finally {
      setBookFormLoading(false);
    }
  }

  // =====================================================
  // SELECT BOOK
  // =====================================================

  async function selectBook(book: Book, autoSelectFirstCopy = false) {
    if (book.status === "INACTIVE" || book.availableCopies <= 0) {
      return;
    }

    if (selectedBooks.some((item) => item.book.id === book.id)) {
      return;
    }

    setCopyLoadingBookId(book.id);

    try {
      const copies = await getBookCopiesApi(book.id);

      setSelectedBooks((current) => {
        if (current.some((item) => item.book.id === book.id)) {
          return current;
        }

        const availableCopies = copies.filter((c) => c.status === "AVAILABLE");
        const defaultSelected =
          autoSelectFirstCopy && availableCopies.length > 0
            ? [availableCopies[0].id]
            : [];

        return [
          ...current,
          {
            book,
            copies,
            selectedCopyIds: defaultSelected,
          },
        ];
      });
    } catch {
      toast.error(`Eksemplar buku ${book.title} gagal dimuat.`);
    } finally {
      setCopyLoadingBookId(null);
    }
  }

  // =====================================================
  // REMOVE SELECTED BOOK
  // =====================================================

  function removeSelectedBook(bookId: string) {
    setSelectedBooks((current) =>
      current.filter((item) => item.book.id !== bookId),
    );
    setCopyPageByBookId((current) => {
      const updated = { ...current };
      delete updated[bookId];
      return updated;
    });
  }

  // =====================================================
  // TOGGLE BOOK COPY
  // =====================================================

  function toggleCopy(bookId: string, copy: BookCopy) {
    if (copy.status !== "AVAILABLE") {
      return;
    }

    setSelectedBooks((current) =>
      current.map((item) => {
        if (item.book.id !== bookId) {
          return item;
        }

        const selected = item.selectedCopyIds.includes(copy.id);

        return {
          ...item,
          selectedCopyIds: selected
            ? item.selectedCopyIds.filter((id) => id !== copy.id)
            : [...item.selectedCopyIds, copy.id],
        };
      }),
    );
  }

  // =====================================================
  // SCANNER & BARCODE LOOKUP HANDLER
  // =====================================================

  async function handleScanCode(scannedRaw: string) {
    const rawCode = scannedRaw.trim();
    if (!rawCode || scanLoading) return;
    const code = rawCode.toUpperCase();

    setScanLoading(true);
    setLastScannedCode(rawCode);

    // =====================================================
    // STEP 1: SCAN KARTU ANGGOTA (JIKA BELUM PILIH ANGGOTA)
    // =====================================================
    if (!selectedMemberRef.current) {
      try {
        const searchRes = await searchMembersApi(rawCode);
        const candidates = Array.isArray(searchRes) ? searchRes : [];
        const foundMember =
          candidates.find(
            (m) =>
              m.memberNumber.toUpperCase() === code ||
              m.identityNumber?.toUpperCase() === code ||
              m.id.toUpperCase() === code,
          ) || (candidates.length === 1 ? candidates[0] : null);

        if (foundMember) {
          if (foundMember.status === "INACTIVE") {
            toast.warning(
              `Anggota ${foundMember.name} berstatus tidak aktif. Silakan aktifkan terlebih dahulu.`,
            );
            return;
          }
          const selected = await handleSelectMember(foundMember);
          if (selected) {
            toast.success(
              `Anggota ${foundMember.name} (${foundMember.memberNumber}) berhasil dipilih dari scan kartu.`,
            );
          }
        } else {
          toast.error(
            `Anggota dengan nomor kartu / barcode "${rawCode}" tidak ditemukan.`,
          );
        }
      } catch (err: unknown) {
        toast.error(
          getErrorMessage(err, "Gagal memproses kartu anggota.")
        );
      } finally {
        setScanLoading(false);
      }
      return;
    }

    // =====================================================
    // STEP 2: SCAN BUKU & EKSEMPLAR (JIKA ANGGOTA SUDAH TERPILIH)
    // =====================================================
    try {
      // 1. Cek apakah copy sudah ada di daftar buku terpilih saat ini
      const foundInSelected = selectedBooks.find((item) =>
        item.copies.some(
          (c) =>
            c.code.toUpperCase() === code ||
            c.id.toUpperCase() === code ||
            c.code.toUpperCase().replace(/[^A-Z0-9]/g, "") ===
              code.replace(/[^A-Z0-9]/g, ""),
        ),
      );

      if (foundInSelected) {
        const targetCopy = foundInSelected.copies.find(
          (c) =>
            c.code.toUpperCase() === code ||
            c.id.toUpperCase() === code ||
            c.code.toUpperCase().replace(/[^A-Z0-9]/g, "") ===
              code.replace(/[^A-Z0-9]/g, ""),
        );
        if (targetCopy) {
          if (targetCopy.status !== "AVAILABLE") {
            const statusLabel = formatCopyStatusLabel(targetCopy.status);
            toast.warning(
              `Eksemplar ${targetCopy.code} berstatus "${statusLabel}" (tidak dapat dipinjam).`,
            );
            return;
          }
          if (foundInSelected.selectedCopyIds.includes(targetCopy.id)) {
            toast.info(`Eksemplar ${targetCopy.code} sudah terpilih.`);
            return;
          }
          toggleCopy(foundInSelected.book.id, targetCopy);
          toast.success(
            `Eksemplar ${targetCopy.code} (${foundInSelected.book.title}) berhasil dipilih.`,
          );
          return;
        }
      }

      // 2. Ekstrak kandidat kode buku untuk menghindari N+1 loop (misal BK-001-CP-1 -> BK-001)
      const candidatePrefix = code.includes("-CP-")
        ? code.split("-CP-")[0]
        : code.includes("-")
          ? code.substring(0, code.lastIndexOf("-")).trim()
          : code;

      let matchedBook: Book | null = null;
      let matchedCopy: BookCopy | null = null;
      let allLoadedCopies: BookCopy[] = [];

      // A. Cek langsung pada buku yang sedang tampil di layar
      for (const b of books) {
        if (
          b.code.toUpperCase() === code ||
          b.code.toUpperCase() === candidatePrefix ||
          (b.isbn && b.isbn.toUpperCase() === code)
        ) {
          matchedBook = b;
          break;
        }
      }

      // B. Jika belum ada di layar, cari spesifik ke backend menggunakan prefix (1 request saja)
      if (!matchedBook) {
        try {
          const searchResults = await searchBooksApi(candidatePrefix);
          if (searchResults.length > 0) {
            matchedBook =
              searchResults.find(
                (b) =>
                  b.code.toUpperCase() === candidatePrefix ||
                  b.code.toUpperCase() === code,
              ) || null;
          }
        } catch (searchErr: unknown) {
          toast.error(
            getErrorMessage(searchErr, "Gangguan server saat mencari buku.")
          );
          return;
        }
      }

      // C. Jika belum ditemukan dan prefix berbeda dengan kode mentah, cari kode langsung
      if (!matchedBook && candidatePrefix !== code) {
        try {
          const exactResults = await searchBooksApi(code);
          if (exactResults.length > 0) {
            matchedBook = exactResults.find((b) => b.code.toUpperCase() === code || (b.isbn && b.isbn.toUpperCase() === code)) || null;
          }
        } catch (searchErr: unknown) {
          toast.error(
            getErrorMessage(searchErr, "Gangguan server saat mencari buku.")
          );
          return;
        }
      }

      if (!matchedBook) {
        toast.error(`Buku atau eksemplar dengan kode "${rawCode}" tidak ditemukan.`);
        return;
      }

      if (matchedBook.status === "INACTIVE") {
        toast.error(
          `Buku "${matchedBook.title}" berstatus diarsipkan / non-aktif.`,
        );
        return;
      }

      // Ambil copies dari buku yang cocok (Hanya 1 request ke server)
      try {
        allLoadedCopies = await getBookCopiesApi(matchedBook.id);
      } catch (copyErr: unknown) {
        toast.error(
          getErrorMessage(copyErr, `Gagal memuat eksemplar untuk buku "${matchedBook.title}".`)
        );
        return;
      }

      matchedCopy =
        allLoadedCopies.find(
          (c) =>
            c.code.toUpperCase() === code ||
            c.id.toUpperCase() === code ||
            c.code.toUpperCase().replace(/[^A-Z0-9]/g, "") ===
              code.replace(/[^A-Z0-9]/g, ""),
        ) || null;

      const availableCopies = allLoadedCopies.filter(
        (c) => c.status === "AVAILABLE",
      );

      if (availableCopies.length === 0) {
        toast.warning(
          `Semua eksemplar untuk buku "${matchedBook.title}" sedang dipinjam atau tidak tersedia.`,
        );
        return;
      }

      const copyToSelect =
        matchedCopy && matchedCopy.status === "AVAILABLE"
          ? matchedCopy
          : availableCopies[0];

      setSelectedBooks((current) => {
        const existing = current.find((item) => item.book.id === matchedBook!.id);
        if (existing) {
          if (existing.selectedCopyIds.includes(copyToSelect.id)) {
            return current;
          }
          return current.map((item) =>
            item.book.id === matchedBook!.id
              ? {
                  ...item,
                  selectedCopyIds: [...item.selectedCopyIds, copyToSelect.id],
                }
              : item,
          );
        } else {
          return [
            ...current,
            {
              book: matchedBook!,
              copies: allLoadedCopies,
              selectedCopyIds: [copyToSelect.id],
            },
          ];
        }
      });

      // Tambahkan ke daftar buku halaman 1 bila belum ada
      setBooks((prev) => [
        matchedBook!,
        ...prev.filter((b) => b.id !== matchedBook!.id),
      ]);
      setBookPage(1);

      // Highlight scanned book & auto-scroll
      setHighlightedBookId(matchedBook.id);
      setTimeout(() => setHighlightedBookId(null), 3500);

      setTimeout(() => {
        const bookCardEl = document.getElementById(
          `book-card-${matchedBook!.id}`,
        );
        const selectedEl = document.getElementById(
          `selected-book-${matchedBook!.id}`,
        );
        const targetEl = bookCardEl || selectedEl;
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);

      toast.success(
        `Berhasil menambahkan: ${matchedBook.title} (Eksemplar: ${copyToSelect.code})`,
      );
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal memproses scan barcode."));
    } finally {
      setScanLoading(false);
    }
  }

  // =====================================================
  // DATE VALIDATION
  // =====================================================

  function validateDates() {
    setDateError("");

    if (!borrowedAt) {
      setDateError("Tanggal peminjaman wajib diisi.");

      return false;
    }

    if (!dueAt) {
      setDateError("Tanggal jatuh tempo wajib diisi.");

      return false;
    }

    if (dueAt < borrowedAt) {
      setDateError(
        "Tanggal jatuh tempo tidak boleh sebelum tanggal peminjaman.",
      );

      return false;
    }

    return true;
  }

  // =====================================================
  // SUBMIT LOAN
  // =====================================================

  async function handleSubmitLoan() {
    if (submitLoading || successLoan) {
      return;
    }

    if (!selectedMember) {
      setMemberError("Pilih anggota terlebih dahulu.");
      toast.error("Anggota belum dipilih.");
      return;
    }

    if (selectedMember.status !== "ACTIVE") {
      setMemberError("Status anggota tidak aktif.");
      toast.error(
        "Anggota tidak aktif dan tidak dapat membuat peminjaman baru.",
      );
      return;
    }

    if (typeof maxActiveLoans === "number" && memberActiveLoanCount >= maxActiveLoans) {
      setMemberError(`Anggota telah mencapai batas maksimal (${maxActiveLoans} peminjaman aktif).`);
      toast.error(
        `Anggota telah mencapai batas maksimal (${maxActiveLoans} peminjaman aktif). Selesaikan peminjaman sebelumnya terlebih dahulu.`,
      );
      return;
    }

    if (selectedBooks.length === 0) {
      setBookError("Minimal satu buku harus dipilih.");
      toast.error("Minimal satu buku harus dipilih.");
      return;
    }

    const archivedBook = selectedBooks.find(
      (item) => item.book.status === "INACTIVE",
    );

    if (archivedBook) {
      setBookError(`Buku ${archivedBook.book.title} diarsipkan dan tidak dapat dipinjam.`);
      toast.error(
        `Buku ${archivedBook.book.title} diarsipkan dan tidak dapat dipinjam.`,
      );
      return;
    }

    const bookWithoutCopy = selectedBooks.find(
      (item) => item.selectedCopyIds.length === 0,
    );

    if (bookWithoutCopy) {
      setBookError(`Pilih minimal satu eksemplar untuk buku ${bookWithoutCopy.book.title}.`);
      toast.error(
        `Pilih minimal satu eksemplar untuk buku ${bookWithoutCopy.book.title}.`,
      );
      return;
    }

    const invalidSelection = selectedBooks.some((item) => {
      const selectedCopies = item.copies.filter((copy) =>
        item.selectedCopyIds.includes(copy.id),
      );

      return (
        selectedCopies.length !== item.selectedCopyIds.length ||
        selectedCopies.some((copy) => copy.status !== "AVAILABLE")
      );
    });

    if (invalidSelection) {
      toast.error(
        "Ada eksemplar yang sudah tidak tersedia. Silakan periksa kembali pilihan eksemplar buku.",
      );
      return;
    }

    if (!validateDates()) {
      return;
    }

    setSubmitLoading(true);

    try {
      const loan = await createLoanApi({
        memberId: selectedMember.id,
        items: selectedBooks.map((item) => ({
          bookId: item.book.id,
          bookCopyIds: item.selectedCopyIds,
        })),
        borrowedAt,
        dueAt,
      });

      setSuccessLoan(loan);
      toast.success("Peminjaman berhasil dibuat.");
    } catch (error) {
      const message = getErrorMessage(error, "Peminjaman gagal diproses.");
      toast.error(message);
    } finally {
      setSubmitLoading(false);
    }
  }

  // =====================================================
  // RESET MEMBER
  // =====================================================

  function handleChangeMember() {
    if (selectedBooks.length > 0) {
      setShowChangeMemberConfirm(true);
      return;
    }
    executeChangeMember();
  }

  function executeChangeMember() {
    setSelectedMember(null);

    setMemberQuery("");
    setMembers([]);
    setMemberPage(1);
    setMemberError("");

    setBookQuery("");
    setBooks([]);
    setBookPage(1);
    setSelectedBooks([]);

    setBookError("");

    const duration = defaultLoanDurationRef.current;
    const isPending = settingsPendingRef.current;
    setBorrowedAt(getTodayString());
    setDueAt(isPending || duration === null ? "" : getDefaultDueDateString(duration));
    setDateError("");

    setSuccessLoan(null);
    setMemberActiveLoanCount(0);
    setMemberHasOverdue(false);
    setShowChangeMemberConfirm(false);
  }

  function resetLoanForm() {
    setMemberQuery("");
    setMembers([]);
    setMemberPage(1);
    setSelectedMember(null);
    setMemberError("");
    setShowMemberForm(false);
    setMemberName("");
    setMemberPhone("");
    setMemberIdentityNumber("");
    setMemberEmail("");
    setMemberFormErrors(EMPTY_MEMBER_ERRORS);
    setBookQuery("");
    setBooks([]);
    setBookPage(1);
    setSelectedBooks([]);
    setBookError("");
    setCopyLoadingBookId(null);
    const duration = defaultLoanDurationRef.current;
    const isPending = settingsPendingRef.current;
    setBorrowedAt(getTodayString());
    setDueAt(isPending || duration === null ? "" : getDefaultDueDateString(duration));
    setDateError("");
    setSuccessLoan(null);
    setMemberActiveLoanCount(0);
    setMemberHasOverdue(false);
    setLastScannedCode("");
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <LoadingState label="Memuat peminjaman..." />
      </div>
    );
  }
  // =====================================================
  // RENDER
  // =====================================================

  const isMaxActiveLoansReached = Boolean(
    selectedMember &&
      !memberLoanStatsLoading &&
      typeof maxActiveLoans === "number" &&
      memberActiveLoanCount >= maxActiveLoans
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="page-container py-6">
        {/* =================================================
            TITLE & SCANNER STATUS
        ================================================= */}

        <div className="mb-6">
          <PageHeader
            backLink="/dashboard"
            title="Catat Peminjaman"
            description="Pilih anggota, buku, eksemplar buku, dan tanggal peminjaman."
            actions={
              <div className="flex items-center gap-2.5 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm sm:self-auto">
                <span className="relative flex h-2.5 w-2.5">
                  {scanLoading ? (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  ) : (
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  )}
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  {scanLoading ? "Memproses Barcode..." : "Scanner Siap"}
                </span>
                {lastScannedCode && (
                  <span className="border-l border-slate-200 pl-2.5 text-xs text-slate-500">
                    Kode Terakhir: <code className="font-mono font-medium text-slate-800">{lastScannedCode}</code>
                  </span>
                )}
              </div>
            }
          />
        </div>

        {/* BANNER MENUNGGU BACKEND (SETTINGS BELUM DIKONFIGURASI) */}
        {settingsPending && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <div className="flex items-center gap-2 font-bold text-sm">
              <svg className="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p>{settingsError ? "Gagal memuat konfigurasi peminjaman" : "Konfigurasi peminjaman belum diatur oleh administrator"}</p>
            </div>
            <p className="mt-1 text-xs text-amber-800">
              {settingsError || "Tanggal jatuh tempo pinjaman kosong dan wajib diisi secara manual oleh pustakawan."}
            </p>
            {settingsError && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void loadCompanySettings(getSession()?.user.companyId || "").catch((err: unknown) => setSettingsError(getErrorMessage(err, "Gagal memuat konfigurasi peminjaman.")))}
                className="mt-2 h-auto p-0 text-xs font-semibold underline text-amber-900 hover:text-amber-950 hover:bg-transparent"
              >
                Coba lagi
              </Button>
            )}
          </div>
        )}

        {/* =================================================
            1. MEMBER
        ================================================= */}

        <div
          className={`${successLoan ? "pointer-events-none opacity-60" : ""} grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.85fr)] xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)] lg:items-start`}
        >
          <div className="min-w-0">
            <Card className="p-4 sm:p-5">
              <h2 className="text-base font-semibold text-slate-900">
                1. Cari Anggota
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Cari berdasarkan nama, nomor anggota, NIK, atau nomor HP.
              </p>

              {!selectedMember && (
                <>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <div className="flex-1">
                      <Input
                        id="member-search"
                        label="Anggota"
                        value={memberQuery}
                        onChange={(event) => {
                          setMemberQuery(event.target.value);
                          setMemberPage(1);
                          setMemberError("");
                        }}
                        placeholder="Cari nama, nomor anggota, NIK, atau nomor HP..."
                      />
                    </div>
                  </div>

                  {memberError && (
                    <p role="alert" className="mt-4 text-sm text-red-600">
                      {memberError}
                    </p>
                  )}

                  {/* HASIL MEMBER */}

                  {!memberLoading &&
                    memberQuery.trim() &&
                    members.length === 0 &&
                    !memberError &&
                    !showMemberForm && (
                      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="font-medium text-slate-800">
                          Anggota tidak ditemukan
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Anggota belum ditemukan. Anda dapat membuat anggota
                          baru.
                        </p>

                        <Button
                          type="button"
                          variant="secondary"
                          className="mt-3"
                          onClick={() => {
                            setShowMemberForm(true);
                            setMemberFormErrors(EMPTY_MEMBER_ERRORS);
                          }}
                        >
                          Buat Anggota Baru
                        </Button>
                      </div>
                    )}

                  {members.length > 0 && (
                    <div className="mt-5 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-700">
                          {memberQuery.trim()
                            ? "Hasil pencarian"
                            : "Daftar anggota"}
                        </h3>

                        <p className="shrink-0 text-xs text-slate-500">
                          {memberTotal > 0 ? `${memberTotal} anggota` : `${members.length} anggota`}
                        </p>
                      </div>

                      {members.map((member) => {
                        const inactive = member.status === "INACTIVE";
                        const activeCount = memberActiveLoanCounts[member.id];
                        const reachedMax =
                          typeof activeCount === "number" && typeof maxActiveLoans === "number" && activeCount >= maxActiveLoans;
                        const isDisabled = inactive || reachedMax;

                        return (
                          <Button
                            key={member.id}
                            type="button"
                            variant="ghost"
                            disabled={isDisabled}
                            onClick={() => void handleSelectMember(member)}
                            className={`w-full h-auto rounded-lg border p-3 sm:px-4 sm:py-3 text-left justify-start font-normal transition ${
                              inactive
                                ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                                : reachedMax
                                ? "cursor-not-allowed border-amber-200 bg-amber-50/50 text-slate-700 hover:bg-amber-50/50"
                                : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                            }`}
                          >
                            <div className="flex w-full items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p
                                    className={`truncate font-semibold ${
                                      inactive
                                        ? "text-slate-400"
                                        : reachedMax
                                        ? "text-slate-700"
                                        : "text-slate-900"
                                    }`}
                                  >
                                    {member.name}
                                  </p>

                                  {typeof activeCount === "number" && (
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                        reachedMax
                                          ? "bg-amber-100 text-amber-900 font-semibold"
                                          : "bg-slate-100 text-slate-600"
                                      }`}
                                    >
                                      {activeCount}/{maxActiveLoans ?? "∞"} Transaksi Aktif
                                    </span>
                                  )}
                                </div>

                                <p
                                  className={`mt-1 truncate text-sm ${
                                    inactive
                                      ? "text-slate-400"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {member.memberNumber} <span className="mx-1 select-none text-slate-300" aria-hidden="true">&bull;</span> {member.phone || "-"}
                                </p>

                                {inactive ? (
                                  <p className="mt-1 text-xs font-medium text-slate-500">
                                    Anggota tidak aktif dan tidak dapat membuat peminjaman baru.
                                  </p>
                                ) : reachedMax ? (
                                  <p className="mt-1 text-xs font-medium text-amber-800">
                                    Sudah mencapai batas maksimal {maxActiveLoans} transaksi aktif. Selesaikan atau kembalikan pinjaman sebelumnya terlebih dahulu.
                                  </p>
                                ) : null}
                              </div>

                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                                  inactive
                                    ? "bg-slate-200 text-slate-500"
                                    : reachedMax
                                    ? "bg-amber-100 text-amber-900 font-semibold border border-amber-200"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {inactive
                                  ? "Tidak aktif"
                                  : reachedMax
                                  ? "Maks Transaksi"
                                  : "Pilih Anggota"}
                              </span>
                            </div>
                          </Button>
                        );
                      })}

                      {/* MEMBER PAGINATION (MOBILE, TABLET & DESKTOP) */}
                      <Pagination
                        currentPage={memberPage}
                        totalPages={memberTotalPages}
                        onPageChange={(nextPage) => setMemberPage(nextPage)}
                        totalItems={memberTotal}
                        pageSize={memberPageSize}
                        onPageSizeChange={(newSize) => {
                          setMemberPageSize(newSize);
                          setMemberPage(1);
                        }}
                        className="mt-4 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 rounded-b-xl border-t"
                      />
                    </div>
                  )}
                </>
              )}

              {/* SELECTED MEMBER */}

              {selectedMember && (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">
                          {selectedMember.name}
                        </p>
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          {selectedMember.status === "ACTIVE"
                            ? "Anggota Aktif"
                            : "Tidak Aktif"}
                        </span>
                        {memberLoanStatsLoading ? (
                          <span className="text-xs text-slate-500 animate-pulse">
                            (Memeriksa transaksi aktif...)
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-600">
                            (Transaksi Aktif: {memberActiveLoanCount}/{maxActiveLoans ?? "∞"})
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {selectedMember.memberNumber} <span className="mx-1 select-none text-slate-300" aria-hidden="true">&bull;</span> {selectedMember.phone || "-"}
                      </p>

                      {/* WARNING KUOTA MAKSIMAL TRANSAKSI AKTIF */}
                      {isMaxActiveLoansReached && (
                        <div className="mt-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900" role="alert">
                          <span className="font-semibold">Batas Kuota Tercapai:</span> Anggota ini telah mencapai batas {maxActiveLoans} peminjaman aktif. Selesaikan peminjaman sebelumnya terlebih dahulu.
                        </div>
                      )}

                      {/* WARNING TERLAMBAT */}
                      {memberHasOverdue && (
                        <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-900">
                          <span className="font-semibold">Peringatan:</span> Anggota memiliki riwayat pinjaman buku yang terlambat dikembalikan!
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleChangeMember}
                      className="shrink-0"
                    >
                      Ganti Anggota
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* =================================================
            CREATE MEMBER
        ================================================= */}

            <Modal
              open={Boolean(showMemberForm && !selectedMember)}
              onClose={() => {
                if (!memberFormLoading) {
                  setShowMemberForm(false);
                  setMemberFormErrors(EMPTY_MEMBER_ERRORS);
                }
              }}
              raw
              size="xl"
              initialFocusRef={memberModalCloseRef}
              ariaLabelledBy="create-member-title"
              className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
            >
              {showMemberForm && !selectedMember && (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div>
                      <h3
                        id="create-member-title"
                        className="text-lg font-semibold text-slate-900"
                      >
                        Buat Anggota Baru
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Isi data anggota untuk melanjutkan peminjaman.
                      </p>
                    </div>

                    <Button
                      ref={memberModalCloseRef}
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Tutup form anggota baru"
                      disabled={memberFormLoading}
                      onClick={() => {
                        setShowMemberForm(false);
                        setMemberFormErrors(EMPTY_MEMBER_ERRORS);
                      }}
                      className="min-h-[32px] min-w-[32px] p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>

                  <form
                    onSubmit={handleCreateMember}
                    className="grid gap-3.5 p-5 sm:grid-cols-2"
                  >
                    <Input
                      id="member-number"
                      label="Nomor Anggota"
                      value={memberNumber}
                      onChange={(event) => {
                        setMemberNumber(event.target.value);

                        if (memberFormErrors.memberNumber) {
                          setMemberFormErrors((current) => ({
                            ...current,
                            memberNumber: "",
                          }));
                        }
                      }}
                      error={memberFormErrors.memberNumber}
                      placeholder="Contoh: MBR-001 (Wajib diisi)"
                      required
                    />

                    <Input
                      id="member-name"
                      label="Nama"
                      value={memberName}
                      onChange={(event) => {
                        setMemberName(event.target.value);

                        if (memberFormErrors.name) {
                          setMemberFormErrors((current) => ({
                            ...current,
                            name: "",
                          }));
                        }
                      }}
                      error={memberFormErrors.name}
                      autoComplete="name"
                      required
                    />

                    <Input
                      id="member-phone"
                      label="Nomor HP"
                      type="tel"
                      inputMode="numeric"
                      maxLength={15}
                      value={memberPhone}
                      onChange={(event) => {
                        const value = event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 15);

                        setMemberPhone(value);

                        if (memberFormErrors.phone) {
                          setMemberFormErrors((current) => ({
                            ...current,
                            phone: "",
                          }));
                        }
                      }}
                      error={memberFormErrors.phone}
                      placeholder="08xxxxxxxxxx"
                      autoComplete="tel"
                      required
                    />

                    <Input
                      id="member-identity-number"
                      label="NIK"
                      type="text"
                      inputMode="numeric"
                      maxLength={16}
                      value={memberIdentityNumber}
                      onChange={(event) => {
                        const value = event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 16);

                        setMemberIdentityNumber(value);

                        if (memberFormErrors.identityNumber) {
                          setMemberFormErrors((current) => ({
                            ...current,
                            identityNumber: "",
                          }));
                        }
                      }}
                      error={memberFormErrors.identityNumber}
                      placeholder="16 digit NIK"
                      required
                    />

                    <Input
                      id="member-email"
                      label="Email (opsional)"
                      type="email"
                      value={memberEmail}
                      onChange={(event) => {
                        setMemberEmail(event.target.value);

                        if (memberFormErrors.email) {
                          setMemberFormErrors((current) => ({
                            ...current,
                            email: "",
                          }));
                        }
                      }}
                      error={memberFormErrors.email}
                      placeholder="nama@email.com"
                      autoComplete="email"
                    />

                    <div className="mt-1 flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={memberFormLoading}
                        onClick={() => {
                          setShowMemberForm(false);
                          setMemberFormErrors(EMPTY_MEMBER_ERRORS);
                        }}
                      >
                        Batal
                      </Button>

                      <Button
                        type="submit"
                        loading={memberFormLoading}
                        aria-keyshortcuts="Control+Enter Meta+Enter"
                      >
                        Simpan Anggota
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </Modal>

            {/* =================================================
            2. BOOK
        ================================================= */}

            {selectedMember && (
              <Card className="mt-5 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900">
                      2. Pilih Buku
                    </h3>
                    <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                      Cari buku atau arahkan scanner USB.
                    </p>
                  </div>
                </div>

                {/* WARNING KUOTA MAKSIMAL PINJAMAN AKTIF PADA SECTION PILIH BUKU */}
                {isMaxActiveLoansReached && (
                  <div className="mt-3.5 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900" role="alert">
                    <span className="font-semibold">Peminjaman Dikunci:</span> Anggota ini telah mencapai batas {maxActiveLoans} peminjaman aktif. Pemilihan buku dinonaktifkan.
                  </div>
                )}

                {/* SEARCH BOOK */}
                <div className="mt-4">
                  <Input
                    id="book-search"
                    label="Cari Buku"
                    value={bookQuery}
                    onChange={(event) => {
                      setBookQuery(event.target.value);
                      setBookPage(1);
                    }}
                    placeholder="Cari judul, kode, atau ISBN..."
                  />
                </div>
                {/* RESET SEARCH */}

                {bookQuery.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBookQuery("");
                      setBookPage(1);
                    }}
                    className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700 p-0 h-auto min-h-0"
                  >
                    Tampilkan semua buku
                  </Button>
                )}

                {bookError && (
                  <p role="alert" className="mt-4 text-sm text-red-600">
                    {bookError}
                  </p>
                )}

                {/* LOADING */}

                {bookLoading && (
                  <p className="mt-5 text-sm text-slate-500">
                    Memuat daftar buku...
                  </p>
                )}

                {/* EMPTY */}

                {!bookLoading &&
                  books.length === 0 &&
                  !bookError &&
                  !showBookForm && (
                    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="font-medium text-slate-800">
                        {bookQuery.trim()
                          ? "Buku tidak ditemukan"
                          : "Tidak ada buku tersedia"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {bookQuery.trim()
                          ? "Buku belum ditemukan. Anda dapat membuat buku baru."
                          : "Saat ini tidak ada buku yang dapat dipinjam. Anda dapat membuat buku baru."}
                      </p>

                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-3"
                        disabled={isMaxActiveLoansReached}
                        onClick={() => {
                          setShowBookForm(true);
                          setBookFormErrors(EMPTY_BOOK_ERRORS);
                          if (bookQuery.trim()) {
                            setBookTitle(bookQuery.trim());
                          }
                        }}
                      >
                        Buat Buku Baru
                      </Button>
                    </div>
                  )}

                {/* =================================================
                CREATE BOOK MODAL
              ================================================= */}

                <Modal
                  open={showBookForm}
                  onClose={() => {
                    if (!bookFormLoading) {
                      setShowBookForm(false);
                      setBookFormErrors(EMPTY_BOOK_ERRORS);
                    }
                  }}
                  raw
                  size="2xl"
                  initialFocusRef={bookModalCloseRef}
                  ariaLabelledBy="create-book-title"
                  className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"
                >
                  {showBookForm && (
                    <>
                      {/* HEADER */}
                      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                        <div>
                          <h3
                            id="create-book-title"
                            className="text-lg font-semibold text-slate-900"
                          >
                            Tambah Buku Baru
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            Isi data buku dan jumlah eksemplar awal.
                          </p>
                        </div>

                        <Button
                          ref={bookModalCloseRef}
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label="Tutup form buku baru"
                          disabled={bookFormLoading}
                          onClick={() => {
                            setShowBookForm(false);
                            setBookFormErrors(EMPTY_BOOK_ERRORS);
                          }}
                          className="min-h-[32px] min-w-[32px] p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>

                      {/* FORM */}
                      <form
                        onSubmit={handleCreateBook}
                        className="grid gap-3.5 p-5 sm:grid-cols-2"
                      >
                        {/* KODE BUKU */}
                        <Input
                          id="book-code"
                          label="Kode Buku"
                          value={bookCode}
                          onChange={(event) => {
                            setBookCode(event.target.value.toUpperCase());

                            if (bookFormErrors.code) {
                              setBookFormErrors((current) => ({
                                ...current,
                                code: "",
                              }));
                            }
                          }}
                          error={bookFormErrors.code}
                          placeholder="Contoh: LP"
                          autoComplete="off"
                          required
                        />

                        {/* JUDUL BUKU */}
                        <Input
                          id="book-title"
                          label="Judul Buku"
                          value={bookTitle}
                          onChange={(event) => {
                            setBookTitle(event.target.value);

                            if (bookFormErrors.title) {
                              setBookFormErrors((current) => ({
                                ...current,
                                title: "",
                              }));
                            }
                          }}
                          error={bookFormErrors.title}
                          placeholder="Masukkan judul buku"
                          required
                        />

                        {/* ISBN */}
                        <Input
                          id="book-isbn"
                          label="ISBN (opsional)"
                          value={bookIsbn}
                          onChange={(event) => {
                            setBookIsbn(event.target.value);

                            if (bookFormErrors.isbn) {
                              setBookFormErrors((current) => ({
                                ...current,
                                isbn: "",
                              }));
                            }
                          }}
                          error={bookFormErrors.isbn}
                          placeholder="978-..."
                          autoComplete="off"
                        />

                        {/* PENGARANG */}
                        <Input
                          id="book-author"
                          label="Pengarang (opsional)"
                          value={bookAuthor}
                          onChange={(event) => {
                            setBookAuthor(event.target.value);

                            if (bookFormErrors.author) {
                              setBookFormErrors((current) => ({
                                ...current,
                                author: "",
                              }));
                            }
                          }}
                          error={bookFormErrors.author}
                          placeholder="Nama pengarang"
                        />

                        {/* KATEGORI */}
                        <Input
                          id="book-category"
                          label="Kategori (opsional)"
                          value={bookCategory}
                          onChange={(event) => {
                            setBookCategory(event.target.value);

                            if (bookFormErrors.category) {
                              setBookFormErrors((current) => ({
                                ...current,
                                category: "",
                              }));
                            }
                          }}
                          error={bookFormErrors.category}
                          placeholder="Contoh: Fiksi"
                        />

                        {/* JUMLAH EKSEMPLAR */}
                        <Input
                          id="book-total-copies"
                          label="Jumlah Eksemplar Awal"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={bookTotalCopies}
                          onChange={(event) => {
                            setBookTotalCopies(event.target.value);

                            if (bookFormErrors.totalCopies) {
                              setBookFormErrors((current) => ({
                                ...current,
                                totalCopies: "",
                              }));
                            }
                          }}
                          error={bookFormErrors.totalCopies}
                          placeholder="Minimal 1"
                          required
                        />

                        {/* INFO COPY */}
                        <div className="sm:col-span-2">
                          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                            <p className="text-sm font-medium text-blue-900">
                              Kode eksemplar dibuat otomatis
                            </p>

                            <p className="mt-1 text-xs leading-5 text-blue-700">
                              Sistem akan membuat kode eksemplar secara berurutan
                              berdasarkan kode buku. Contoh: LP-001, LP-002,
                              LP-003.
                            </p>
                          </div>
                        </div>

                        {/* ACTION */}
                        <div className="mt-1 flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={bookFormLoading}
                            onClick={() => {
                              setShowBookForm(false);
                              setBookFormErrors(EMPTY_BOOK_ERRORS);
                            }}
                          >
                            Batal
                          </Button>

                          <Button
                            type="submit"
                            loading={bookFormLoading}
                            aria-keyshortcuts="Control+Enter Meta+Enter"
                          >
                            Simpan Buku
                          </Button>
                        </div>
                      </form>
                    </>
                  )}
                </Modal>

                {/* BOOK LIST */}

                {!bookLoading && books.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-700">
                        {bookQuery.trim() ? "Hasil pencarian" : "Daftar buku"}
                      </h4>

                      <p className="shrink-0 text-xs text-slate-500">
                        {bookTotal > 0 ? `${bookTotal} buku` : `${books.length} buku`}
                      </p>
                    </div>

                    {books.map((book) => {
                      const archived = book.status === "INACTIVE";
                      const unavailable = archived || book.availableCopies <= 0;
                      const selectedItem = selectedBooks.find(
                        (item) => item.book.id === book.id,
                      );
                      const selected = Boolean(selectedItem);
                      const loading = copyLoadingBookId === book.id;
                      const isHighlighted = highlightedBookId === book.id;

                      return (
                        <div
                          key={book.id}
                          id={`book-card-${book.id}`}
                          className={`rounded-xl border p-4 transition-all duration-300 ${
                            isHighlighted
                              ? "border-blue-500 bg-blue-50/90 ring-4 ring-blue-500/30 shadow-md scale-[1.01]"
                              : selected
                                ? "border-blue-400 bg-blue-50/60"
                                : unavailable
                                  ? "border-slate-200 bg-slate-50"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center">
                            {/* INFO BUKU */}
                            <div className="min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                {/* Judul + detail */}
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`truncate text-sm sm:text-base font-semibold ${
                                      archived
                                        ? "text-slate-400"
                                        : "text-slate-900"
                                    }`}
                                    title={book.title}
                                  >
                                    {book.title}
                                  </p>

                                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                    <p>
                                      <span className="text-slate-500">
                                        Penulis:
                                      </span>{" "}
                                      <span className="font-medium text-slate-700">
                                        {book.author || "-"}
                                      </span>
                                    </p>

                                    <span className="text-slate-300 select-none" aria-hidden="true">&bull;</span>

                                    <p>
                                      <span className="text-slate-500">
                                        ISBN:
                                      </span>{" "}
                                      <span className="font-medium text-slate-700">
                                        {book.isbn || "-"}
                                      </span>
                                    </p>
                                  </div>

                                  {archived && (
                                    <p className="mt-1.5 text-xs font-medium text-slate-500">
                                      Buku diarsipkan dan tidak dapat dipinjam.
                                    </p>
                                  )}
                                </div>

                                {/* KODE BUKU + BADGE */}
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <span className="font-semibold text-xs text-slate-700">
                                    {book.code}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      archived
                                        ? "bg-slate-200 text-slate-500"
                                        : "bg-emerald-50 text-emerald-700"
                                    }`}
                                  >
                                    {archived ? "Diarsipkan" : "Aktif"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* COPY INFO + ACTION */}
                            <div className="border-t border-slate-100 pt-3 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
                              <div className="grid grid-cols-[1fr_1fr_auto] xl:grid-cols-2 gap-2 items-center">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-center">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Total eksemplar
                                  </p>
                                  <p className="mt-0.5 text-base font-bold leading-none text-slate-900">
                                    {book.totalCopies}
                                  </p>
                                </div>

                                <div
                                  className={`rounded-lg border px-2.5 py-1.5 text-center ${
                                    book.availableCopies > 0
                                      ? "border-emerald-100 bg-emerald-50"
                                      : "border-red-100 bg-red-50"
                                  }`}
                                >
                                  <p
                                    className={`text-[11px] font-semibold uppercase tracking-wide ${
                                      book.availableCopies > 0
                                        ? "text-emerald-600"
                                        : "text-red-500"
                                    }`}
                                  >
                                    Tersedia
                                  </p>
                                  <p
                                    className={`mt-0.5 text-base font-bold leading-none ${
                                      book.availableCopies > 0
                                        ? "text-emerald-700"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {book.availableCopies}
                                  </p>
                                </div>

                                <Button
                                  type="button"
                                  variant={selected ? "secondary" : "primary"}
                                  disabled={unavailable || selected || loading || isMaxActiveLoansReached}
                                  onClick={() => void selectBook(book, true)}
                                  className="min-w-[80px] xl:col-span-2 xl:w-full h-9 text-xs font-semibold"
                                >
                                  {loading ? (
                                    <span className="inline-flex items-center justify-center gap-1.5">
                                      <span
                                        aria-hidden="true"
                                        className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
                                      />
                                      Memuat...
                                    </span>
                                  ) : archived ? (
                                    "Diarsipkan"
                                  ) : unavailable ? (
                                    "Habis"
                                  ) : selected ? (
                                    "Dipilih"
                                  ) : (
                                    "Pilih"
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>

                          {unavailable && (
                            <p
                              className={`mt-3 rounded-md px-3 py-2 text-xs font-medium ${
                                archived
                                  ? "bg-slate-100 text-slate-500"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {archived
                                ? "Buku diarsipkan dan tidak dapat dipinjam."
                                : "Tidak ada eksemplar yang tersedia untuk dipinjam."}
                            </p>
                          )}

                          {selectedItem && (
                            <div className="mt-4 border-t border-blue-200 pt-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    Pilih eksemplar buku
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Pilih satu atau lebih eksemplar yang tersedia.
                                  </p>
                                </div>

                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => removeSelectedBook(book.id)}
                                >
                                  Batal pilih
                                </Button>
                              </div>

                              {selectedItem.copies.length === 0 ? (
                                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-center">
                                  <p className="text-xs sm:text-sm font-medium text-slate-600">
                                    Tidak ada eksemplar buku yang tersedia.
                                  </p>
                                </div>
                              ) : (() => {
                                const currentCopyPage =
                                  copyPageByBookId[book.id] || 1;
                                const copyTotalPages = Math.ceil(
                                  selectedItem.copies.length / COPY_PAGE_SIZE,
                                );
                                const safeCopyPage = Math.min(
                                  Math.max(1, currentCopyPage),
                                  copyTotalPages,
                                );
                                const paginatedCopies =
                                  selectedItem.copies.slice(
                                    (safeCopyPage - 1) * COPY_PAGE_SIZE,
                                    safeCopyPage * COPY_PAGE_SIZE,
                                  );

                                return (
                                  <>
                                    <div className="mt-3 grid gap-2 grid-cols-1 xl:grid-cols-2">
                                      {paginatedCopies.map((copy) => {
                                        const unavailableCopy =
                                          copy.status !== "AVAILABLE";
                                        const copyDisabled =
                                          unavailableCopy || isMaxActiveLoansReached;
                                        const checked =
                                          selectedItem.selectedCopyIds.includes(
                                            copy.id,
                                          );

                                        return (
                                          <label
                                            key={copy.id}
                                            className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 transition ${
                                              copyDisabled
                                                ? "cursor-not-allowed bg-slate-50 opacity-60 border-slate-200"
                                                : checked
                                                  ? "border-blue-500 bg-blue-50/50 cursor-pointer ring-1 ring-blue-200"
                                                  : "border-slate-200 bg-white hover:border-slate-300 cursor-pointer"
                                            }`}
                                          >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={copyDisabled}
                                                onChange={() =>
                                                  toggleCopy(book.id, copy)
                                                }
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                                              />
                                              <p className="truncate text-xs sm:text-sm font-semibold text-slate-800">
                                                {copy.code}
                                              </p>
                                            </div>

                                            <span
                                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                copy.status === "AVAILABLE"
                                                  ? "bg-emerald-50 text-emerald-700"
                                                  : copy.status === "BORROWED"
                                                    ? "bg-amber-50 text-amber-700"
                                                    : copy.status === "INACTIVE"
                                                      ? "bg-slate-100 text-slate-500"
                                                      : "bg-red-50 text-red-600"
                                              }`}
                                            >
                                              {copy.status === "AVAILABLE"
                                                ? "Tersedia"
                                                : copy.status === "BORROWED"
                                                  ? "Dipinjam"
                                                  : copy.status === "INACTIVE"
                                                    ? "Tidak aktif"
                                                    : "Hilang"}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>

                                    {/* COPIES PAGINATION (WHEN > 5 COPIES) */}
                                    {copyTotalPages > 1 && (
                                      <div className="mt-2.5 pt-2 border-t border-blue-100/80">
                                        <Pagination
                                          compact
                                          currentPage={safeCopyPage}
                                          totalPages={copyTotalPages}
                                          onPageChange={(nextPage) =>
                                            setCopyPageByBookId((prev) => ({
                                              ...prev,
                                              [book.id]: nextPage,
                                            }))
                                          }
                                          totalItems={selectedItem.copies.length}
                                          pageSize={COPY_PAGE_SIZE}
                                          className="bg-transparent border-t-0 px-0 py-0"
                                        />
                                      </div>
                                    )}
                                  </>
                                );
                              })()}

                              <p className="mt-3 text-xs sm:text-sm text-slate-600">
                                Eksemplar dipilih:{" "}
                                <span className="font-semibold text-blue-700">
                                  {selectedItem.selectedCopyIds.length}
                                </span>{" "}
                                dari {selectedItem.copies.length} eksemplar
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* BOOK PAGINATION (MOBILE, TABLET & DESKTOP) */}
                    <Pagination
                      currentPage={bookPage}
                      totalPages={bookTotalPages}
                      onPageChange={(nextPage) => setBookPage(nextPage)}
                      totalItems={bookTotal}
                      pageSize={bookPageSize}
                      onPageSizeChange={(newSize) => {
                        setBookPageSize(newSize);
                        setBookPage(1);
                      }}
                      className="mt-4 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 rounded-b-xl border-t"
                    />
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* =================================================
              KOLOM KANAN: RINGKASAN & SUBMIT
          ================================================= */}

          <div className="min-w-0 lg:sticky lg:top-20 lg:self-start space-y-5">
            {/* CARD 1: INFORMASI BUKU TERPILIH */}
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900">
                  Buku yang Dipilih
                </h3>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {selectedBooks.length} Buku
                </span>
              </div>

              {selectedBooks.length === 0 ? (
                <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-4 text-center">
                  <p className="text-xs text-slate-500">
                    Belum ada buku yang dipilih. Pilih atau scan barcode buku di langkah 2.
                  </p>
                </div>
              ) : (
                <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {selectedBooks.map((item) => {
                    const selectedCopies = item.copies
                      .filter((copy) => item.selectedCopyIds.includes(copy.id))
                      .map((copy) => copy.code);

                    const isHighlighted = highlightedBookId === item.book.id;

                    return (
                      <div
                        key={item.book.id}
                        id={`selected-book-${item.book.id}`}
                        className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
                          isHighlighted ? "bg-blue-50/80 ring-2 ring-blue-500/40" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {item.book.title}
                            </p>
                            <span className="shrink-0 text-xs text-slate-500">
                              {item.book.code}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {item.selectedCopyIds.length > 0
                              ? `${item.selectedCopyIds.length} eksemplar - ${selectedCopies.join(", ")}`
                              : "Belum memilih eksemplar"}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Batal pilih ${item.book.title}`}
                          title="Batal pilih"
                          onClick={() => removeSelectedBook(item.book.id)}
                          className="h-8 w-8 min-h-0 min-w-0 p-0 text-slate-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* CARD 2: TANGGAL PEMINJAMAN */}
            <Card className="p-4 sm:p-5">
              <h3 className="text-base font-semibold text-slate-900">
                3. Tanggal Peminjaman
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {settingsPending || defaultLoanDuration === null
                  ? "Durasi pinjam belum dikonfigurasi di sistem. Pilih tanggal jatuh tempo secara manual."
                  : `Tanggal pinjam otomatis hari ini & durasi standar ${defaultLoanDuration} hari.`}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DatePicker
                  id="borrowed-at"
                  label="Tanggal peminjaman"
                  value={borrowedAt}
                  onChange={(value) => {
                    setBorrowedAt(value);

                    if (dueAt && value > dueAt) {
                      setDateError(
                        "Tanggal jatuh tempo tidak boleh sebelum tanggal peminjaman.",
                      );
                    } else {
                      setDateError("");
                    }
                  }}
                  required
                />

                <DatePicker
                  id="due-at"
                  label="Tanggal jatuh tempo"
                  min={borrowedAt || undefined}
                  value={dueAt}
                  onChange={(value) => {
                    setDueAt(value);

                    if (borrowedAt && value < borrowedAt) {
                      setDateError(
                        "Tanggal jatuh tempo tidak boleh sebelum tanggal peminjaman.",
                      );
                      return;
                    }

                    setDateError("");
                  }}
                  required
                />
              </div>

              {dateError && (
                <p role="alert" className="mt-3 text-xs text-red-600">
                  {dateError}
                </p>
              )}
            </Card>

            {/* CARD 3: RINGKASAN & SUBMIT BUTTON (SELALU TAMPIL DENGAN CHECKLIST) */}
            <Card className="p-4 sm:p-5">
              <h3 className="text-base font-semibold text-slate-900">
                4. Ringkasan & Konfirmasi
              </h3>

              {/* CHECKLIST STATUS LANGKAH */}
              <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <p className="font-semibold text-slate-700">Checklist Kelengkapan:</p>
                <div
                  className={`flex items-center gap-2 ${
                    selectedMember ? "text-emerald-700 font-medium" : "text-slate-500"
                  }`}
                >
                  <span className="text-sm font-bold leading-none">{selectedMember ? "✓" : "○"}</span>
                  <span>1. Anggota: {selectedMember ? selectedMember.name : "Belum dipilih"}</span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    selectedBooks.length > 0 &&
                    selectedBooks.every((item) => item.selectedCopyIds.length > 0)
                      ? "text-emerald-700 font-medium"
                      : "text-slate-500"
                  }`}
                >
                  <span className="text-sm font-bold leading-none">
                    {selectedBooks.length > 0 &&
                    selectedBooks.every((item) => item.selectedCopyIds.length > 0)
                      ? "✓"
                      : "○"}
                  </span>
                  <span>
                    2. Buku & Eksemplar:{" "}
                    {selectedBooks.length > 0
                      ? `${selectedBooks.length} buku (${selectedBooks.reduce((acc, it) => acc + it.selectedCopyIds.length, 0)} eksemplar)`
                      : "Belum dipilih"}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    borrowedAt && dueAt && !dateError ? "text-emerald-700 font-medium" : "text-slate-500"
                  }`}
                >
                  <span className="text-sm font-bold leading-none">
                    {borrowedAt && dueAt && !dateError ? "✓" : "○"}
                  </span>
                  <span>
                    3. Tanggal Pinjam & Tempo:{" "}
                    {borrowedAt && dueAt ? `${formatDate(borrowedAt)} s/d ${formatDate(dueAt)}` : "Belum lengkap"}
                  </span>
                </div>
              </div>

              {/* RINGKASAN DATA JIKA SUDAH ADA */}
              {selectedMember && selectedBooks.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Peminjam:</span>
                    <span className="font-semibold text-slate-900">{selectedMember.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jumlah Buku:</span>
                    <span className="font-semibold text-slate-900">{selectedBooks.length} buku</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jatuh Tempo:</span>
                    <span className="font-semibold text-slate-900">{formatDate(dueAt)}</span>
                  </div>
                </div>
              )}

              {/* PERINGATAN BLOKIR SUBMIT JIKA KUOTA PENUH */}
              {isMaxActiveLoansReached && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800" role="alert">
                  <p className="font-semibold">Peminjaman Tidak Dapat Diproses</p>
                  <p className="mt-0.5">
                    Anggota ini telah mencapai batas {maxActiveLoans} peminjaman aktif. Selesaikan atau kembalikan pinjaman sebelumnya terlebih dahulu.
                  </p>
                </div>
              )}

              {/* TOMBOL SUBMIT */}
              <div className="mt-4 border-t border-slate-200 pt-4">
                <Button
                  type="button"
                  loading={submitLoading}
                  disabled={
                    !selectedMember ||
                    (typeof maxActiveLoans === "number" && memberActiveLoanCount >= maxActiveLoans) ||
                    memberLoanStatsLoading ||
                    selectedBooks.length === 0 ||
                    !selectedBooks.every((item) => item.selectedCopyIds.length > 0) ||
                    !borrowedAt ||
                    !dueAt ||
                    Boolean(dateError) ||
                    submitLoading ||
                    Boolean(successLoan)
                  }
                  onClick={handleSubmitLoan}
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                  className="w-full"
                >
                  Konfirmasi Peminjaman
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* =================================================
            SUCCESS MODAL
        ================================================= */}

        <Modal
          open={Boolean(successLoan)}
          onClose={() => {
            resetLoanForm();
          }}
          closeOnBackdrop={false}
          raw
          size="2xl"
          initialFocusRef={newLoanBtnRef}
          ariaLabelledBy="loan-success-title"
          className="w-full max-w-2xl rounded-xl bg-white shadow-2xl"
        >
          {successLoan && (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
                    aria-hidden="true"
                  >
                    ✓
                  </div>
                  <div>
                    <h2
                      id="loan-success-title"
                      className="text-lg font-semibold text-slate-900"
                    >
                      Peminjaman berhasil
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Peminjaman berhasil dicatat.
                    </p>
                  </div>
                </div>

                <Button
                  ref={successModalCloseRef}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Tutup peminjaman berhasil"
                  onClick={closeSuccessModal}
                  className="min-h-[32px] min-w-[32px] p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </Button>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Nomor peminjaman</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {successLoan.loanNumber}
                  </p>
                </div>

                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Anggota</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {selectedMember?.name ?? "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Buku</p>
                    <div className="mt-1 space-y-1">
                      {selectedBooks.map((item) => (
                        <p
                          key={item.book.id}
                          className="font-medium text-slate-900"
                        >
                          {item.book.title}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Eksemplar</p>
                    <div className="mt-1 space-y-1">
                      {selectedBooks
                        .flatMap((item) =>
                          item.selectedCopyIds.map((copyId) => {
                            const copy = item.copies.find(
                              (candidate) => candidate.id === copyId,
                            );
                            return copy?.code ?? copyId;
                          }),
                        )
                        .map((code) => (
                          <p key={code} className="font-medium text-slate-900">
                            {code}
                          </p>
                        ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Tanggal peminjaman</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {formatDate(successLoan.borrowedAt)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Jatuh tempo</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {formatDate(successLoan.dueAt)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    printLoanReceipt(
                      successLoan,
                      selectedMember,
                      selectedBooks,
                      companyName,
                    )
                  }
                >
                  Cetak Struk
                </Button>
                <Button
                  ref={newLoanBtnRef}
                  type="button"
                  variant="primary"
                  onClick={() => {
                    resetLoanForm();
                  }}
                >
                  Catat Peminjaman Baru
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push("/transactions")}
                >
                  Lihat Riwayat Transaksi
                </Button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmationDialog
          open={showChangeMemberConfirm}
          title="Ganti Anggota?"
          description="Mengganti anggota akan membatalkan pilihan buku dan tanggal yang telah ditentukan. Lanjutkan?"
          confirmLabel="Ya, Ganti Anggota"
          tone="destructive"
          onConfirm={executeChangeMember}
          onClose={() => setShowChangeMemberConfirm(false)}
        />
      </div>
    </div>
  );
}
