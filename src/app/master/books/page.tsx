"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getSession } from "@/lib/auth";
import { canAccessMasterData, canManageMasterData } from "@/lib/authorization";
import Dropdown from "@/components/ui/Dropdown";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import BackLink from "@/components/ui/BackLink";
import LoadingState from "@/components/ui/LoadingState";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

import type { Book, BookCopy, BookCopyStatus, BookStatus } from "@/lib/types";

import { masterDataRepository } from "@/lib/master-data/repository";

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

const PAGE_SIZE = 8;

export default function MasterBooksPage() {
  const router = useRouter();

  // =====================================================
  // PAGE
  // =====================================================

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState("");

  const hasLoadedBooks = useRef(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookStatus | "">("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [successMessage, setSuccessMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");

  // =====================================================
  // BOOK FORM
  // =====================================================

  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const [bookCode, setBookCode] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookIsbn, setBookIsbn] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookCategory, setBookCategory] = useState("");
  const [bookTotalCopies, setBookTotalCopies] = useState("1");

  const [bookFormErrors, setBookFormErrors] =
    useState<BookFormErrors>(EMPTY_BOOK_ERRORS);

  const [bookFormLoading, setBookFormLoading] = useState(false);

  const formCloseRef = useRef<HTMLButtonElement>(null);

  const formModalRef = useRef<HTMLDivElement>(null);

  // =====================================================
  // DETAIL
  // =====================================================

  const [detailBook, setDetailBook] = useState<Book | null>(null);

  const [detailCopies, setDetailCopies] = useState<BookCopy[]>([]);

  const [detailLoading, setDetailLoading] = useState(false);

  const [detailError, setDetailError] = useState("");

  const detailCloseRef = useRef<HTMLButtonElement>(null);

  const detailModalRef = useRef<HTMLDivElement>(null);

  // =====================================================
  // ADD COPY
  // =====================================================

  const [addCopyLoading, setAddCopyLoading] = useState(false);

  // =====================================================
  // COPY STATUS
  // =====================================================

  const [confirmCopy, setConfirmCopy] = useState<BookCopy | null>(null);

  const [confirmCopyStatus, setConfirmCopyStatus] =
    useState<BookCopyStatus | null>(null);

  const [copyStatusLoading, setCopyStatusLoading] = useState(false);

  // =====================================================
  // BOOK STATUS
  // =====================================================

  const [confirmBook, setConfirmBook] = useState<Book | null>(null);

  const [confirmBookStatus, setConfirmBookStatus] =
    useState<BookStatus | null>(null);

  const [bookStatusLoading, setBookStatusLoading] = useState(false);

  // =====================================================
  // SESSION
  // =====================================================

  useEffect(() => {
    const session = getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    if (!canAccessMasterData(session.user.role)) {
      router.replace("/dashboard");
    }
  }, [router]);

  // =====================================================
  // LOAD BOOKS (Instant saat kosong, 350ms saat mengetik)
  // =====================================================

  useEffect(() => {
    let cancelled = false;
    const delay = search.trim().length === 0 ? 0 : 350;

    const timer = window.setTimeout(async () => {
      if (!hasLoadedBooks.current) {
        setLoading(true);
      } else {
        setTableLoading(true);
      }

      setError("");

      try {
        const result = await masterDataRepository.listBooks({
          search: search.trim(),
          status: statusFilter || undefined,
          page,
          pageSize: PAGE_SIZE,
        });

        if (cancelled) {
          return;
        }

        setBooks(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);

        hasLoadedBooks.current = true;
      } catch (error) {
        if (cancelled) {
          return;
        }

        setBooks([]);
        setTotal(0);
        setTotalPages(1);

        setError(
          error instanceof Error ? error.message : "Data buku gagal dimuat.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
          setTableLoading(false);
        }
      }
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, statusFilter, page]);

  // =====================================================
  // SUCCESS MESSAGE
  // =====================================================

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  // =====================================================
  // WARNING MESSAGE
  // =====================================================

  useEffect(() => {
    if (!warningMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setWarningMessage("");
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [warningMessage]);

  // =====================================================
  // FORM KEYBOARD
  // =====================================================

  useEffect(() => {
    if (!showForm) {
      return;
    }

    formCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !bookFormLoading) {
        closeForm();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const modal = formModalRef.current;

      if (!modal) {
        return;
      }

      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];

      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showForm, bookFormLoading]);

  // =====================================================
  // DETAIL KEYBOARD
  // =====================================================

  useEffect(() => {
    if (!detailBook) {
      return;
    }

    detailCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailBook(null);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const modal = detailModalRef.current;

      if (!modal) {
        return;
      }

      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];

      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [detailBook]);

  // =====================================================
  // OPEN CREATE FORM
  // =====================================================

  function openCreateForm() {
    setEditingBook(null);

    setBookCode("");
    setBookTitle("");
    setBookIsbn("");
    setBookAuthor("");
    setBookCategory("");
    setBookTotalCopies("1");

    setBookFormErrors(EMPTY_BOOK_ERRORS);

    setShowForm(true);
  }

  // =====================================================
  // OPEN EDIT FORM
  // =====================================================

  function openEditForm(book: Book) {
    setEditingBook(book);

    setBookCode(book.code);
    setBookTitle(book.title);
    setBookIsbn(book.isbn ?? "");
    setBookAuthor(book.author ?? "");
    setBookCategory(book.category ?? "");
    setBookTotalCopies(String(book.totalCopies));

    setBookFormErrors(EMPTY_BOOK_ERRORS);

    setShowForm(true);
  }

  // =====================================================
  // CLOSE FORM
  // =====================================================

  function closeForm() {
    if (bookFormLoading) {
      return;
    }

    setShowForm(false);
    setEditingBook(null);
    setBookFormErrors(EMPTY_BOOK_ERRORS);
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

    const cleanCode = bookCode.trim();

    const cleanTitle = bookTitle.trim();

    const cleanIsbn = bookIsbn.trim();

    const totalCopies = Number(bookTotalCopies);

    if (!cleanCode) {
      errors.code = "Kode buku wajib diisi.";
    } else if (cleanCode.length < 2) {
      errors.code = "Kode buku minimal 2 karakter.";
    }

    if (!cleanTitle) {
      errors.title = "Judul buku wajib diisi.";
    } else if (cleanTitle.length < 2) {
      errors.title = "Judul buku minimal 2 karakter.";
    }

    if (cleanIsbn && !/^[0-9Xx-]+$/.test(cleanIsbn)) {
      errors.isbn = "Format ISBN tidak valid.";
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
  // SUBMIT BOOK
  // =====================================================

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (bookFormLoading || !validateBookForm()) {
      return;
    }

    setBookFormLoading(true);
    setError("");
    setWarningMessage("");

    try {
      if (editingBook) {
        const newTitle = bookTitle.trim();

        const newIsbn = bookIsbn.trim();

        const newAuthor = bookAuthor.trim();

        const newCategory = bookCategory.trim();

        const currentIsbn = editingBook.isbn?.trim() ?? "";

        const currentAuthor = editingBook.author?.trim() ?? "";

        const currentCategory = editingBook.category?.trim() ?? "";

        const hasChanges =
          newTitle !== editingBook.title ||
          newIsbn !== currentIsbn ||
          newAuthor !== currentAuthor ||
          newCategory !== currentCategory;

        if (!hasChanges) {
          setWarningMessage("Tidak ada perubahan yang disimpan.");

          closeForm();
          return;
        }

        await masterDataRepository.updateBook(editingBook.id, {
          title: newTitle,
          isbn: newIsbn || undefined,
          author: newAuthor || undefined,
          category: newCategory || undefined,
        });

        setSuccessMessage("Data buku berhasil diperbarui.");
      } else {
        await masterDataRepository.createBook({
          code: bookCode.trim(),
          title: bookTitle.trim(),
          isbn: bookIsbn.trim() || undefined,
          author: bookAuthor.trim() || undefined,
          category: bookCategory.trim() || undefined,
          totalCopies: Number(bookTotalCopies),
        });

        setSuccessMessage("Buku berhasil ditambahkan.");
      }

      closeForm();

      const result = await masterDataRepository.listBooks({
        search,
        status: statusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });

      setBooks(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Status buku gagal diubah.";

      if (
        message ===
        "Buku tidak dapat diarsipkan karena masih memiliki copy yang sedang dipinjam."
      ) {
        setWarningMessage(message);
      } else {
        setError(message);
      }

      setConfirmBook(null);
      setConfirmBookStatus(null);
    } finally {
      setBookStatusLoading(false);
    }
  }

  // =====================================================
  // OPEN DETAIL
  // =====================================================

  async function openDetail(book: Book) {
    setDetailBook(book);
    setDetailCopies([]);
    setDetailError("");
    setDetailLoading(true);

    try {
      const [bookResult, copiesResult] = await Promise.all([
        masterDataRepository.getBook(book.id),
        masterDataRepository.listBookCopies({
          bookId: book.id,
          page: 1,
          pageSize: 1000,
        }),
      ]);

      setDetailBook(bookResult ?? book);

      setDetailCopies(copiesResult.data);
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Detail buku gagal dimuat.",
      );

      setDetailBook(book);
    } finally {
      setDetailLoading(false);
    }
  }

  // =====================================================
  // REFRESH DETAIL
  // =====================================================

  async function refreshDetail(bookId: string) {
    try {
      const [bookResult, copiesResult] = await Promise.all([
        masterDataRepository.getBook(bookId),
        masterDataRepository.listBookCopies({
          bookId,
          page: 1,
          pageSize: 1000,
        }),
      ]);

      if (bookResult) {
        setDetailBook(bookResult);
      }

      setDetailCopies(copiesResult.data);

      const result = await masterDataRepository.listBooks({
        search,
        status: statusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });

      setBooks(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Data buku gagal diperbarui.",
      );
    }
  }

  // =====================================================
  // ADD COPY
  // =====================================================

  async function handleAddCopy() {
    if (!detailBook || addCopyLoading) {
      return;
    }

    setAddCopyLoading(true);
    setDetailError("");

    try {
      await masterDataRepository.createBookCopy({
        bookId: detailBook.id,
      });

      setSuccessMessage("Copy buku berhasil ditambahkan.");

      await refreshDetail(detailBook.id);
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Copy buku gagal ditambahkan.",
      );
    } finally {
      setAddCopyLoading(false);
    }
  }

  // =====================================================
  // HANDLE COPY STATUS CHANGE
  // =====================================================

  function handleCopyStatusChange(copy: BookCopy, nextStatus: BookCopyStatus) {
    if (copy.status === "BORROWED") {
      return;
    }

    if (nextStatus === "BORROWED") {
      return;
    }

    void updateCopyStatus(copy, nextStatus);
  }

  async function updateCopyStatus(copy: BookCopy, nextStatus: BookCopyStatus) {
    setCopyStatusLoading(true);
    setDetailError("");

    try {
      await masterDataRepository.changeBookCopyStatus(copy.id, {
        status: nextStatus,
      });

      setSuccessMessage(
        `Status copy ${copy.code} berhasil diubah menjadi ${getCopyStatusLabel(
          nextStatus,
        )}.`,
      );

      await refreshDetail(copy.bookId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Status copy gagal diubah.";

      setWarningMessage(message);
    } finally {
      setCopyStatusLoading(false);
    }
  }

  // =====================================================
  // CHANGE COPY STATUS
  // =====================================================

  async function handleChangeCopyStatus() {
    if (!confirmCopy || !confirmCopyStatus) {
      return;
    }

    setCopyStatusLoading(true);

    try {
      await masterDataRepository.changeBookCopyStatus(confirmCopy.id, {
        status: confirmCopyStatus,
      });

      setSuccessMessage(
        confirmCopyStatus === "AVAILABLE"
          ? `Copy ${confirmCopy.code} berhasil diaktifkan.`
          : `Copy ${confirmCopy.code} berhasil dinonaktifkan.`,
      );

      const bookId = confirmCopy.bookId;

      setConfirmCopy(null);
      setConfirmCopyStatus(null);

      await refreshDetail(bookId);
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Status copy gagal diubah.",
      );

      setConfirmCopy(null);
      setConfirmCopyStatus(null);
    } finally {
      setCopyStatusLoading(false);
    }
  }

  // =====================================================
  // BOOK STATUS CONFIRM
  // =====================================================

  function openBookStatusConfirm(book: Book) {
    const nextStatus: BookStatus =
      book.status === "INACTIVE" ? "AVAILABLE" : "INACTIVE";

    setConfirmBook(book);
    setConfirmBookStatus(nextStatus);
  }

  // =====================================================
  // CHANGE BOOK STATUS
  // =====================================================

  async function handleChangeBookStatus() {
    if (!confirmBook || !confirmBookStatus) {
      return;
    }

    setBookStatusLoading(true);

    try {
      const result = await masterDataRepository.changeBookStatus(
        confirmBook.id,
        {
          status: confirmBookStatus,
        },
      );

      setSuccessMessage(
        confirmBookStatus === "AVAILABLE"
          ? "Buku berhasil diaktifkan."
          : "Buku berhasil diarsipkan.",
      );

      const changedBook = result.data;

      setConfirmBook(null);
      setConfirmBookStatus(null);

      if (detailBook?.id === changedBook.id) {
        setDetailBook(changedBook);
      }

      const refreshed = await masterDataRepository.listBooks({
        search,
        status: statusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });

      setBooks(refreshed.data);

      setTotal(refreshed.total);

      setTotalPages(refreshed.totalPages);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Status buku gagal diubah.";

      if (
        message ===
        "Buku tidak dapat diarsipkan karena masih memiliki copy yang sedang dipinjam."
      ) {
        setWarningMessage(message);
      } else {
        setError(message);
      }

      setConfirmBook(null);
      setConfirmBookStatus(null);
    } finally {
      setBookStatusLoading(false);
    }
  }

  // =====================================================
  // HELPERS
  // =====================================================

  function getBookStatusLabel(status: BookStatus) {
    if (status === "AVAILABLE") {
      return "Tersedia";
    }

    if (status === "BORROWED") {
      return "Dipinjam";
    }

    return "Diarsipkan";
  }

  function getCopyStatusLabel(status: BookCopyStatus) {
    if (status === "AVAILABLE") {
      return "Tersedia";
    }

    if (status === "BORROWED") {
      return "Dipinjam";
    }

    if (status === "LOST") {
      return "Hilang";
    }

    return "Tidak Aktif";
  }

  function getBookStatusClass(status: BookStatus) {
    if (status === "AVAILABLE") {
      return "bg-emerald-50 text-emerald-700";
    }

    if (status === "BORROWED") {
      return "bg-amber-50 text-amber-700";
    }

    return "bg-red-50 text-red-600";
  }

  function getCopyStatusClass(status: BookCopyStatus) {
    if (status === "AVAILABLE") {
      return "bg-emerald-50 text-emerald-700";
    }

    if (status === "BORROWED") {
      return "bg-amber-50 text-amber-700";
    }

    if (status === "LOST") {
      return "bg-red-50 text-red-600";
    }

    return "bg-slate-100 text-slate-600";
  }

  // =====================================================
  // INITIAL LOADING
  // =====================================================

  if (loading && books.length === 0 && !error) {
    return (
      <main className="min-h-screen bg-slate-50">
        <LoadingState label="Memuat data buku..." />
      </main>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
        {/* HEADER */}

        <div className="mb-4">
          <BackLink href="/dashboard" />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Master Buku
              </h1>

              <p className="mt-0.5 text-sm text-slate-500">
                Kelola data buku dan copy perpustakaan.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  alert("Fitur Import Excel belum tersedia.");
                }}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Import Excel
              </button>

              <button
                type="button"
                onClick={() => {
                  alert("Fitur Export Excel belum tersedia.");
                }}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Export Excel
              </button>

              {canManageMasterData(getSession()?.user.role ?? "MEMBER") && (
                <Button
                  type="button"
                  onClick={openCreateForm}
                  className="w-full sm:w-auto"
                >
                  + Tambah Buku
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* SUCCESS */}

        {successMessage && (
          <div
            className="fixed right-4 top-4 z-[80] w-[min(380px,calc(100vw-2rem))]"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-white p-4 shadow-lg ring-1 ring-slate-900/5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700"
                aria-hidden="true"
              >
                ✓
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Berhasil</p>

                <p className="mt-1 text-sm leading-5 text-slate-500">
                  {successMessage}
                </p>
              </div>

              <button
                type="button"
                aria-label="Tutup notifikasi sukses"
                onClick={() => setSuccessMessage("")}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* WARNING */}

        {warningMessage && (
          <div
            className="fixed right-4 top-4 z-[80] w-[min(380px,calc(100vw-2rem))]"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-white p-4 shadow-lg ring-1 ring-slate-900/5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
                aria-hidden="true"
              >
                !
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  Perhatian
                </p>

                <p className="mt-1 text-sm leading-5 text-slate-500">
                  {warningMessage}
                </p>
              </div>

              <button
                type="button"
                aria-label="Tutup notifikasi"
                onClick={() => setWarningMessage("")}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* SEARCH */}

        <Card className="mb-3 p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-end">
            <Input
              id="book-search"
              label="Cari Buku"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Judul, kode, ISBN, pengarang, atau kategori..."
            />

            <div>
              <label
                htmlFor="book-status"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Status
              </label>

              <Dropdown
                id="book-status"
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value as BookStatus | "");
                  setPage(1);
                }}
                ariaLabel="Filter status buku"
                options={[
                  {
                    value: "",
                    label: "Semua Status",
                  },
                  {
                    value: "AVAILABLE",
                    label: "Tersedia",
                  },
                  {
                    value: "BORROWED",
                    label: "Dipinjam",
                  },
                  {
                    value: "INACTIVE",
                    label: "Diarsipkan",
                  },
                ]}
              />
            </div>
          </div>
        </Card>

        {/* ERROR & WARNING */}

        {error && (
          <div
            role="alert"
            className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* BOOK LIST */}

        <Card className="overflow-hidden">
          {/* EMPTY */}

          {!loading && books.length === 0 && (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                ?
              </div>

              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                Buku tidak ditemukan
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                Coba ubah kata pencarian atau filter status.
              </p>
            </div>
          )}

          {/* DESKTOP TABLE */}

          {books.length > 0 && (
            <div className="relative hidden overflow-hidden lg:block">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[125px]" />
                  <col />
                  <col className="w-[150px]" />
                  <col className="w-[130px]" />
                  <col className="w-[130px]" />
                  <col className="w-[270px]" />
                </colgroup>

                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Kode</th>

                    <th className="px-4 py-2.5">Buku</th>

                    <th className="px-4 py-2.5">Kategori</th>

                    <th className="px-4 py-2.5">Copy</th>

                    <th className="px-4 py-2.5">Status</th>

                    <th className="px-4 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {books.map((book) => {
                    const isInactive = book.status === "INACTIVE";

                    return (
                      <tr
                        key={book.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {book.code}
                        </td>

                        <td className="min-w-0 px-4 py-3">
                          <p className="truncate font-medium text-slate-800">
                            {book.title}
                          </p>

                          <p className="mt-0.5 truncate text-xs text-slate-400">
                            {book.isbn
                              ? `ISBN ${book.isbn}`
                              : (book.author ?? "Tidak ada ISBN/pengarang")}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {book.category ?? "-"}
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800">
                            {book.availableCopies}
                          </span>

                          <span className="text-slate-400">
                            {" "}
                            / {book.totalCopies}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${getBookStatusClass(
                              book.status,
                            )}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />

                            {getBookStatusLabel(book.status)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void openDetail(book)}
                              className="inline-flex h-8 min-w-[56px] items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              Detail
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditForm(book)}
                              className="inline-flex h-8 min-w-[52px] items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              Ubah
                            </button>

                            <button
                              type="button"
                              onClick={() => openBookStatusConfirm(book)}
                              className={`inline-flex h-8 min-w-[88px] items-center justify-center rounded-md border px-2.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                isInactive
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                              }`}
                            >
                              {isInactive ? "Aktifkan" : "Arsipkan"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {tableLoading && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-white/70"
                  role="status"
                  aria-live="polite"
                  aria-label="Memuat data buku"
                >
                  <div className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                    Memuat data...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MOBILE / TABLET */}

          {books.length > 0 && (
            <div className="relative grid grid-cols-1 gap-3 bg-slate-50/60 p-3 sm:grid-cols-2 lg:hidden">
              {books.map((book) => {
                const isInactive = book.status === "INACTIVE";

                return (
                  <div
                    key={book.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-slate-400">
                          {book.code}
                        </p>

                        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                          {book.title}
                        </p>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${getBookStatusClass(
                          book.status,
                        )}`}
                      >
                        {getBookStatusLabel(book.status)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Kategori
                        </p>

                        <p className="mt-0.5 truncate text-xs font-medium text-slate-700">
                          {book.category ?? "-"}
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Copy
                        </p>

                        <p className="mt-0.5 text-xs font-medium text-slate-700">
                          <span className="font-bold">
                            {book.availableCopies}
                          </span>
                          {" / "}
                          {book.totalCopies}
                        </p>
                      </div>
                    </div>

                    {book.isbn && (
                      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          ISBN
                        </p>

                        <p className="mt-0.5 truncate text-xs font-medium text-slate-700">
                          {book.isbn}
                        </p>
                      </div>
                    )}

                    {book.author && (
                      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Pengarang
                        </p>

                        <p className="mt-0.5 truncate text-xs font-medium text-slate-700">
                          {book.author}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => void openDetail(book)}
                        className="h-9 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        Detail
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditForm(book)}
                        className="h-9 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        Ubah
                      </button>

                      <button
                        type="button"
                        onClick={() => openBookStatusConfirm(book)}
                        className={`h-9 rounded-md border text-xs font-semibold ${
                          isInactive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-600"
                        }`}
                      >
                        {isInactive ? "Aktifkan" : "Arsipkan"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {tableLoading && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-white/70"
                  role="status"
                  aria-live="polite"
                >
                  <div className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                    Memuat data...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PAGINATION */}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2.5 sm:px-4">
              <p className="text-xs text-slate-500">
                Halaman {page} dari {totalPages}
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ←
                </button>

                {Array.from(
                  {
                    length: totalPages,
                  },
                  (_, index) => index + 1,
                )
                  .filter(
                    (number) =>
                      number === 1 ||
                      number === totalPages ||
                      Math.abs(number - page) <= 1,
                  )
                  .map((number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setPage(number)}
                      className={`h-8 min-w-8 rounded-md px-2 text-xs font-semibold ${
                        number === page
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {number}
                    </button>
                  ))}

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* =====================================================
          ADD / EDIT BOOK MODAL
      ===================================================== */}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !bookFormLoading) {
              closeForm();
            }
          }}
        >
          <div
            ref={formModalRef}
            className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-form-title"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2
                  id="book-form-title"
                  className="text-base font-semibold text-slate-900"
                >
                  {editingBook ? "Ubah Buku" : "Tambah Buku"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  {editingBook
                    ? "Perbarui informasi buku."
                    : "Masukkan data buku dan jumlah copy awal."}
                </p>
              </div>

              <button
                ref={formCloseRef}
                type="button"
                disabled={bookFormLoading}
                aria-label="Tutup form"
                onClick={closeForm}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid gap-3.5 p-4 sm:grid-cols-2"
            >
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
                disabled={Boolean(editingBook)}
                required
              />

              <Input
                id="book-title"
                label="Judul"
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
                placeholder="Judul buku"
                required
              />

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
                placeholder="978..."
              />

              <Input
                id="book-author"
                label="Pengarang (opsional)"
                value={bookAuthor}
                onChange={(event) => setBookAuthor(event.target.value)}
                placeholder="Nama pengarang"
              />

              <Input
                id="book-category"
                label="Kategori (opsional)"
                value={bookCategory}
                onChange={(event) => setBookCategory(event.target.value)}
                placeholder="Contoh: Fiksi"
              />

              {!editingBook && (
                <Input
                  id="book-total-copies"
                  label="Jumlah Copy Awal"
                  type="number"
                  min={1}
                  inputMode="numeric"
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
                  required
                />
              )}

              {editingBook && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Copy
                  </p>

                  <p className="mt-0.5 text-sm font-semibold text-slate-800">
                    {editingBook.totalCopies} copy
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Tambah copy dilakukan dari detail buku.
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:col-span-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={bookFormLoading}
                  onClick={closeForm}
                  className="w-full sm:w-auto"
                >
                  Batal
                </Button>

                <Button
                  type="submit"
                  loading={bookFormLoading}
                  className="w-full sm:w-auto"
                >
                  {editingBook ? "Simpan Perubahan" : "Simpan Buku"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          DETAIL BOOK MODAL
      ===================================================== */}

      {detailBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDetailBook(null);
            }
          }}
        >
          <div
            ref={detailModalRef}
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-detail-title"
          >
            {/* HEADER */}

            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-400">
                    {detailBook.code}
                  </p>

                  <h2
                    id="book-detail-title"
                    className="mt-0.5 truncate text-xl font-bold text-slate-900"
                  >
                    {detailBook.title}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${getBookStatusClass(
                        detailBook.status,
                      )}`}
                    >
                      {getBookStatusLabel(detailBook.status)}
                    </span>

                    <span className="text-xs text-slate-500">
                      {detailBook.availableCopies} tersedia dari{" "}
                      {detailBook.totalCopies} copy
                    </span>
                  </div>
                </div>

                <button
                  ref={detailCloseRef}
                  type="button"
                  aria-label="Tutup detail buku"
                  onClick={() => setDetailBook(null)}
                  className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  ×
                </button>
              </div>
            </div>

            {/* BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-5">
              {detailError && (
                <div
                  role="alert"
                  className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {detailError}
                </div>
              )}

              {/* INFORMATION */}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Kode Buku
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailBook.code}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    ISBN
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailBook.isbn ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Pengarang
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailBook.author ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Kategori
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailBook.category ?? "-"}
                  </p>
                </div>
              </div>

              {/* COPY */}

              <div className="relative mt-5 rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Daftar Copy
                    </h3>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Total {detailCopies.length} copy.
                    </p>
                  </div>

                  {canManageMasterData(getSession()?.user.role ?? "MEMBER") && (
                    <Button
                      type="button"
                      onClick={() => void handleAddCopy()}
                      loading={addCopyLoading}
                      disabled={detailBook.status === "INACTIVE"}
                      className="w-full sm:w-auto"
                    >
                      + Tambah Copy
                    </Button>
                  )}
                </div>

                {detailLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    Memuat daftar copy...
                  </div>
                ) : detailCopies.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    Belum ada copy buku.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {detailCopies.map((copy) => {
                      const isBorrowed = copy.status === "BORROWED";

                      return (
                        <div
                          key={copy.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {copy.code}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              Copy
                            </p>
                          </div>

                          <div className="shrink-0">
                            {copy.status === "BORROWED" ? (
                              <span
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getCopyStatusClass(
                                  copy.status,
                                )}`}
                              >
                                {getCopyStatusLabel(copy.status)}
                              </span>
                            ) : canManageMasterData(
                                getSession()?.user.role ?? "MEMBER",
                              ) ? (
                              <Dropdown
                                value={copy.status}
                                onChange={(value) =>
                                  handleCopyStatusChange(
                                    copy,
                                    value as BookCopyStatus,
                                  )
                                }
                                ariaLabel={`Status ${copy.code}`}
                                disabled={copyStatusLoading}
                                variant="badge"
                                options={[
                                  { value: "AVAILABLE", label: "Tersedia" },
                                  { value: "INACTIVE", label: "Tidak Aktif" },
                                  { value: "LOST", label: "Hilang" },
                                ]}
                              />
                            ) : (
                              <span
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getCopyStatusClass(
                                  copy.status,
                                )}`}
                              >
                                {getCopyStatusLabel(copy.status)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* FOOTER */}

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
              {" "}
              {canManageMasterData(getSession()?.user.role ?? "MEMBER") && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setDetailBook(null);
                      openEditForm(detailBook);
                    }}
                    className="w-full sm:w-auto"
                  >
                    Ubah Buku
                  </Button>

                  <Button
                    type="button"
                    onClick={() => openBookStatusConfirm(detailBook)}
                    className="w-full sm:w-auto"
                  >
                    {detailBook.status === "INACTIVE"
                      ? "Aktifkan Buku"
                      : "Arsipkan Buku"}
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDetailBook(null)}
                className="w-full sm:w-auto"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          COPY STATUS CONFIRMATION
      ===================================================== */}

      <ConfirmationDialog
        open={Boolean(confirmCopy && confirmCopyStatus)}
        title={
          confirmCopyStatus === "AVAILABLE"
            ? "Aktifkan Copy?"
            : "Nonaktifkan Copy?"
        }
        description={
          confirmCopy
            ? confirmCopyStatus === "AVAILABLE"
              ? `Copy "${confirmCopy.code}" akan diaktifkan kembali.`
              : `Copy "${confirmCopy.code}" akan dinonaktifkan. Data tetap tersimpan.`
            : ""
        }
        confirmLabel={
          confirmCopyStatus === "AVAILABLE" ? "Ya, Aktifkan" : "Ya, Nonaktifkan"
        }
        onClose={() => {
          if (!copyStatusLoading) {
            setConfirmCopy(null);
            setConfirmCopyStatus(null);
          }
        }}
        onConfirm={() => {
          void handleChangeCopyStatus();
        }}
      />

      {/* =====================================================
          BOOK STATUS CONFIRMATION
      ===================================================== */}

      <ConfirmationDialog
        open={Boolean(confirmBook && confirmBookStatus)}
        title={
          confirmBookStatus === "AVAILABLE"
            ? "Aktifkan Buku?"
            : "Arsipkan Buku?"
        }
        description={
          confirmBook
            ? confirmBookStatus === "AVAILABLE"
              ? `Buku "${confirmBook.title}" akan diaktifkan kembali.`
              : `Buku "${confirmBook.title}" akan diarsipkan. Data master dan riwayat transaksi tetap tersimpan.`
            : ""
        }
        confirmLabel={
          confirmBookStatus === "AVAILABLE" ? "Ya, Aktifkan" : "Ya, Arsipkan"
        }
        onClose={() => {
          if (!bookStatusLoading) {
            setConfirmBook(null);
            setConfirmBookStatus(null);
          }
        }}
        onConfirm={() => {
          void handleChangeBookStatus();
        }}
      />
    </main>
  );
}
