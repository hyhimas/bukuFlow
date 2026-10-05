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
  const [copyPage, setCopyPage] = useState<number>(1);
  const COPY_PAGE_SIZE = 5;

  const [detailLoading, setDetailLoading] = useState(false);

  const [detailError, setDetailError] = useState("");

  const detailCloseRef = useRef<HTMLButtonElement>(null);

  const detailModalRef = useRef<HTMLDivElement>(null);

  // =====================================================
  // ADD COPY
  // =====================================================

  const [addCopyModalOpen, setAddCopyModalOpen] = useState(false);
  const [addCopyCount, setAddCopyCount] = useState(1);
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
    setCopyPage(1);
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
        const borrowed = copies.filter((c) => c.status === "BORROWED").length;
        const status =
          activeBook.status === "INACTIVE"
            ? "INACTIVE"
            : available === 0 && borrowed > 0
            ? "BORROWED"
            : "AVAILABLE";

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
          const borrowed = copies.filter((c) => c.status === "BORROWED").length;
          const status =
            baseBook.status === "INACTIVE"
              ? "INACTIVE"
              : available === 0 && borrowed > 0
              ? "BORROWED"
              : "AVAILABLE";

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

  async function handleAddCopy(count: number = addCopyCount) {
    if (!detailBook || addCopyLoading) {
      return;
    }

    setAddCopyLoading(true);
    setDetailError("");

    try {
      const result = await masterDataRepository.createBookCopy({
        bookId: detailBook.id,
        count,
      });

      toast.success(result.message || "Copy buku berhasil ditambahkan.");
      setAddCopyModalOpen(false);
      setAddCopyCount(1);

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
    if (detailBook?.status === "INACTIVE") {
      toast.warning("Buku sedang diarsipkan. Aktifkan buku terlebih dahulu untuk mengubah status copy.");
      return;
    }

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

    if (detailBook?.status === "INACTIVE") {
      toast.warning(
        "Buku sedang diarsipkan. Aktifkan buku terlebih dahulu untuk mengubah status copy.",
      );
      setConfirmCopy(null);
      setConfirmCopyStatus(null);
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
                className="w-full sm:w-auto text-xs h-9 px-3 text-center whitespace-nowrap flex items-center justify-center gap-1.5"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect width="12" height="8" x="6" y="14" />
                </svg>
                <span>Cetak Semua Barcode</span>
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
                  <col className="w-[140px]" />
                  <col className="w-auto" />
                  <col className="w-[110px]" />
                  <col className="w-[70px]" />
                  <col className="w-[110px]" />
                  <col className="w-[310px]" />
                </colgroup>
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3.5 py-3">Kode</th>
                    <th className="px-3.5 py-3">Buku</th>
                    <th className="px-3 py-3">Kategori</th>
                    <th className="px-2 py-3 text-center">Copy</th>
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
                        <td className="px-3.5 py-3 font-semibold text-slate-900 truncate text-xs" title={book.code}>
                          {book.code}
                        </td>

                        <td className="px-3.5 py-3 min-w-0">
                          <p className="truncate font-semibold text-slate-800 text-xs sm:text-sm" title={book.title}>
                            {book.title}
                          </p>

                          {(book.author && book.author !== "-") || (book.isbn && book.isbn !== "-") ? (
                            <p className="mt-0.5 truncate text-[11px] text-slate-400">
                              {book.author && book.author !== "-" && book.isbn && book.isbn !== "-"
                                ? `${book.author} · ISBN ${book.isbn}`
                                : book.author && book.author !== "-"
                                ? book.author
                                : `ISBN ${book.isbn}`}
                            </p>
                          ) : null}
                        </td>

                        <td className="px-3 py-3 text-slate-600 truncate text-xs">
                          {book.category ?? "-"}
                        </td>

                        <td className="px-2 py-3 whitespace-nowrap text-xs text-center">
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
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => void openDetail(book)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              <span>Detail</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handlePrintBookCopies(book)}
                              title="Cetak Barcode & QR Code Semua Copy"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" />
                              </svg>
                              <span>Barcode</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditForm(book)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openBookStatusConfirm(book)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold shadow-2xs transition focus:outline-none focus-visible:ring-2 ${
                                isInactive
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 focus-visible:ring-emerald-500"
                                  : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 focus-visible:ring-amber-500"
                              }`}
                            >
                              {isInactive ? (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                  </svg>
                                  <span>Aktifkan</span>
                                </>
                              ) : (
                                <>
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <rect width="20" height="5" x="2" y="3" rx="1" />
                                    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                                    <path d="M10 12h4" />
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

                      {book.isbn && book.isbn !== "-" && (
                        <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            ISBN
                          </p>

                          <p className="mt-0.5 truncate text-xs font-medium text-slate-700">
                            {book.isbn}
                          </p>
                        </div>
                      )}

                      {book.author && book.author !== "-" && (
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
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect width="20" height="5" x="2" y="3" rx="1" />
                              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                              <path d="M10 12h4" />
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

            <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-400 font-mono">
                    {detailBook.code}
                  </p>

                  <h2
                    id="book-detail-title"
                    className="mt-0.5 text-base sm:text-xl font-bold text-slate-900 leading-snug break-words"
                  >
                    {detailBook.title}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getBookStatusClass(
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
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-3.5 sm:p-5">
              {detailError && (
                <div
                  role="alert"
                  className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm text-red-700"
                >
                  {detailError}
                </div>
              )}

              {/* INFORMATION: 2 kolom di mobile dan desktop agar hemat ruang */}

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:px-4 sm:py-3 shadow-2xs">
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Kode Buku
                  </p>

                  <p className="mt-0.5 sm:mt-1 truncate text-xs sm:text-sm font-semibold text-slate-800">
                    {detailBook.code}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:px-4 sm:py-3 shadow-2xs">
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    ISBN
                  </p>

                  <p className="mt-0.5 sm:mt-1 truncate text-xs sm:text-sm font-semibold text-slate-800">
                    {detailBook.isbn ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:px-4 sm:py-3 shadow-2xs">
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Pengarang
                  </p>

                  <p className="mt-0.5 sm:mt-1 truncate text-xs sm:text-sm font-semibold text-slate-800">
                    {detailBook.author ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:px-4 sm:py-3 shadow-2xs">
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Kategori
                  </p>

                  <p className="mt-0.5 sm:mt-1 truncate text-xs sm:text-sm font-semibold text-slate-800">
                    {detailBook.category ?? "-"}
                  </p>
                </div>
              </div>

              {/* COPY */}

              <div className="relative mt-3.5 sm:mt-5 rounded-xl border border-slate-200 bg-white shadow-2xs">
                <div className="flex flex-col gap-2.5 border-b border-slate-100 px-3.5 py-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Daftar Copy
                    </h3>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Total {detailCopies.length} copy fisik.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handlePrintBookCopies(detailBook, detailCopies)}
                      disabled={detailCopies.length === 0}
                      className="flex-1 sm:flex-initial text-xs h-8 px-2.5 sm:px-3 flex items-center justify-center gap-1.5"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect width="12" height="8" x="6" y="14" />
                      </svg>
                      <span className="truncate">Cetak Semua</span>
                    </Button>

                    {canManageMasterData(getSession()?.user.role ?? "MEMBER") && (
                      <Button
                        type="button"
                        onClick={() => {
                          setAddCopyCount(1);
                          setAddCopyModalOpen(true);
                        }}
                        disabled={detailBook.status === "INACTIVE"}
                        className="flex-1 sm:flex-initial text-xs h-8 px-3 font-semibold"
                      >
                        + Tambah Copy
                      </Button>
                    )}
                  </div>
                </div>

                {detailBook.status === "INACTIVE" && (
                  <div className="mx-3.5 my-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>
                      <p className="font-semibold text-amber-900">
                        Buku Sedang Diarsipkan
                      </p>
                      <p className="mt-0.5 text-amber-700">
                        Status copy dan penambahan copy fisik dikunci (mode hanya-baca). Aktifkan buku terlebih dahulu untuk mengubah atau menambah copy.
                      </p>
                    </div>
                  </div>
                )}

                {detailLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    Memuat daftar copy...
                  </div>
                ) : detailCopies.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    Belum ada copy buku.
                  </div>
                ) : (() => {
                  const totalCopyPages = Math.ceil(detailCopies.length / COPY_PAGE_SIZE);
                  const safeCurrentCopyPage = Math.min(Math.max(1, copyPage), totalCopyPages);
                  const paginatedCopies = detailCopies.slice(
                    (safeCurrentCopyPage - 1) * COPY_PAGE_SIZE,
                    safeCurrentCopyPage * COPY_PAGE_SIZE,
                  );

                  return (
                    <>
                      <div className="divide-y divide-slate-100">
                        {paginatedCopies.map((copy) => {
                          const isBorrowed = copy.status === "BORROWED";

                          return (
                            <div
                              key={copy.id}
                              className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3"
                            >
                              <div className="min-w-0">
                                <p className="font-mono text-xs sm:text-sm font-semibold text-slate-800 truncate">
                                  {copy.code}
                                </p>
                                <p className="text-[11px] sm:text-xs text-slate-400">
                                  Copy Fisik
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handlePrintSingleCopy(detailBook, copy)}
                                  title="Cetak Barcode Copy Ini"
                                  className="inline-flex h-7 sm:h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                  <svg
                                    width="11"
                                    height="11"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="6 9 6 2 18 2 18 9" />
                                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                    <rect width="12" height="8" x="6" y="14" />
                                  </svg>
                                  <span>Cetak</span>
                                </button>

                                {copy.status === "BORROWED" || detailBook.status === "INACTIVE" ? (
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getCopyStatusClass(
                                      copy.status,
                                    )}`}
                                    title={
                                      detailBook.status === "INACTIVE"
                                        ? "Buku sedang diarsipkan. Aktifkan buku untuk mengubah status copy."
                                        : undefined
                                    }
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

                      {detailCopies.length > COPY_PAGE_SIZE && (
                        <Pagination
                          currentPage={safeCurrentCopyPage}
                          totalPages={totalCopyPages}
                          onPageChange={(nextPage) => setCopyPage(nextPage)}
                          totalItems={detailCopies.length}
                          pageSize={COPY_PAGE_SIZE}
                          className="rounded-b-xl border-t border-slate-100 bg-slate-50/50"
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* FOOTER */}

            <div className="flex shrink-0 flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDetailBook(null)}
                className="w-full sm:w-auto text-xs sm:ml-auto"
              >
                Tutup
              </Button>

              
                
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          ADD COPY MODAL (BULK / SINGLE)
      ===================================================== */}
      {addCopyModalOpen && detailBook && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="presentation"
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-copy-modal-title"
          >
            {/* Header */}
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3
                    id="add-copy-modal-title"
                    className="text-base font-bold text-slate-900"
                  >
                    Tambah Copy Fisik
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                    {detailBook.title} ({detailBook.code})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !addCopyLoading && setAddCopyModalOpen(false)}
                  disabled={addCopyLoading}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAddCopy(addCopyCount);
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jumlah Copy yang Ingin Ditambahkan
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAddCopyCount((prev) => Math.max(1, prev - 1))}
                    disabled={addCopyLoading || addCopyCount <= 1}
                    className="h-10 w-10 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={addCopyCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setAddCopyCount(isNaN(val) ? 1 : Math.max(1, Math.min(100, val)));
                    }}
                    disabled={addCopyLoading}
                    className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-center text-base font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setAddCopyCount((prev) => Math.min(100, prev + 1))}
                    disabled={addCopyLoading || addCopyCount >= 100}
                    className="h-10 w-10 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {[1, 2, 5, 10].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAddCopyCount(preset)}
                      disabled={addCopyLoading}
                      className={`flex-1 rounded-md py-1 text-xs font-medium transition ${
                        addCopyCount === preset
                          ? "bg-blue-600 text-white font-semibold shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Information Preview Box */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Total copy saat ini:</span>
                  <span className="font-semibold text-slate-800">{detailCopies.length} copy</span>
                </div>
                <div className="flex justify-between">
                  <span>Akan ditambahkan:</span>
                  <span className="font-semibold text-blue-600">+{addCopyCount} copy</span>
                </div>
                <div className="border-t border-slate-200/60 pt-1.5 flex justify-between font-medium">
                  <span className="text-slate-800">Total setelah penambahan:</span>
                  <span className="font-bold text-slate-900">{detailCopies.length + addCopyCount} copy</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAddCopyModalOpen(false)}
                  disabled={addCopyLoading}
                  className="text-xs h-9 px-4"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  loading={addCopyLoading}
                  className="text-xs h-9 px-4"
                >
                  {addCopyLoading
                    ? "Menambahkan..."
                    : `Tambahkan ${addCopyCount} Copy`}
                </Button>
              </div>
            </form>
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
