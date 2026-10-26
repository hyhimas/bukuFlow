"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import { canAccessMasterData, canManageMasterData } from "@/lib/authorization";
import Dropdown from "@/components/ui/Dropdown";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import BackLink from "@/components/ui/BackLink";
import LoadingState from "@/components/ui/LoadingState";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import RowActions from "@/components/ui/RowActions";
import ErrorState from "@/components/ui/ErrorState";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import { useSearchHotkey, useSubmitHotkey } from "@/hooks/useHotkeys";

import type { Book, BookCopy, BookCopyStatus, BookStatus } from "@/lib/types";

import { masterDataRepository } from "@/lib/master-data/repository";
import { getBookCopiesApi, getErrorMessage } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { exportToExcel } from "@/lib/export/excel";
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
  const [reloadKey, setReloadKey] = useState(0);

  const hasLoadedBooks = useRef(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // =====================================================
  // BARCODE & QR PRINT
  // =====================================================

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printItems, setPrintItems] = useState<PrintableBookItem[]>([]);
  const [printTitle, setPrintTitle] = useState("Cetak Label Barcode & QR Code");
  const [bulkPrintLoading, setBulkPrintLoading] = useState(false);
  const [bulkPrintProgress, setBulkPrintProgress] = useState<{ current: number; total: number } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [companyName] = useState(() => {
    if (typeof window === "undefined") return "Perpustakaan";
    const s = getSession();
    const u = s?.user as Record<string, unknown> | undefined;
    const c = u?.company as { name?: string } | undefined;
    return (
      (typeof u?.companyName === "string" ? u.companyName : undefined) ||
      (typeof c?.name === "string" ? c.name : undefined) ||
      "Perpustakaan"
    );
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchHotkey(searchInputRef, { enabled: !loading && !error });
  useSubmitHotkey(() => void handleSubmit(), { enabled: showForm, loading: bookFormLoading });
  useSubmitHotkey(() => void handleAddCopy(addCopyCount), { enabled: addCopyModalOpen, loading: addCopyLoading });

  // =====================================================
  // SESSION
  // =====================================================

  useEffect(() => {
    const session = getSession();

    if (!session) {
      if (!isStoredSessionExpired() && !hasStoredAuth()) {
        router.replace("/login");
      }
      return;
    }

    if (!canAccessMasterData(session.user.role)) {
      router.replace("/dashboard");
      return;
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
          page,
          pageSize,
          sortby: sortBy,
          order: sortOrder,
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
          getErrorMessage(error, "Data buku gagal dimuat.")
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
  }, [search, page, pageSize, sortBy, sortOrder, reloadKey]);

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
  // CLOSE FORM & UNSAVED CHANGES GUARD
  // =====================================================

  function isBookFormDirty(): boolean {
    if (editingBook) {
      return (
        bookTitle.trim() !== editingBook.title.trim() ||
        bookIsbn.trim() !== (editingBook.isbn ?? "").trim() ||
        bookAuthor.trim() !== (editingBook.author ?? "").trim() ||
        bookCategory.trim() !== (editingBook.category ?? "").trim()
      );
    }
    return (
      bookCode.trim() !== "" ||
      bookTitle.trim() !== "" ||
      bookIsbn.trim() !== "" ||
      bookAuthor.trim() !== "" ||
      bookCategory.trim() !== "" ||
      (bookTotalCopies.trim() !== "" && bookTotalCopies.trim() !== "1")
    );
  }

  function handleRequestCloseForm() {
    if (bookFormLoading) return;
    if (isBookFormDirty()) {
      setShowDiscardConfirm(true);
      return;
    }
    closeForm();
  }

  function closeForm() {
    setShowDiscardConfirm(false);
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
      errors.totalCopies = "Jumlah eksemplar wajib diisi.";
    } else if (!Number.isInteger(totalCopies) || totalCopies < 1) {
      errors.totalCopies = "Jumlah eksemplar minimal 1.";
    }

    setBookFormErrors(errors);

    return !Object.values(errors).some(Boolean);
  }

  // =====================================================
  // SUBMIT BOOK
  // =====================================================

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

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
        page,
        pageSize,
        sortby: sortBy,
        order: sortOrder,
      });

      setBooks(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      const message = getErrorMessage(error, "Data buku gagal disimpan.");
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
          pageSize: 100,
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
        getErrorMessage(error, "Detail buku gagal dimuat.")
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
          pageSize: 100,
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
        page,
        pageSize,
        sortby: sortBy,
        order: sortOrder,
      });

      setBooks(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      setDetailError(
        getErrorMessage(error, "Data buku gagal diperbarui.")
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

      toast.success(result.message || "Eksemplar buku berhasil ditambahkan.");
      setAddCopyModalOpen(false);
      setAddCopyCount(1);

      await refreshDetail(detailBook.id);
    } catch (error) {
      setDetailError(
        getErrorMessage(error, "Eksemplar buku gagal ditambahkan.")
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
      toast.warning("Buku sedang diarsipkan. Aktifkan buku terlebih dahulu untuk mengubah status eksemplar.");
      return;
    }

    if (copy.status === "BORROWED") {
      return;
    }

    if (nextStatus === "BORROWED") {
      return;
    }

    setConfirmCopy(copy);
    setConfirmCopyStatus(nextStatus);
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
        "Buku sedang diarsipkan. Aktifkan buku terlebih dahulu untuk mengubah status eksemplar.",
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
        `Status eksemplar ${confirmCopy.code} berhasil diubah menjadi ${getCopyStatusLabel(confirmCopyStatus)}.`,
      );

      const bookId = confirmCopy.bookId;

      setConfirmCopy(null);
      setConfirmCopyStatus(null);

      await refreshDetail(bookId);
    } catch (error) {
      setDetailError(
        getErrorMessage(error, "Status eksemplar gagal diubah.")
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
        page,
        pageSize,
        sortby: sortBy,
        order: sortOrder,
      });

      setBooks(refreshed.data);

      setTotal(refreshed.total);

      setTotalPages(refreshed.totalPages);
    } catch (error) {
      const message = getErrorMessage(error, "Status buku gagal diubah.");

      if (
        message ===
        "Buku tidak dapat diarsipkan karena masih memiliki eksemplar yang sedang dipinjam."
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
      const allBooksResponse = await masterDataRepository.listBooks({ pageSize: 100 });
      const catalogBooks =
        allBooksResponse?.data && allBooksResponse.data.length > 0
          ? allBooksResponse.data
          : books;

      const items: PrintableBookItem[] = [];
      const totalBooks = catalogBooks.length;
      for (let i = 0; i < totalBooks; i++) {
        const book = catalogBooks[i];
        setBulkPrintProgress({ current: i + 1, total: totalBooks });
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
      setPrintTitle(`Cetak Barcode & QR Code (${items.length} Eksemplar Buku)`);
      setPrintModalOpen(true);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Gagal menyiapkan data cetak barcode.");
      toast.error(msg);
    } finally {
      setBulkPrintLoading(false);
      setBulkPrintProgress(null);
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
    setPrintTitle(`Cetak Label Eksemplar - ${copy.code}`);
    setPrintModalOpen(true);
  }

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const BATCH_SIZE = 100;
      let allBooks: Book[] = [];

      const firstRes = await masterDataRepository.listBooks({
        search: search.trim(),
        page: 1,
        pageSize: BATCH_SIZE,
      });

      allBooks = [...(firstRes.data || [])];
      const totalCount = firstRes.total > 0 ? firstRes.total : allBooks.length;
      const totalBatches = Math.max(1, Math.ceil(totalCount / BATCH_SIZE));

      if (totalBatches > 1) {
        toast.info(`Mengunduh seluruh data buku (1/${totalBatches})...`);
        for (let p = 2; p <= totalBatches; p++) {
          const batchRes = await masterDataRepository.listBooks({
            search: search.trim(),
            page: p,
            pageSize: BATCH_SIZE,
          });
          allBooks.push(...(batchRes.data || []));
          if (!batchRes.data || batchRes.data.length === 0) break;
        }
      }

      if (allBooks.length === 0) {
        toast.warning("Tidak ada data buku untuk diekspor.");
        return;
      }

      const rows = allBooks.map((book, idx) => ({
        "No": idx + 1,
        "Kode Buku": book.code,
        "Judul Buku": book.title,
        "Pengarang": book.author || "-",
        "Penerbit": book.publisher || "-",
        "Tahun Terbit": book.publicationYear || "-",
        "Kategori": book.category || "-",
        "ISBN": book.isbn || "-",
        "Status": book.status === "AVAILABLE" ? "Aktif" : "Diarsipkan",
        "Total Eksemplar": book.totalCopies,
        "Eksemplar Tersedia": book.availableCopies,
      }));

      exportToExcel(
        rows,
        `Master_Buku_${new Date().toISOString().slice(0, 10)}.xlsx`,
        "Master Buku"
      );
      toast.success("Data buku berhasil diekspor ke Excel.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal mengekspor data buku."));
    } finally {
      setExportLoading(false);
    }
  };

  // =====================================================
  // DATATABLE CONFIG & SORT
  // =====================================================

  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const columns = useMemo<DataTableColumn<Book>[]>(
    () => [
      {
        key: "code",
        header: "Kode",
        width: "140px",
        sortable: true,
        render: (book) => (
          <span
            className="font-semibold text-slate-900 truncate text-xs font-mono block"
            title={book.code}
          >
            {book.code}
          </span>
        ),
      },
      {
        key: "title",
        header: "Buku",
        sortable: true,
        render: (book) => (
          <div className="min-w-0">
            <p
              className="truncate font-semibold text-slate-800 text-xs sm:text-sm"
              title={book.title}
            >
              {book.title}
            </p>
            {(book.author && book.author !== "-") ||
            (book.isbn && book.isbn !== "-") ? (
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {book.author &&
                book.author !== "-" &&
                book.isbn &&
                book.isbn !== "-" ? (
                  <>
                    <span>{book.author}</span>
                    <span className="mx-1 select-none text-slate-300" aria-hidden="true">&bull;</span>
                    <span>ISBN {book.isbn}</span>
                  </>
                ) : book.author && book.author !== "-" ? (
                  book.author
                ) : (
                  `ISBN ${book.isbn}`
                )}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        key: "category",
        header: "Kategori",
        width: "110px",
        render: (book) => (
          <span
            className="text-slate-600 truncate text-xs block"
            title={book.category ?? "-"}
          >
            {book.category ?? "-"}
          </span>
        ),
      },
      {
        key: "copies",
        header: "Eksemplar",
        width: "80px",
        align: "center",
        isNumeric: true,
        render: (book) => (
          <span className="tabular-nums text-xs">
            <span className="font-bold text-slate-900">
              {book.availableCopies}
            </span>
            <span className="text-slate-500"> / {book.totalCopies}</span>
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "110px",
        render: (book) => (
          <span
            className={`inline-flex whitespace-nowrap items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${getBookStatusClass(
              book.status,
            )}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {getBookStatusLabel(book.status)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Aksi",
        width: "80px",
        align: "right",
        render: (book) => {
          const isInactive = book.status === "INACTIVE";
          return (
            <RowActions
              actions={[
                {
                  label: "Detail",
                  onClick: () => void openDetail(book),
                  icon: (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ),
                },
                {
                  label: "Cetak Barcode",
                  onClick: () => void handlePrintBookCopies(book),
                  icon: (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" />
                    </svg>
                  ),
                },
                {
                  label: "Edit",
                  onClick: () => openEditForm(book),
                  icon: (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  ),
                },
                {
                  label: isInactive ? "Aktifkan" : "Arsipkan",
                  onClick: () => openBookStatusConfirm(book),
                  tone: isInactive ? "success" : "warning",
                  icon: isInactive ? (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  ) : (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <rect width="20" height="5" x="2" y="3" rx="1" />
                      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                      <path d="M10 12h4" />
                    </svg>
                  ),
                },
              ]}
            />
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );



  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white print:min-h-0">
      <div className="barcode-page-content print:hidden mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
        {/* HEADER */}

        <PageHeader
          className="mb-5 sm:mb-6"
          backLink={<BackLink href="/dashboard" />}
          title="Master Buku"
          description="Kelola data buku dan eksemplar perpustakaan."
          actions={
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-center sm:gap-2.5 w-full sm:w-auto">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleExportExcel()}
                loading={exportLoading}
                disabled={Boolean(error) || loading || books.length === 0 || exportLoading}
                className="w-full sm:w-auto text-xs h-9 px-3 text-center whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2v6h6M8 13h8M8 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span>Ekspor Excel</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => void handlePrintAllCurrentBooks()}
                loading={bulkPrintLoading}
                disabled={Boolean(error) || loading || books.length === 0 || bulkPrintLoading}
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
                  aria-hidden="true"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect width="12" height="8" x="6" y="14" />
                </svg>
                <span>
                  {bulkPrintProgress
                    ? `Memuat (${bulkPrintProgress.current}/${bulkPrintProgress.total})...`
                    : "Cetak Semua Barcode"}
                </span>
              </Button>

              {canManageMasterData(getSession()?.user.role ?? "MEMBER") && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={openCreateForm}
                  disabled={Boolean(error) || loading}
                  className="col-span-2 sm:col-auto w-full sm:w-auto text-xs h-9 px-3.5 font-semibold text-center whitespace-nowrap"
                >
                  + Tambah Buku
                </Button>
              )}
            </div>
          }
        />

        {/* SEARCH & FILTERS */}

        <Card className="mb-3 p-3 sm:p-4">
          <div className="grid grid-cols-[1fr_135px] sm:grid-cols-[1fr_160px] xl:grid-cols-1 items-end gap-2.5 sm:gap-3">
            <div className="min-w-0">
              <Input
                ref={searchInputRef}
                id="book-search"
                label="Cari Buku"
                value={search}
                disabled={Boolean(error) || loading}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Judul, kode, ISBN, pengarang, atau kategori... (tekan /)"
              />
            </div>

            {/* SORT (Khusus Card View: mobile & tablet < xl, disamping kolom search. Hanya Judul A-Z / Z-A) */}
            <div className="min-w-0 xl:hidden">
              <label
                htmlFor="book-sort"
                className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700 truncate"
              >
                Urutan
              </label>

              <Dropdown
                id="book-sort"
                value={sortBy === "title" ? `${sortBy}:${sortOrder}` : "title:asc"}
                disabled={Boolean(error) || loading}
                onChange={(value) => {
                  const [newSortBy, newSortOrder] = value.split(":");
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder as "asc" | "desc");
                  setPage(1);
                }}
                ariaLabel="Urutkan daftar buku"
                options={[
                  { value: "title:asc", label: "Judul (A-Z)" },
                  { value: "title:desc", label: "Judul (Z-A)" },
                ]}
              />
            </div>
          </div>
        </Card>

        {/* ERROR STATE vs BOOK LIST */}

        {error ? (
          <ErrorState
            title="Gagal Memuat Katalog Buku"
            message={error}
            onRetry={() => setReloadKey((k) => k + 1)}
            className="mb-4"
          />
        ) : (
          <Card className="overflow-hidden">
            <DataTable
              rows={books}
              columns={columns}
              keyExtractor={(b) => b.id}
              loading={loading || tableLoading}
              loadingMessage="Memuat data..."
              sortBy={sortBy}
              order={sortOrder}
              onSortChange={handleSortChange}
              mobileBreakpoint="xl"
              cardGridClassName="bg-slate-50/60 p-3"
              className="border-0 shadow-none rounded-none"
              emptyState={
                <div className="px-4 py-12 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    ?
                  </div>

                  <h3 className="mt-3 text-sm font-semibold text-slate-900">
                    Buku tidak ditemukan
                  </h3>

                  <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                    Coba ubah kata pencarian atau filter status, atau tambahkan buku baru ke katalog perpustakaan.
                  </p>

                  {canManageMasterData(getSession()?.user.role ?? "MEMBER") && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={openCreateForm}
                      >
                        + Tambah Buku
                      </Button>
                    </div>
                  )}
                </div>
              }
              renderMobileCard={(book) => {
                const isInactive = book.status === "INACTIVE";

                return (
                  <div
                    key={book.id}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm flex flex-col justify-between h-full"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-500 font-mono">
                            {book.code}
                          </p>

                          <p
                            className="mt-0.5 truncate text-sm font-semibold text-slate-900"
                            title={book.title}
                          >
                            {book.title}
                          </p>
                        </div>

                        <span
                          className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${getBookStatusClass(
                            book.status,
                          )}`}
                        >
                          {getBookStatusLabel(book.status)}
                        </span>
                      </div>

                      {/* UNIFORM 2x2 INFO GRID */}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Kategori
                          </p>

                          <p
                            className="mt-0.5 truncate text-xs font-medium text-slate-700"
                            title={book.category || "-"}
                          >
                            {book.category && book.category !== "-"
                              ? book.category
                              : "-"}
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Eksemplar
                          </p>

                          <p className="mt-0.5 text-xs font-medium text-slate-700">
                            <span className="font-bold">
                              {book.availableCopies}
                            </span>
                            {" / "}
                            {book.totalCopies}
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            ISBN
                          </p>

                          <p
                            className="mt-0.5 truncate text-xs font-medium text-slate-700"
                            title={book.isbn || "-"}
                          >
                            {book.isbn && book.isbn !== "-"
                              ? book.isbn
                              : "-"}
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Pengarang
                          </p>

                          <p
                            className="mt-0.5 truncate text-xs font-medium text-slate-700"
                            title={book.author || "-"}
                          >
                            {book.author && book.author !== "-"
                              ? book.author
                              : "-"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        Pilihan Aksi
                      </span>
                      <RowActions
                        actions={[
                          {
                            label: "Detail",
                            onClick: () => void openDetail(book),
                            icon: (
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                              >
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            ),
                          },
                          {
                            label: "Cetak Barcode",
                            onClick: () => void handlePrintBookCopies(book),
                            icon: (
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                              >
                                <path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" />
                              </svg>
                            ),
                          },
                          {
                            label: "Edit",
                            onClick: () => openEditForm(book),
                            icon: (
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            ),
                          },
                          {
                            label: isInactive ? "Aktifkan" : "Arsipkan",
                            onClick: () => openBookStatusConfirm(book),
                            tone: isInactive ? "success" : "warning",
                            icon: isInactive ? (
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                              >
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                              </svg>
                            ) : (
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                              >
                                <rect width="20" height="5" x="2" y="3" rx="1" />
                                <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                                <path d="M10 12h4" />
                              </svg>
                            ),
                          },
                        ]}
                      />
                    </div>
                  </div>
                );
              }}
            />

            {/* PAGINATION (MOBILE, TABLET & DESKTOP) */}
            {books.length > 0 && total > 0 && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(nextPage) => setPage(nextPage)}
                totalItems={total}
                pageSize={pageSize}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
              />
            )}
          </Card>
        )}
      </div>

      {/* =====================================================
          ADD / EDIT BOOK MODAL
      ===================================================== */}

      <Modal
        open={showForm}
        onClose={handleRequestCloseForm}
        raw
        size="2xl"
        initialFocusRef={formCloseRef}
        ariaLabelledBy="book-form-title"
        className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl"
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
                    : "Masukkan data buku dan jumlah eksemplar awal."}
                </p>
              </div>

              <Button
                ref={formCloseRef}
                type="button"
                variant="ghost"
                size="sm"
                disabled={bookFormLoading}
                aria-label="Tutup form"
                onClick={handleRequestCloseForm}
                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
              ><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></Button>
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
                  label="Jumlah Eksemplar Awal"
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Eksemplar
                  </p>

                  <p className="mt-0.5 text-sm font-semibold text-slate-800">
                    {editingBook.totalCopies} eksemplar
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Tambah eksemplar dilakukan dari detail buku.
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:col-span-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={bookFormLoading}
                  onClick={handleRequestCloseForm}
                  className="w-full sm:w-auto"
                >
                  Batal
                </Button>

                <Button
                  type="submit"
                  loading={bookFormLoading}
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                  className="w-full sm:w-auto"
                >
                  {editingBook ? "Simpan Perubahan" : "Simpan Buku"}
                </Button>
              </div>
            </form>
      </Modal>

      {/* =====================================================
          DETAIL BOOK MODAL
      ===================================================== */}

      <Modal
        open={Boolean(detailBook)}
        onClose={() => setDetailBook(null)}
        raw
        size="3xl"
        initialFocusRef={detailCloseRef}
        ariaLabelledBy="book-detail-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        {detailBook && (
          <>
            {/* HEADER */}

            <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 font-mono">
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

                <Button
                  ref={detailCloseRef}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Tutup detail buku"
                  onClick={() => setDetailBook(null)}
                  className="shrink-0 h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </Button>
              </div>
            </div>

            {/* BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-3.5 sm:p-5">
              {detailError && (
                <ErrorState
                  title="Gagal Memuat Detail Buku"
                  message={detailError}
                  onRetry={() => detailBook && void refreshDetail(detailBook.id)}
                  className="mb-3"
                  nested
                />
              )}

              {/* INFORMATION: 2 kolom di mobile dan desktop agar hemat ruang */}

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:px-4 sm:py-3 shadow-2xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Kode Buku
                  </p>

                  <p className="mt-0.5 sm:mt-1 truncate text-xs sm:text-sm font-semibold text-slate-800">
                    {detailBook.code}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:px-4 sm:py-3 shadow-2xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    ISBN
                  </p>

                  <p className="mt-0.5 sm:mt-1 truncate text-xs sm:text-sm font-semibold text-slate-800">
                    {detailBook.isbn ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:px-4 sm:py-3 shadow-2xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Pengarang
                  </p>

                  <p className="mt-0.5 sm:mt-1 truncate text-xs sm:text-sm font-semibold text-slate-800">
                    {detailBook.author ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:px-4 sm:py-3 shadow-2xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
                      Daftar Eksemplar
                    </h3>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Total {detailCopies.length} eksemplar fisik.
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
                        aria-hidden="true"
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
                        + Tambah Eksemplar
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
                      aria-hidden="true"
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
                        Status eksemplar dan penambahan eksemplar fisik dikunci (mode hanya-baca). Aktifkan buku terlebih dahulu untuk mengubah atau menambah eksemplar.
                      </p>
                    </div>
                  </div>
                )}

                {detailLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    Memuat daftar eksemplar...
                  </div>
                ) : detailCopies.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    Belum ada eksemplar buku.
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
                                <p className="text-xs text-slate-500">
                                  Eksemplar Fisik
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handlePrintSingleCopy(detailBook, copy)}
                                  title="Cetak Barcode Eksemplar Ini"
                                  className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs font-semibold gap-1"
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
                                    aria-hidden="true"
                                  >
                                    <polyline points="6 9 6 2 18 2 18 9" />
                                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                    <rect width="12" height="8" x="6" y="14" />
                                  </svg>
                                  <span>Cetak</span>
                                </Button>

                                {isBorrowed || detailBook.status === "INACTIVE" ? (
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getCopyStatusClass(
                                      copy.status,
                                    )}`}
                                    title={
                                      detailBook.status === "INACTIVE"
                                        ? "Buku sedang diarsipkan. Aktifkan buku untuk mengubah status eksemplar."
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

            <div className="flex shrink-0 flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDetailBook(null)}
                className="w-full sm:w-auto text-xs"
              >
                Tutup
              </Button>

              {canManageMasterData(getSession()?.user.role ?? "MEMBER") && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    const targetBook = detailBook;
                    setDetailBook(null);
                    openEditForm(targetBook);
                  }}
                  className="w-full sm:w-auto text-xs"
                >
                  Ubah
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* =====================================================
          ADD COPY MODAL (BULK / SINGLE)
      ===================================================== */}
      <Modal
        open={Boolean(addCopyModalOpen && detailBook)}
        onClose={() => !addCopyLoading && setAddCopyModalOpen(false)}
        raw
        size="md"
        ariaLabelledBy="add-copy-modal-title"
        overlayClassName="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        {addCopyModalOpen && detailBook && (
          <>
            {/* Header */}
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3
                    id="add-copy-modal-title"
                    className="text-base font-bold text-slate-900"
                  >
                    Tambah Eksemplar Fisik
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                    {detailBook.title} ({detailBook.code})
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Tutup modal"
                  onClick={() => !addCopyLoading && setAddCopyModalOpen(false)}
                  disabled={addCopyLoading}
                  className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></Button>
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
                  Jumlah Eksemplar yang Ingin Ditambahkan
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setAddCopyCount((prev) => Math.max(1, prev - 1))}
                    disabled={addCopyLoading || addCopyCount <= 1}
                    className="h-10 w-10 p-0 font-bold"
                  >
                    -
                  </Button>
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
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setAddCopyCount((prev) => Math.min(100, prev + 1))}
                    disabled={addCopyLoading || addCopyCount >= 100}
                    className="h-10 w-10 p-0 font-bold"
                  >
                    +
                  </Button>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {[1, 2, 5, 10].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={addCopyCount === preset ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setAddCopyCount(preset)}
                      disabled={addCopyLoading}
                      className="flex-1 py-1 text-xs"
                    >
                      +{preset}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Information Preview Box */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Total eksemplar saat ini:</span>
                  <span className="font-semibold text-slate-800">{detailCopies.length} eksemplar</span>
                </div>
                <div className="flex justify-between">
                  <span>Akan ditambahkan:</span>
                  <span className="font-semibold text-blue-600">+{addCopyCount} eksemplar</span>
                </div>
                <div className="border-t border-slate-200/60 pt-1.5 flex justify-between font-medium">
                  <span className="text-slate-800">Total setelah penambahan:</span>
                  <span className="font-bold text-slate-900">{detailCopies.length + addCopyCount} eksemplar</span>
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
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                  className="text-xs h-9 px-4"
                >
                  {addCopyLoading
                    ? "Menambahkan..."
                    : `Tambahkan ${addCopyCount} Eksemplar`}
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* =====================================================
          COPY STATUS CONFIRMATION
      ===================================================== */}

      <ConfirmationDialog
        open={Boolean(confirmCopy && confirmCopyStatus)}
        title={
          confirmCopyStatus === "AVAILABLE"
            ? "Aktifkan Eksemplar?"
            : confirmCopyStatus === "INACTIVE"
            ? "Nonaktifkan Eksemplar?"
            : confirmCopyStatus === "LOST"
            ? "Tandai Eksemplar Hilang?"
            : "Ubah Status Eksemplar?"
        }
        description={
          confirmCopy
            ? confirmCopyStatus === "AVAILABLE"
              ? `Eksemplar "${confirmCopy.code}" akan diaktifkan kembali.`
              : confirmCopyStatus === "INACTIVE"
              ? `Eksemplar "${confirmCopy.code}" akan dinonaktifkan. Data tetap tersimpan.`
              : `Status eksemplar "${confirmCopy.code}" akan diubah menjadi ${getCopyStatusLabel(confirmCopyStatus || "AVAILABLE")}.`
            : ""
        }
        confirmLabel={
          confirmCopyStatus === "AVAILABLE"
            ? "Ya, Aktifkan"
            : confirmCopyStatus === "INACTIVE"
            ? "Ya, Nonaktifkan"
            : "Ya, Ubah Status"
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
          DISCARD BOOK FORM CONFIRMATION
      ===================================================== */}
      <ConfirmationDialog
        open={showDiscardConfirm}
        title="Tutup Formulir Buku?"
        description="Data yang telah Anda isi belum disimpan. Jika formulir ditutup, seluruh isian data buku akan hilang."
        confirmLabel="Ya, Tutup Formulir"
        tone="destructive"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          closeForm();
        }}
        onClose={() => setShowDiscardConfirm(false)}
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
        companyName={companyName}
      />
    </div>
  );
}
