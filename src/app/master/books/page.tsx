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
import Pagination from "@/components/ui/Pagination";

import type { Book, BookCopy, BookCopyStatus, BookStatus } from "@/lib/types";

import { masterDataRepository } from "@/lib/master-data/repository";
import { getBookCopiesApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import BookBarcodePrintModal, {
  PrintableBookItem,
} from "@/components/barcode/BookBarcodePrintModal";

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

const PAGE_SIZE = 10;

export default function MasterBooksPage() {
  const router = useRouter();
  const { toast } = useToast();

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
  // BARCODE & QR PRINT
  // =====================================================

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printItems, setPrintItems] = useState<PrintableBookItem[]>([]);
  const [printTitle, setPrintTitle] = useState("Cetak Label Barcode & QR Code");
  const [bulkPrintLoading, setBulkPrintLoading] = useState(false);

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
    setBookFormLoading(false);
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
    setBookFormLoading(false);
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
    setBookFormLoading(false);
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
          toast.warning("Data masih sama, tidak ada perubahan yang disimpan.");
          closeForm();
          return;
        }

        await masterDataRepository.updateBook(editingBook.id, {
          title: newTitle,
          isbn: newIsbn || undefined,
          author: newAuthor || undefined,
          category: newCategory || undefined,
        });

        toast.success("Data buku berhasil diperbarui.");
      } else {
        await masterDataRepository.createBook({
          code: bookCode.trim(),
          title: bookTitle.trim(),
          isbn: bookIsbn.trim() || undefined,
          author: bookAuthor.trim() || undefined,
          category: bookCategory.trim() || undefined,
          totalCopies: Number(bookTotalCopies),
        });

        toast.success("Buku berhasil ditambahkan.");
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
        error instanceof Error ? error.message : "Data buku gagal disimpan.";
      toast.error(message);
    } finally {
      setBookFormLoading(false);
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

      const activeBook = bookResult ?? book;
      const copies = copiesResult.data;

      if (copies.length > 0) {
        const total = copies.length;
        const available = copies.filter((c) => c.status === "AVAILABLE").length;
        const status =
          activeBook.status === "INACTIVE"
            ? "INACTIVE"
            : available > 0
            ? "AVAILABLE"
            : "BORROWED";

        setDetailBook({
          ...activeBook,
          totalCopies: total,
          availableCopies: available,
          status,
        });
      } else {
        setDetailBook(activeBook);
      }

      setDetailCopies(copies);
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

      const copies = copiesResult.data;
      if (bookResult || detailBook) {
        const baseBook = bookResult ?? detailBook!;
        if (copies.length > 0) {
          const total = copies.length;
          const available = copies.filter((c) => c.status === "AVAILABLE").length;
          const status =
            baseBook.status === "INACTIVE"
              ? "INACTIVE"
              : available > 0
              ? "AVAILABLE"
              : "BORROWED";

          setDetailBook({
            ...baseBook,
            totalCopies: total,
            availableCopies: available,
            status,
          });
        } else {
          setDetailBook(baseBook);
        }
      }

      setDetailCopies(copies);

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

      toast.success("Copy buku berhasil ditambahkan.");

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
        bookId: copy.bookId,
      });

      toast.success(
        `Status copy ${copy.code} berhasil diubah menjadi ${getCopyStatusLabel(
          nextStatus,
        )}.`,
      );

      await refreshDetail(copy.bookId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Status copy gagal diubah.";

      toast.warning(message);
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
        bookId: confirmCopy.bookId,
      });

      toast.success(
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

      toast.success(
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
        toast.warning(message);
      } else {
        toast.error(message);
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
  // BARCODE & QR HANDLERS
  // =====================================================

  async function handlePrintAllCurrentBooks() {
    if (bulkPrintLoading) return;
    setBulkPrintLoading(true);
    try {
      const allBooksResponse = await masterDataRepository
        .listBooks({ pageSize: 500 })
        .catch(() => null);
      const catalogBooks =
        allBooksResponse?.data && allBooksResponse.data.length > 0
          ? allBooksResponse.data
          : books;

      const items: PrintableBookItem[] = [];
      for (const book of catalogBooks) {
        try {
          const copies = await getBookCopiesApi(book.id);
          if (copies.length > 0) {
            for (const copy of copies) {
              items.push({
                bookTitle: book.title,
                bookCode: book.code,
                copyCode: copy.code,
                category: book.category,
              });
            }
          } else {
            items.push({
              bookTitle: book.title,
              bookCode: book.code,
              copyCode: book.code,
              category: book.category,
            });
          }
        } catch {
          items.push({
            bookTitle: book.title,
            bookCode: book.code,
            copyCode: book.code,
            category: book.category,
          });
        }
      }
      setPrintItems(items);
      setPrintTitle(`Cetak Barcode & QR Code (${items.length} Copy Buku)`);
      setPrintModalOpen(true);
    } catch {
      toast.error("Gagal menyiapkan data cetak barcode.");
    } finally {
      setBulkPrintLoading(false);
    }
  }

  async function handlePrintBookCopies(book: Book, existingCopies?: BookCopy[]) {
    try {
      let copies = existingCopies;
      if (!copies || copies.length === 0) {
        copies = await getBookCopiesApi(book.id);
      }
      const items: PrintableBookItem[] =
        copies && copies.length > 0
          ? copies.map((copy) => ({
              bookTitle: book.title,
              bookCode: book.code,
              copyCode: copy.code,
              category: book.category,
            }))
          : [
              {
                bookTitle: book.title,
                bookCode: book.code,
                copyCode: book.code,
                category: book.category,
              },
            ];
      setPrintItems(items);
      setPrintTitle(`Cetak Label Barcode - ${book.title}`);
      setPrintModalOpen(true);
    } catch {
      toast.error("Gagal menyiapkan label barcode buku.");
    }
  }

  function handlePrintSingleCopy(book: Book, copy: BookCopy) {
    setPrintItems([
      {
        bookTitle: book.title,
        bookCode: book.code,
        copyCode: copy.code,
        category: book.category,
      },
    ]);
    setPrintTitle(`Cetak Label Copy - ${copy.code}`);
    setPrintModalOpen(true);
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
    <main className="min-h-screen bg-slate-50 print:bg-white print:min-h-0">
      <div className="barcode-page-content print:hidden mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
        {/* HEADER */}

        <div className="mb-4">
          <BackLink href="/dashboard" />

          <div className="mt-3 flex flex-col gap-3.5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Master Buku
              </h1>

              <p className="mt-0.5 text-sm text-slate-500">
                Kelola data buku dan copy perpustakaan.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-center sm:gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  alert("Fitur Import Excel belum tersedia.");
                }}
                className="w-full sm:w-auto text-xs h-9 px-3 text-center whitespace-nowrap"
              >
                Import Excel
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  alert("Fitur Export Excel belum tersedia.");
                }}
                className="w-full sm:w-auto text-xs h-9 px-3 text-center whitespace-nowrap"
              >
                Export Excel
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => void handlePrintAllCurrentBooks()}
                loading={bulkPrintLoading}
                className="w-full sm:w-auto text-xs h-9 px-3 text-center whitespace-nowrap"
              >
                🖨️ Cetak Semua Barcode
              </Button>

              {canManageMasterData(getSession()?.user.role ?? "MEMBER") && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={openCreateForm}
                  className="w-full sm:w-auto text-xs h-9 px-3.5 font-semibold text-center whitespace-nowrap"
                >
                  + Tambah Buku
                </Button>
              )}
            </div>
          </div>
        </div>

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

          {/* TABLE (Desktop: >= lg) */}

          {books.length > 0 && (
            <div className="relative hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm text-slate-600 table-fixed">
                <colgroup>
                  <col className="w-[80px]" />
                  <col />
                  <col className="w-[140px]" />
                  <col className="w-[85px]" />
                  <col className="w-[110px]" />
                  <col className="w-[340px]" />
                </colgroup>
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Kode</th>
                    <th className="px-3 py-3">Buku</th>
                    <th className="px-3 py-3">Kategori</th>
                    <th className="px-3 py-3 text-center">Copy</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
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
                        <td className="px-3 py-3 font-semibold text-slate-900 whitespace-nowrap text-xs">
                          {book.code}
                        </td>

                        <td className="px-3 py-3 min-w-0">
                          <p className="truncate font-semibold text-slate-800 text-xs sm:text-sm" title={book.title}>
                            {book.title}
                          </p>

                          <p className="mt-0.5 truncate text-[11px] text-slate-400">
                            {book.isbn
                              ? `ISBN ${book.isbn}`
                              : (book.author ?? "Tidak ada ISBN/pengarang")}
                          </p>
                        </td>

                        <td className="px-3 py-3 text-slate-600 truncate text-xs">
                          {book.category ?? "-"}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap text-xs text-center">
                          <span className="font-bold text-slate-900">
                            {book.availableCopies}
                          </span>

                          <span className="text-slate-400">
                            {" "}
                            / {book.totalCopies}
                          </span>
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex whitespace-nowrap items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${getBookStatusClass(
                              book.status,
                            )}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />

                            {getBookStatusLabel(book.status)}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void openDetail(book)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              <span>Detail</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handlePrintBookCopies(book)}
                              title="Cetak Barcode & QR Code Semua Copy"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" />
                              </svg>
                              <span>Barcode</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditForm(book)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openBookStatusConfirm(book)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold shadow-2xs transition focus:outline-none focus-visible:ring-2 ${
                                isInactive
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 focus-visible:ring-emerald-500"
                                  : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 focus-visible:ring-amber-500"
                              }`}
                            >
                              {isInactive ? (
                                <>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                  </svg>
                                  <span>Aktifkan</span>
                                </>
                              ) : (
                                <>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                  </svg>
                                  <span>Arsipkan</span>
                                </>
                              )}
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

          {/* MOBILE & TABLET CARDS (< lg) */}

          {books.length > 0 && (
            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/60 p-3 lg:hidden">
              {books.map((book) => {
                const isInactive = book.status === "INACTIVE";

                return (
                  <div
                    key={book.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-400 font-mono">
                            {book.code}
                          </p>

                          <p className="mt-0.5 truncate text-sm font-semibold text-slate-900" title={book.title}>
                            {book.title}
                          </p>
                        </div>

                        <span
                          className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${getBookStatusClass(
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
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => void openDetail(book)}
                        className="h-9 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>Detail</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handlePrintBookCopies(book)}
                        className="h-9 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" />
                        </svg>
                        <span>Barcode</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditForm(book)}
                        className="h-9 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openBookStatusConfirm(book)}
                        className={`h-9 rounded-lg border text-xs font-semibold shadow-2xs flex items-center justify-center gap-1.5 transition focus:outline-none focus-visible:ring-2 ${
                          isInactive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 focus-visible:ring-emerald-500"
                            : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 focus-visible:ring-amber-500"
                        }`}
                      >
                        {isInactive ? (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <span>Aktifkan</span>
                          </>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                            <span>Arsipkan</span>
                          </>
                        )}
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

          {/* PAGINATION (MOBILE, TABLET & DESKTOP) */}

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(nextPage) => setPage(nextPage)}
            totalItems={total}
            pageSize={PAGE_SIZE}
          />
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
                <div className="flex flex-col gap-2.5 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Daftar Copy
                    </h3>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Total {detailCopies.length} copy fisik.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handlePrintBookCopies(detailBook, detailCopies)}
                      disabled={detailCopies.length === 0}
                      className="flex-1 sm:flex-initial text-xs h-8 px-3"
                    >
                      🖨️ Cetak Semua Copy
                    </Button>

                    {canManageMasterData(getSession()?.user.role ?? "MEMBER") && (
                      <Button
                        type="button"
                        onClick={() => void handleAddCopy()}
                        loading={addCopyLoading}
                        disabled={detailBook.status === "INACTIVE"}
                        className="flex-1 sm:flex-initial text-xs h-8 px-3"
                      >
                        + Tambah Copy
                      </Button>
                    )}
                  </div>
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
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-semibold text-slate-800">
                              {copy.code}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              Copy Fisik
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handlePrintSingleCopy(detailBook, copy)}
                              title="Cetak Barcode Copy Ini"
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              🖨️ Cetak
                            </button>

                            {copy.status === "BORROWED" ? (
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${getCopyStatusClass(
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
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${getCopyStatusClass(
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

            <div className="flex shrink-0 flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDetailBook(null)}
                className="w-full sm:w-auto text-xs"
              >
                Tutup
              </Button>

              {canManageMasterData(getSession()?.user.role ?? "MEMBER") && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setDetailBook(null);
                      openEditForm(detailBook);
                    }}
                    className="flex-1 sm:flex-initial text-xs"
                  >
                    Ubah Buku
                  </Button>

                  <Button
                    type="button"
                    variant={detailBook.status === "INACTIVE" ? "primary" : "secondary"}
                    onClick={() => openBookStatusConfirm(detailBook)}
                    className={`flex-1 sm:flex-initial text-xs ${
                      detailBook.status !== "INACTIVE"
                        ? "text-red-600 border-red-200 hover:bg-red-50"
                        : ""
                    }`}
                  >
                    {detailBook.status === "INACTIVE"
                      ? "Aktifkan Buku"
                      : "Arsipkan Buku"}
                  </Button>
                </div>
              )}
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

      {/* =====================================================
          BARCODE & QR PRINT MODAL
      ===================================================== */}

      <BookBarcodePrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        items={printItems}
        title={printTitle}
      />
    </main>
  );
}
