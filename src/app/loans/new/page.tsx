"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canManageLoans } from "@/lib/authorization";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import DatePicker from "@/components/ui/DatePicker";
import Button from "@/components/ui/Button";
import BackLink from "@/components/ui/BackLink";

import {
  getMembersApi,
  searchMembersApi,
  createMemberApi,
  getBooksApi,
  searchBooksApi,
  createBookApi,
  getBookCopiesApi,
  createLoanApi,
} from "@/lib/api";

import type { Book, BookCopy, Loan, Member } from "@/lib/types";
import LoadingState from "@/components/ui/LoadingState";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/context/ToastContext";
import BookCameraScannerModal from "@/components/scanner/BookCameraScannerModal";

type MemberFormErrors = {
  name: string;
  phone: string;
  identityNumber: string;
  email: string;
};

const EMPTY_MEMBER_ERRORS: MemberFormErrors = {
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

const MEMBER_PAGE_SIZE = 10;
const BOOK_PAGE_SIZE = 10;

export default function NewLoanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const successModalCloseRef = useRef<HTMLButtonElement>(null);
  const memberModalCloseRef = useRef<HTMLButtonElement>(null);
  const bookModalCloseRef = useRef<HTMLButtonElement>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // =====================================================
  // MEMBER SEARCH
  // =====================================================

  const [memberQuery, setMemberQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberPage, setMemberPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState("");

  // =====================================================
  // CREATE MEMBER
  // =====================================================

  const [showMemberForm, setShowMemberForm] = useState(false);

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

  // =====================================================
  // SCANNER & BARCODE STATE
  // =====================================================

  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [highlightedBookId, setHighlightedBookId] = useState<string | null>(
    null,
  );

  // =====================================================
  // DATE
  // =====================================================

  const [borrowedAt, setBorrowedAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [dateError, setDateError] = useState("");

  // =====================================================
  // SUBMIT
  // =====================================================

  const [submitLoading, setSubmitLoading] = useState(false);
  const [successLoan, setSuccessLoan] = useState<Loan | null>(null);

  // =====================================================
  // GLOBAL HARDWARE USB BARCODE SCANNER LISTENER
  // =====================================================

  useEffect(() => {
    if (!selectedMember || showMemberForm || showBookForm || successLoan) {
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
  }, [
    selectedMember,
    showMemberForm,
    showBookForm,
    successLoan,
    selectedBooks,
    books,
    scanLoading,
  ]);

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

  function closeSuccessModal() {
    setSuccessLoan(null);
    window.location.reload();
  }

  useEffect(() => {
    if (!successLoan) return;

    successModalCloseRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSuccessLoan(null);
        window.location.reload();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [successLoan]);

  useEffect(() => {
    const session = getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    if (!canManageLoans(session.user.role)) {
      router.replace("/dashboard");
      return;
    }

    setPageLoading(false);
  }, [router]);

  // =====================================================
  // SEARCH MEMBER WITH DEBOUNCE (Instant saat kosong, 350ms saat mengetik)
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
          router.replace("/login");
          return;
        }

        setMemberLoading(true);
        setMemberError("");

        try {
          const keyword = memberQuery.trim();
          const result =
            keyword.length > 0
              ? await searchMembersApi(keyword)
              : await getMembersApi();

          if (!cancelled) {
            const visibleMembers = keyword
              ? result
              : result.filter((member) => member.status === "ACTIVE");

            setMembers(visibleMembers);
            setMemberPage(1);
          }
        } catch (err: any) {
          if (!cancelled) {
            setMemberError(
              err instanceof Error ? err.message : "Data anggota gagal dimuat."
            );
            setMembers([]);
            setMemberPage(1);
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
  }, [memberQuery, selectedMember, showMemberForm, router]);

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
          const keyword = bookQuery.trim();
          const result = await searchBooksApi(keyword);
          const visibleBooks = keyword
            ? result
            : result.filter((book) => book.status !== "INACTIVE");

          if (!cancelled) {
            setBooks(visibleBooks);
            setBookPage(1);
          }
        } catch (err: any) {
          if (!cancelled) {
            setBookError(
              err instanceof Error ? err.message : "Data buku gagal dimuat."
            );
            setBooks([]);
            setBookPage(1);
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
  }, [bookQuery, selectedMember]);

  // =====================================================
  // SELECT MEMBER
  // =====================================================

  async function handleSelectMember(member: Member) {
    if (member.status === "INACTIVE") {
      return;
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

    // Reset tanggal
    setBorrowedAt("");
    setDueAt("");
    setDateError("");

    // Reset submit
    setSuccessLoan(null);
  }

  // =====================================================
  // VALIDATE MEMBER FORM
  // =====================================================

  function validateMemberForm() {
    const errors: MemberFormErrors = {
      name: "",
      phone: "",
      identityNumber: "",
      email: "",
    };

    const name = memberName.trim();
    const phone = memberPhone.trim();
    const identityNumber = memberIdentityNumber.trim();
    const email = memberEmail.trim();

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
        name: memberName.trim(),
        phone: memberPhone.trim(),
        identityNumber: memberIdentityNumber.trim(),
        email: memberEmail.trim() || undefined,
      });

      // Langsung pilih anggota yang baru dibuat
      setSelectedMember(member);

      setShowMemberForm(false);

      // Reset form
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
      const message =
        error instanceof Error ? error.message : "Anggota gagal dibuat.";

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
      errors.totalCopies = "Jumlah copy wajib diisi.";
    } else if (!Number.isInteger(totalCopies) || totalCopies < 1) {
      errors.totalCopies = "Jumlah copy minimal 1.";
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
      const message =
        error instanceof Error ? error.message : "Buku gagal dibuat.";
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
      toast.error(`Copy buku ${book.title} gagal dimuat.`);
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
    try {
      // 1. Check if the copy is already in currently loaded selectedBooks
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
            toast.warning(
              `Copy ${targetCopy.code} berstatus "${targetCopy.status}" (tidak dapat dipinjam).`,
            );
            return;
          }
          if (foundInSelected.selectedCopyIds.includes(targetCopy.id)) {
            toast.info(`Copy ${targetCopy.code} sudah terpilih.`);
            return;
          }
          toggleCopy(foundInSelected.book.id, targetCopy);
          toast.success(
            `Copy ${targetCopy.code} (${foundInSelected.book.title}) berhasil dipilih!`,
          );
          return;
        }
      }

      // 2. Candidate prefix if code is formatted like CP-333E-01 -> CP-333E
      const prefixCandidate = code.includes("-")
        ? code.substring(0, code.lastIndexOf("-")).trim()
        : code;

      let matchedBook: Book | null = null;
      let matchedCopy: BookCopy | null = null;
      let allLoadedCopies: BookCopy[] = [];

      // A. Check in current books on page
      for (const b of books) {
        if (
          b.code.toUpperCase() === code ||
          b.code.toUpperCase() === prefixCandidate ||
          (b.isbn && b.isbn.toUpperCase() === code)
        ) {
          matchedBook = b;
          break;
        }
        const bCopies = await getBookCopiesApi(b.id).catch(() => []);
        const foundCopy = bCopies.find(
          (c) =>
            c.code.toUpperCase() === code ||
            c.id.toUpperCase() === code ||
            c.code.toUpperCase().replace(/[^A-Z0-9]/g, "") ===
              code.replace(/[^A-Z0-9]/g, ""),
        );
        if (foundCopy) {
          matchedBook = b;
          matchedCopy = foundCopy;
          allLoadedCopies = bCopies;
          break;
        }
      }

      // B. If not found in current page books, search via searchBooksApi (both code & prefix)
      if (!matchedBook) {
        const [searchExact, searchPrefix] = await Promise.all([
          searchBooksApi(code).catch(() => []),
          prefixCandidate !== code
            ? searchBooksApi(prefixCandidate).catch(() => [])
            : Promise.resolve([]),
        ]);

        const candidates = [...searchExact, ...searchPrefix];
        for (const b of candidates) {
          const bCopies = await getBookCopiesApi(b.id).catch(() => []);
          const foundCopy = bCopies.find(
            (c) =>
              c.code.toUpperCase() === code ||
              c.id.toUpperCase() === code ||
              c.code.toUpperCase().replace(/[^A-Z0-9]/g, "") ===
                code.replace(/[^A-Z0-9]/g, ""),
          );
          if (foundCopy) {
            matchedBook = b;
            matchedCopy = foundCopy;
            allLoadedCopies = bCopies;
            break;
          }
          if (
            b.code.toUpperCase() === code ||
            b.code.toUpperCase() === prefixCandidate
          ) {
            matchedBook = b;
            allLoadedCopies = bCopies;
            break;
          }
        }
      }

      // C. Fallback: Search all catalog books
      if (!matchedBook) {
        const allBooks = await getBooksApi({ size: 100 }).catch(() => []);
        const directBook = allBooks.find(
          (b) =>
            b.code.toUpperCase() === code ||
            b.code.toUpperCase() === prefixCandidate ||
            (b.isbn && b.isbn.toUpperCase() === code) ||
            code.startsWith(b.code.toUpperCase()),
        );

        if (directBook) {
          matchedBook = directBook;
          allLoadedCopies = await getBookCopiesApi(directBook.id).catch(() => []);
          matchedCopy =
            allLoadedCopies.find(
              (c) =>
                c.code.toUpperCase() === code ||
                c.id.toUpperCase() === code ||
                c.code.toUpperCase().replace(/[^A-Z0-9]/g, "") ===
                  code.replace(/[^A-Z0-9]/g, ""),
            ) || null;
        } else {
          // Scan all copies across all books
          for (const b of allBooks) {
            const bCopies = await getBookCopiesApi(b.id).catch(() => []);
            const foundCopy = bCopies.find(
              (c) =>
                c.code.toUpperCase() === code ||
                c.id.toUpperCase() === code ||
                c.code.toUpperCase().replace(/[^A-Z0-9]/g, "") ===
                  code.replace(/[^A-Z0-9]/g, ""),
            );
            if (foundCopy) {
              matchedBook = b;
              matchedCopy = foundCopy;
              allLoadedCopies = bCopies;
              break;
            }
          }
        }
      }

      if (!matchedBook) {
        toast.error(`Buku dengan kode "${rawCode}" tidak ditemukan.`);
        return;
      }

      if (matchedBook.status === "INACTIVE") {
        toast.error(
          `Buku "${matchedBook.title}" berstatus diarsipkan / non-aktif.`,
        );
        return;
      }

      // Ensure copies are loaded
      if (allLoadedCopies.length === 0) {
        allLoadedCopies = await getBookCopiesApi(matchedBook.id).catch(() => []);
      }

      const availableCopies = allLoadedCopies.filter(
        (c) => c.status === "AVAILABLE",
      );
      if (availableCopies.length === 0) {
        toast.warning(
          `Semua copy untuk buku "${matchedBook.title}" sedang dipinjam atau tidak tersedia.`,
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

      // Ensure matchedBook is placed in books and shown on Page 1
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
        `✅ Berhasil menambahkan: ${matchedBook.title} (Copy: ${copyToSelect.code})`,
      );
    } catch (err: any) {
      toast.error(err?.message || "Gagal memproses scan barcode.");
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
      toast.error("Anggota belum dipilih.");
      return;
    }

    if (selectedMember.status !== "ACTIVE") {
      toast.error(
        "Member tidak aktif dan tidak dapat membuat transaksi baru.",
      );
      return;
    }

    if (selectedBooks.length === 0) {
      toast.error("Minimal satu buku harus dipilih.");
      return;
    }

    const archivedBook = selectedBooks.find(
      (item) => item.book.status === "INACTIVE",
    );

    if (archivedBook) {
      toast.error(
        `Buku ${archivedBook.book.title} diarsipkan dan tidak dapat dipinjam.`,
      );
      return;
    }

    const bookWithoutCopy = selectedBooks.find(
      (item) => item.selectedCopyIds.length === 0,
    );

    if (bookWithoutCopy) {
      toast.error(
        `Pilih minimal satu copy untuk buku ${bookWithoutCopy.book.title}.`,
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
        "Ada copy yang sudah tidak tersedia. Silakan periksa kembali pilihan copy buku.",
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
      const message =
        error instanceof Error ? error.message : "Peminjaman gagal diproses.";
      toast.error(message);
    } finally {
      setSubmitLoading(false);
    }
  }

  // =====================================================
  // RESET MEMBER
  // =====================================================

  function handleChangeMember() {
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

    setBorrowedAt("");
    setDueAt("");
    setDateError("");

    setSuccessLoan(null);
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
    setBorrowedAt("");
    setDueAt("");
    setDateError("");
    setSuccessLoan(null);
  }

  // =====================================================
  // PAGINATION CALCULATIONS
  // =====================================================

  const memberTotalPages = Math.max(
    1,
    Math.ceil(members.length / MEMBER_PAGE_SIZE),
  );
  const currentMemberPage = Math.min(memberPage, memberTotalPages);
  const paginatedMembers = members.slice(
    (currentMemberPage - 1) * MEMBER_PAGE_SIZE,
    currentMemberPage * MEMBER_PAGE_SIZE,
  );

  const bookTotalPages = Math.max(
    1,
    Math.ceil(books.length / BOOK_PAGE_SIZE),
  );
  const currentBookPage = Math.min(bookPage, bookTotalPages);
  const paginatedBooks = books.slice(
    (currentBookPage - 1) * BOOK_PAGE_SIZE,
    currentBookPage * BOOK_PAGE_SIZE,
  );

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <LoadingState label="Memuat peminjaman..." />
      </main>
    );
  }
  // =====================================================
  // RENDER
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-50">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="page-container py-6">
        {/* =================================================
            TITLE
        ================================================= */}

        <div className="mb-6">
          <BackLink href="/dashboard" />
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Peminjaman Buku
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Pilih anggota, buku, copy buku, dan tanggal peminjaman.
          </p>
        </div>

        {/* =================================================
            1. MEMBER
        ================================================= */}

        <div
          className={`${successLoan ? "pointer-events-none opacity-60" : ""} grid gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)] lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)] md:items-start`}
        >
          <div className="min-w-0">
            <Card className="p-4 sm:p-5">
              <h3 className="text-base font-semibold text-slate-900">
                1. Cari Anggota
              </h3>

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
                          Anggota belum ditemukan. Kamu dapat membuat anggota
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
                        <h4 className="text-sm font-semibold text-slate-700">
                          {memberQuery.trim()
                            ? "Hasil pencarian"
                            : "Daftar anggota"}
                        </h4>

                        <p className="shrink-0 text-xs text-slate-500">
                          {members.length} anggota
                        </p>
                      </div>

                      {paginatedMembers.map((member) => {
                        const inactive = member.status === "INACTIVE";

                        return (
                          <button
                            key={member.id}
                            type="button"
                            disabled={inactive}
                            onClick={() => handleSelectMember(member)}
                            className={`w-full rounded-lg border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                              inactive
                                ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                                : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <p
                                  className={`truncate font-semibold ${
                                    inactive
                                      ? "text-slate-400"
                                      : "text-slate-900"
                                  }`}
                                >
                                  {member.name}
                                </p>

                                <p
                                  className={`mt-1 truncate text-sm ${
                                    inactive
                                      ? "text-slate-400"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {member.memberNumber} · {member.phone}
                                </p>

                                {inactive && (
                                  <p className="mt-1 text-xs font-medium text-slate-500">
                                    Member tidak aktif dan tidak dapat membuat
                                    transaksi baru.
                                  </p>
                                )}
                              </div>

                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                                  inactive
                                    ? "bg-slate-200 text-slate-500"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {inactive ? "Tidak aktif" : "Aktif"}
                              </span>
                            </div>
                          </button>
                        );
                      })}

                      {/* MEMBER PAGINATION (MOBILE, TABLET & DESKTOP) */}
                      <Pagination
                        currentPage={currentMemberPage}
                        totalPages={memberTotalPages}
                        onPageChange={(nextPage) => setMemberPage(nextPage)}
                        totalItems={members.length}
                        pageSize={MEMBER_PAGE_SIZE}
                        className="mt-4 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 rounded-b-xl border-t"
                      />
                    </div>
                  )}
                </>
              )}

              {/* SELECTED MEMBER */}

              {selectedMember && (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {selectedMember.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {selectedMember.memberNumber}
                      </p>

                      <p className="text-sm text-slate-500">
                        {selectedMember.phone}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleChangeMember}
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

            {showMemberForm && !selectedMember && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
                role="presentation"
                onMouseDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    !memberFormLoading
                  ) {
                    setShowMemberForm(false);
                    setMemberFormErrors(EMPTY_MEMBER_ERRORS);
                  }
                }}
              >
                <div
                  className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="create-member-title"
                >
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

                    <button
                      ref={memberModalCloseRef}
                      type="button"
                      aria-label="Tutup form anggota baru"
                      disabled={memberFormLoading}
                      onClick={() => {
                        setShowMemberForm(false);
                        setMemberFormErrors(EMPTY_MEMBER_ERRORS);
                      }}
                      className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span aria-hidden="true" className="text-xl leading-none">
                        ×
                      </span>
                    </button>
                  </div>

                  <form
                    onSubmit={handleCreateMember}
                    className="grid gap-3.5 p-5 sm:grid-cols-2"
                  >
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

                      <Button type="submit" loading={memberFormLoading}>
                        Simpan Anggota
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

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
                      Cari buku atau arahkan scanner USB / kamera.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setScannerModalOpen(true)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span aria-hidden="true" className="text-sm">📷</span>
                    <span>Scan Kamera</span>
                  </button>
                </div>

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
                  <button
                    type="button"
                    onClick={() => {
                      setBookQuery("");
                      setBookPage(1);
                    }}
                    className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Tampilkan semua buku
                  </button>
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
                          ? "Buku belum ditemukan. Kamu dapat membuat buku baru."
                          : "Saat ini tidak ada buku yang dapat dipinjam. Kamu dapat membuat buku baru."}
                      </p>

                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-3"
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

                {showBookForm && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
                    role="presentation"
                    onMouseDown={(event) => {
                      if (
                        event.target === event.currentTarget &&
                        !bookFormLoading
                      ) {
                        setShowBookForm(false);
                        setBookFormErrors(EMPTY_BOOK_ERRORS);
                      }
                    }}
                  >
                    <div
                      className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="create-book-title"
                    >
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
                            Isi data buku dan jumlah copy awal.
                          </p>
                        </div>

                        <button
                          ref={bookModalCloseRef}
                          type="button"
                          aria-label="Tutup form buku baru"
                          disabled={bookFormLoading}
                          onClick={() => {
                            setShowBookForm(false);
                            setBookFormErrors(EMPTY_BOOK_ERRORS);
                          }}
                          className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span
                            aria-hidden="true"
                            className="text-xl leading-none"
                          >
                            ×
                          </span>
                        </button>
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

                        {/* JUMLAH COPY */}
                        <Input
                          id="book-total-copies"
                          label="Jumlah Copy Awal"
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
                              Kode copy dibuat otomatis
                            </p>

                            <p className="mt-1 text-xs leading-5 text-blue-700">
                              Sistem akan membuat kode copy secara berurutan
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

                          <Button type="submit" loading={bookFormLoading}>
                            Simpan Buku
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* BOOK LIST */}

                {!bookLoading && books.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-700">
                        {bookQuery.trim() ? "Hasil pencarian" : "Daftar buku"}
                      </h4>

                      <p className="shrink-0 text-xs text-slate-500">
                        {books.length} buku
                      </p>
                    </div>

                    {paginatedBooks.map((book) => {
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
                          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_230px] md:items-center">
                            {/* INFO BUKU */}
                            <div className="min-w-0">
                              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4">
                                {/* Judul + detail */}
                                <div className="min-w-0">
                                  <p
                                    className={`truncate font-semibold ${
                                      archived
                                        ? "text-slate-400"
                                        : "text-slate-900"
                                    }`}
                                    title={book.title}
                                  >
                                    {book.title}
                                  </p>

                                  <div className="mt-2 space-y-1 text-sm text-slate-500">
                                    <p>
                                      <span className="text-slate-400">
                                        Penulis
                                      </span>{" "}
                                      {book.author || "-"}
                                    </p>

                                    <p>
                                      <span className="text-slate-400">
                                        ISBN
                                      </span>{" "}
                                      {book.isbn || "-"}
                                    </p>
                                  </div>

                                  {archived && (
                                    <p className="mt-2 text-xs font-medium text-slate-500">
                                      Buku diarsipkan dan tidak dapat dipinjam.
                                    </p>
                                  )}
                                </div>

                                {/* KODE BUKU + BADGE */}
                                <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                                  <span className="font-medium text-slate-700">
                                    {book.code}
                                  </span>
                                  <span
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
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
                            <div className="border-t border-slate-200 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                    Total copy
                                  </p>
                                  <p className="mt-0.5 text-xl font-bold leading-none text-slate-900">
                                    {book.totalCopies}
                                  </p>
                                </div>

                                <div
                                  className={`rounded-lg border px-3 py-2.5 ${
                                    book.availableCopies > 0
                                      ? "border-emerald-100 bg-emerald-50"
                                      : "border-red-100 bg-red-50"
                                  }`}
                                >
                                  <p
                                    className={`text-[11px] font-medium uppercase tracking-wide ${
                                      book.availableCopies > 0
                                        ? "text-emerald-600"
                                        : "text-red-500"
                                    }`}
                                  >
                                    Tersedia
                                  </p>
                                  <p
                                    className={`mt-0.5 text-xl font-bold leading-none ${
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
                                  disabled={unavailable || selected || loading}
                                  onClick={() => void selectBook(book)}
                                  className="col-span-2 w-full"
                                >
                                  {loading ? (
                                    <span className="inline-flex items-center justify-center gap-2">
                                      <span
                                        aria-hidden="true"
                                        className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                                      />
                                      Memuat copy...
                                    </span>
                                  ) : archived ? (
                                    "Diarsipkan"
                                  ) : unavailable ? (
                                    "Tidak tersedia"
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
                                : "Tidak ada copy yang tersedia untuk dipinjam."}
                            </p>
                          )}

                          {selectedItem && (
                            <div className="mt-4 border-t border-blue-200 pt-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-medium text-slate-800">
                                    Pilih copy buku
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Pilih satu atau lebih copy yang tersedia.
                                  </p>
                                </div>

                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => removeSelectedBook(book.id)}
                                >
                                  Batal pilih
                                </Button>
                              </div>

                              {selectedItem.copies.length === 0 ? (
                                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                                  <p className="text-sm font-medium text-slate-800">
                                    Tidak ada copy buku yang tersedia.
                                  </p>
                                </div>
                              ) : (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {selectedItem.copies.map((copy) => {
                                    const unavailableCopy =
                                      copy.status !== "AVAILABLE";
                                    const checked =
                                      selectedItem.selectedCopyIds.includes(
                                        copy.id,
                                      );

                                    return (
                                      <label
                                        key={copy.id}
                                        className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                                          unavailableCopy
                                            ? "cursor-not-allowed bg-slate-100 opacity-60"
                                            : checked
                                              ? "border-blue-500 bg-white"
                                              : "border-slate-200 bg-white"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={unavailableCopy}
                                          onChange={() =>
                                            toggleCopy(book.id, copy)
                                          }
                                          className="h-4 w-4"
                                        />
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-slate-900">
                                            {copy.code}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            {copy.status === "AVAILABLE"
                                              ? "Tersedia"
                                              : copy.status === "BORROWED"
                                                ? "Dipinjam"
                                                : copy.status === "INACTIVE"
                                                  ? "Tidak aktif"
                                                  : "Hilang"}
                                          </p>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}

                              <p className="mt-3 text-sm text-slate-600">
                                Copy dipilih:{" "}
                                <span className="font-semibold">
                                  {selectedItem.selectedCopyIds.length}
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* BOOK PAGINATION (MOBILE, TABLET & DESKTOP) */}
                    <Pagination
                      currentPage={currentBookPage}
                      totalPages={bookTotalPages}
                      onPageChange={(nextPage) => setBookPage(nextPage)}
                      totalItems={books.length}
                      pageSize={BOOK_PAGE_SIZE}
                      className="mt-4 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 rounded-b-xl border-t"
                    />
                  </div>
                )}
              </Card>
            )}
          </div>

          <div className="min-w-0 md:sticky md:top-6 md:self-start space-y-5">
            <Card className="p-4 sm:p-5">
              <h3 className="text-base font-semibold text-slate-900">
                Informasi Peminjaman
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Tentukan tanggal dan periksa ringkasan sebelum konfirmasi.
              </p>

              {selectedBooks.length > 0 && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Buku yang dipilih
                    </h4>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                      {selectedBooks.length} buku
                    </span>
                  </div>

                  <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {selectedBooks.map((item) => {
                      const selectedCopies = item.copies
                        .filter((copy) =>
                          item.selectedCopyIds.includes(copy.id),
                        )
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
                              <span className="shrink-0 text-xs text-slate-400">
                                {item.book.code}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {item.selectedCopyIds.length > 0
                                ? `${item.selectedCopyIds.length} copy · ${selectedCopies.join(", ")}`
                                : "Belum memilih copy"}
                            </p>
                          </div>

                          <button
                            type="button"
                            aria-label={`Batal pilih ${item.book.title}`}
                            title="Batal pilih"
                            onClick={() => removeSelectedBook(item.book.id)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg leading-none text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* =================================================
            3. DATE
        ================================================= */}

              {selectedBooks.length > 0 && (
                <Card className="mt-5 p-4 sm:p-6">
                  <h3 className="text-lg font-semibold text-slate-900">
                    3. Tanggal Peminjaman
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Tentukan tanggal peminjaman dan tanggal jatuh tempo.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                    <p role="alert" className="mt-4 text-sm text-red-600">
                      {dateError}
                    </p>
                  )}
                </Card>
              )}

              {/* =================================================
            4. SUMMARY
        ================================================= */}

              {selectedMember &&
                selectedBooks.length > 0 &&
                selectedBooks.every(
                  (item) => item.selectedCopyIds.length > 0,
                ) &&
                borrowedAt &&
                dueAt && (
                  <Card className="mt-5 p-4 sm:p-6">
                    <h3 className="text-lg font-semibold text-slate-900">
                      4. Ringkasan Peminjaman
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Periksa kembali data peminjaman sebelum dikonfirmasi.
                    </p>

                    <div className="mt-5 space-y-5">
                      {/* MEMBER */}

                      <div>
                        <p className="text-sm text-slate-500">Anggota</p>

                        <p className="mt-1 font-medium text-slate-900">
                          {selectedMember.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {selectedMember.memberNumber}
                        </p>

                        <p className="text-sm text-slate-500">
                          {selectedMember.phone}
                        </p>
                      </div>

                      {/* BOOKS */}

                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-slate-500">Buku</p>
                          <p className="text-sm font-medium text-slate-900">
                            {selectedBooks.length} buku ·{" "}
                            {selectedBooks.reduce(
                              (total, item) =>
                                total + item.selectedCopyIds.length,
                              0,
                            )}{" "}
                            copy
                          </p>
                        </div>
                      </div>

                      {/* DATE */}

                      <div className="grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
                        <div>
                          <p className="text-sm text-slate-500">
                            Tanggal peminjaman
                          </p>

                          <p className="mt-1 font-medium text-slate-900">
                            {formatDate(borrowedAt)}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-slate-500">
                            Tanggal jatuh tempo
                          </p>

                          <p className="mt-1 font-medium text-slate-900">
                            {formatDate(dueAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* SUBMIT */}

                    <div className="mt-5 border-t border-slate-200 pt-5">
                      <Button
                        type="button"
                        loading={submitLoading}
                        disabled={submitLoading || Boolean(successLoan)}
                        onClick={handleSubmitLoan}
                      >
                        Konfirmasi Peminjaman
                      </Button>
                    </div>
                  </Card>
                )}
            </Card>
          </div>
        </div>

        {/* =================================================
            SUCCESS
        ================================================= */}

        {successLoan && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSuccessLoan(null);
                window.location.reload();
              }
            }}
          >
            <div
              className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="loan-success-title"
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
                      id="loan-success-title"
                      className="text-lg font-semibold text-slate-900"
                    >
                      Peminjaman berhasil
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Transaksi peminjaman berhasil dicatat.
                    </p>
                  </div>
                </div>

                <button
                  ref={successModalCloseRef}
                  type="button"
                  aria-label="Tutup peminjaman berhasil"
                  onClick={() => setSuccessLoan(null)}
                  className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span aria-hidden="true" className="text-xl leading-none">
                    ×
                  </span>
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Nomor transaksi</p>
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
                    <p className="text-xs text-slate-500">Copy</p>
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
                  onClick={() => {
                    resetLoanForm();
                    window.location.reload();
                  }}
                >
                  Catat Peminjaman Baru
                </Button>
                <Button
                  type="button"
                  onClick={() => router.push("/transactions")}
                >
                  Lihat Riwayat Transaksi
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            CAMERA SCANNER MODAL
        ===================================================== */}

        <BookCameraScannerModal
          isOpen={scannerModalOpen}
          onClose={() => setScannerModalOpen(false)}
          onScan={async (code) => {
            await handleScanCode(code);
          }}
          title="Scan Barcode / QR Code Buku"
          subtitle="Arahkan kamera ke barcode stiker buku untuk memilih secara instan"
        />
      </div>
    </main>
  );
}
