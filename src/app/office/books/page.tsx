"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import BackLink from "@/components/ui/BackLink";
import LoadingState from "@/components/ui/LoadingState";
import ErrorState from "@/components/ui/ErrorState";
import Modal from "@/components/ui/Modal";
import { useSearchHotkey, useSubmitHotkey } from "@/hooks/useHotkeys";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/components/ui/Pagination";
import RowActions from "@/components/ui/RowActions";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import CompanySwitcher, {
  getStoredOfficeCompanyId,
  setStoredOfficeCompanyId,
} from "@/components/office/CompanySwitcher";

import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import {
  getCompaniesApi,
  getOfficeBooksApi,
  getBookCopiesApi,
  getBookApi,
  createBookApi,
  updateBookApi,
  changeBookStatusApi,
  createBookCopiesBulkApi,
  changeBookCopyStatusApi,
  getErrorMessage,
  type OfficeBookItem,
} from "@/lib/api";
import type { Company, BookStatus, BookCopy, BookCopyStatus } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import BookBarcodePrintModal, {
  type PrintableBookItem,
} from "@/components/barcode/BookBarcodePrintModal";
import { exportToExcel } from "@/lib/export/excel";

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

function getBookStatusClass(status: BookStatus) {
  if (status === "AVAILABLE") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "BORROWED") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-red-50 text-red-600";
}

function getBookStatusLabel(status: BookStatus) {
  if (status === "AVAILABLE") {
    return "Tersedia";
  }

  if (status === "BORROWED") {
    return "Dipinjam";
  }

  return "Diarsipkan";
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

export default function OfficeBooksPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [isAuthorized] = useState(() => {
    if (typeof window === "undefined") return false;
    const session = getSession();
    return Boolean(session && session.user.role === "SUPER_ADMIN");
  });

  // Companies & Selection (Mandatory query company_id)
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() =>
    getStoredOfficeCompanyId()
  );

  // Table Data & Loading
  const [books, setBooks] = useState<OfficeBookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const savedTotalRef = useRef(0);

  // =====================================================
  // BOOK FORM STATE (TAMBAH / UBAH BUKU)
  // =====================================================
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState<OfficeBookItem | null>(null);

  const [bookCode, setBookCode] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookIsbn, setBookIsbn] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookCategory, setBookCategory] = useState("");
  const [bookTotalCopies, setBookTotalCopies] = useState("1");

  const [bookFormErrors, setBookFormErrors] =
    useState<BookFormErrors>(EMPTY_BOOK_ERRORS);
  const [bookFormLoading, setBookFormLoading] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const formCloseRef = useRef<HTMLButtonElement>(null);

  // =====================================================
  // BOOK STATUS CONFIRMATION
  // =====================================================
  const [confirmBook, setConfirmBook] = useState<OfficeBookItem | null>(null);
  const [confirmBookStatus, setConfirmBookStatus] =
    useState<BookStatus | null>(null);
  const [bookStatusLoading, setBookStatusLoading] = useState(false);

  // =====================================================
  // DETAIL MODAL & COPIES STATE
  // =====================================================
  const [detailBook, setDetailBook] = useState<OfficeBookItem | null>(null);
  const [detailCopies, setDetailCopies] = useState<BookCopy[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copyPage, setCopyPage] = useState(1);
  const [supplementalError, setSupplementalError] = useState(false);
  const COPY_PAGE_SIZE = 5;

  // Add Copy in Detail Modal
  const [addCopyModalOpen, setAddCopyModalOpen] = useState(false);
  const [addCopyCount, setAddCopyCount] = useState(1);
  const [addCopyLoading, setAddCopyLoading] = useState(false);

  // Change Copy Status Confirm
  const [confirmCopy, setConfirmCopy] = useState<BookCopy | null>(null);
  const [confirmCopyStatus, setConfirmCopyStatus] =
    useState<BookCopyStatus | null>(null);
  const [copyStatusLoading, setCopyStatusLoading] = useState(false);

  // =====================================================
  // BARCODE & QR MODAL STATE
  // =====================================================
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printItems, setPrintItems] = useState<PrintableBookItem[]>([]);
  const [printTitle, setPrintTitle] = useState("Cetak Label Barcode & QR Code");
  const [bulkPrintLoading, setBulkPrintLoading] = useState(false);
  const [bulkPrintProgress, setBulkPrintProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // Selected Company Name
  const selectedCompanyName =
    companies.find((c) => c.id === selectedCompanyId)?.name || "Perpustakaan";

  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchHotkey(searchInputRef, {
    enabled: Boolean(selectedCompanyId) && !error && !loading,
  });
  useSubmitHotkey(() => void handleSubmitBook(), {
    enabled: showForm,
    loading: bookFormLoading,
  });
  useSubmitHotkey(() => void handleAddCopy(), {
    enabled: addCopyModalOpen,
    loading: addCopyLoading,
  });

  // 1. Guard Super Admin Authentication
  useEffect(() => {
    const session = getSession();
    if (!session) {
      if (!isStoredSessionExpired() && !hasStoredAuth()) {
        router.replace("/login");
      }
      return;
    }

    if (session.user.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [router]);

  // 2. Fetch Companies List
  useEffect(() => {
    if (!isAuthorized) return;

    let cancelled = false;
    getCompaniesApi()
      .then((data) => {
        if (!cancelled) {
          setCompanies(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = getErrorMessage(err, "Gagal memuat daftar instansi.");
          setError(msg);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthorized, toast]);

  // 3. Fetch Books for Selected Company
  useEffect(() => {
    if (!isAuthorized || !selectedCompanyId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset daftar buku instansi saat belum ada instansi terpilih
      setBooks([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const isSearchQuery = search.trim().length > 0;

    const timer = setTimeout(
      async () => {
        setTableLoading(true);
        try {
          const res = await getOfficeBooksApi(selectedCompanyId, {
            page,
            size: pageSize,
            search: search.trim() || undefined,
            sortby: sortBy,
            order: sortOrder,
          });

          if (cancelled) return;

          setBooks(res.items);

          if (res.total !== -1) {
            savedTotalRef.current = res.total;
            setTotal(res.total);
            setTotalPages(Math.max(1, Math.ceil(res.total / pageSize)));
          } else {
            setTotal(savedTotalRef.current);
            setTotalPages(
              Math.max(1, Math.ceil(savedTotalRef.current / pageSize))
            );
          }

          setError("");
        } catch (err: unknown) {
          if (!cancelled) {
            const msg = getErrorMessage(err, "Gagal memuat katalog buku.");
            setError(msg);
          }
        } finally {
          if (!cancelled) {
            setTableLoading(false);
            setLoading(false);
          }
        }
      },
      isSearchQuery ? 350 : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedCompanyId, page, pageSize, search, sortBy, sortOrder, isAuthorized, toast, reloadKey]);

  // =====================================================
  // FORM HANDLERS (TAMBAH / UBAH BUKU)
  // =====================================================
  function openCreateForm() {
    if (!selectedCompanyId) {
      toast.warning("Pilih instansi terlebih dahulu.");
      return;
    }
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

  function openEditForm(book: OfficeBookItem) {
    setEditingBook(book);
    setBookCode(book.code);
    setBookTitle(book.title);
    setBookIsbn(book.isbn && book.isbn !== "-" ? book.isbn : "");
    setBookAuthor(book.author && book.author !== "-" ? book.author : "");
    setBookCategory(book.category && book.category !== "-" ? book.category : "");
    setBookTotalCopies(String(book.totalCopies));
    setBookFormErrors(EMPTY_BOOK_ERRORS);
    setShowForm(true);
  }

  function isFormDirty() {
    if (editingBook) {
      const curIsbn =
        editingBook.isbn && editingBook.isbn !== "-" ? editingBook.isbn : "";
      const curAuthor =
        editingBook.author && editingBook.author !== "-"
          ? editingBook.author
          : "";
      const curCategory =
        editingBook.category && editingBook.category !== "-"
          ? editingBook.category
          : "";

      return (
        bookTitle.trim() !== editingBook.title ||
        bookIsbn.trim() !== curIsbn ||
        bookAuthor.trim() !== curAuthor ||
        bookCategory.trim() !== curCategory
      );
    }

    return (
      bookCode.trim() !== "" ||
      bookTitle.trim() !== "" ||
      bookIsbn.trim() !== "" ||
      bookAuthor.trim() !== "" ||
      bookCategory.trim() !== "" ||
      bookTotalCopies !== "1"
    );
  }

  function handleRequestCloseForm() {
    if (bookFormLoading) return;
    if (isFormDirty()) {
      setShowDiscardConfirm(true);
      return;
    }
    closeForm();
  }

  function closeForm() {
    setShowForm(false);
    setEditingBook(null);
    setBookFormErrors(EMPTY_BOOK_ERRORS);
  }

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

  async function handleSubmitBook(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (bookFormLoading || !validateBookForm()) {
      return;
    }

    if (!selectedCompanyId) {
      toast.error("Instansi belum dipilih.");
      return;
    }

    setBookFormLoading(true);

    try {
      if (editingBook) {
        const newTitle = bookTitle.trim();
        const newIsbn = bookIsbn.trim();
        const newAuthor = bookAuthor.trim();
        const newCategory = bookCategory.trim();

        const curIsbn =
          editingBook.isbn && editingBook.isbn !== "-"
            ? editingBook.isbn
            : "";
        const curAuthor =
          editingBook.author && editingBook.author !== "-"
            ? editingBook.author
            : "";
        const curCategory =
          editingBook.category && editingBook.category !== "-"
            ? editingBook.category
            : "";

        const hasChanges =
          newTitle !== editingBook.title ||
          newIsbn !== curIsbn ||
          newAuthor !== curAuthor ||
          newCategory !== curCategory;

        if (!hasChanges) {
          toast.warning("Data masih sama, tidak ada perubahan yang disimpan.");
          closeForm();
          return;
        }

        await updateBookApi(
          editingBook.id,
          {
            title: newTitle,
            isbn: newIsbn || undefined,
            author: newAuthor || undefined,
            category: newCategory || undefined,
          },
          selectedCompanyId
        );

        toast.success("Data buku berhasil diperbarui.");
      } else {
        await createBookApi(
          {
            code: bookCode.trim(),
            title: bookTitle.trim(),
            isbn: bookIsbn.trim() || undefined,
            author: bookAuthor.trim() || undefined,
            category: bookCategory.trim() || undefined,
            totalCopies: Number(bookTotalCopies),
          },
          selectedCompanyId
        );

        toast.success("Buku berhasil ditambahkan.");
      }

      closeForm();
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Data buku gagal disimpan.");
      toast.error(msg);
    } finally {
      setBookFormLoading(false);
    }
  }

  // =====================================================
  // BOOK STATUS TOGGLE (AKTIFKAN / ARSIPKAN)
  // =====================================================
  function openBookStatusConfirm(book: OfficeBookItem) {
    const nextStatus: BookStatus =
      book.status === "INACTIVE" ? "AVAILABLE" : "INACTIVE";

    setConfirmBook(book);
    setConfirmBookStatus(nextStatus);
  }

  async function handleChangeBookStatus() {
    if (!confirmBook || !confirmBookStatus || !selectedCompanyId) return;

    setBookStatusLoading(true);
    try {
      await changeBookStatusApi(
        confirmBook.id,
        confirmBookStatus,
        selectedCompanyId
      );
      toast.success(
        confirmBookStatus === "AVAILABLE"
          ? "Buku berhasil diaktifkan."
          : "Buku berhasil diarsipkan."
      );
      setConfirmBook(null);
      setConfirmBookStatus(null);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Gagal mengubah status buku.");
      toast.error(msg);
      setConfirmBook(null);
      setConfirmBookStatus(null);
    } finally {
      setBookStatusLoading(false);
    }
  }

  // =====================================================
  // DETAIL & COPIES HANDLERS
  // =====================================================
  async function openDetail(book: OfficeBookItem) {
    setDetailBook(book);
    setDetailCopies([]);
    setCopyPage(1);
    setDetailLoading(true);
    setSupplementalError(false);

    try {
      let failed = false;
      const [freshBook, copies] = await Promise.all([
        getBookApi(book.id, selectedCompanyId).catch(() => {
          failed = true;
          return null;
        }),
        getBookCopiesApi(book.id, selectedCompanyId).catch(() => {
          failed = true;
          return null;
        }),
      ]);

      if (failed) {
        setSupplementalError(true);
      }

      if (freshBook) {
        setDetailBook({
          ...book,
          ...freshBook,
          publishedYear: freshBook.publicationYear,
        });
      }
      setDetailCopies(copies ?? []);
    } catch {
      setDetailCopies([]);
      setSupplementalError(true);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetailCopies() {
    if (!detailBook || !selectedCompanyId) return;
    try {
      let failed = false;
      const [freshBook, copies] = await Promise.all([
        getBookApi(detailBook.id, selectedCompanyId).catch(() => {
          failed = true;
          return null;
        }),
        getBookCopiesApi(detailBook.id, selectedCompanyId).catch(() => {
          failed = true;
          return null;
        }),
      ]);

      if (failed) {
        setSupplementalError(true);
      } else {
        setSupplementalError(false);
      }

      if (freshBook) {
        setDetailBook((prev) =>
          prev
            ? {
                ...prev,
                ...freshBook,
                publishedYear: freshBook.publicationYear,
              }
            : null
        );
      }
      setDetailCopies(copies ?? []);
    } catch {
      setSupplementalError(true);
    }
  }

  async function handleAddCopy() {
    if (!detailBook || addCopyLoading || !selectedCompanyId) return;

    setAddCopyLoading(true);
    try {
      await createBookCopiesBulkApi(
        detailBook.id,
        addCopyCount,
        selectedCompanyId
      );
      toast.success(`${addCopyCount} eksemplar buku berhasil ditambahkan.`);
      setAddCopyModalOpen(false);
      setAddCopyCount(1);

      await refreshDetailCopies();
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal menambahkan eksemplar buku."));
    } finally {
      setAddCopyLoading(false);
    }
  }

  function handleCopyStatusChange(copy: BookCopy, nextStatus: BookCopyStatus) {
    if (detailBook?.status === "INACTIVE") {
      toast.warning(
        "Buku sedang diarsipkan. Aktifkan buku terlebih dahulu untuk mengubah status eksemplar."
      );
      return;
    }

    if (copy.status === "BORROWED") {
      toast.warning("Eksemplar yang sedang dipinjam tidak dapat diubah statusnya.");
      return;
    }

    if (nextStatus === "BORROWED") {
      return;
    }

    setConfirmCopy(copy);
    setConfirmCopyStatus(nextStatus);
  }

  async function handleChangeCopyStatus() {
    if (
      !confirmCopy ||
      !confirmCopyStatus ||
      !detailBook ||
      !selectedCompanyId
    ) {
      return;
    }

    setCopyStatusLoading(true);
    try {
      await changeBookCopyStatusApi(
        detailBook.id,
        confirmCopy.id,
        confirmCopyStatus,
        selectedCompanyId
      );
      toast.success(
        `Status eksemplar ${confirmCopy.code} berhasil diubah menjadi ${getCopyStatusLabel(confirmCopyStatus)}.`
      );
      setConfirmCopy(null);
      setConfirmCopyStatus(null);

      await refreshDetailCopies();
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal mengubah status eksemplar buku."));
      setConfirmCopy(null);
      setConfirmCopyStatus(null);
    } finally {
      setCopyStatusLoading(false);
    }
  }

  // =====================================================
  // PRINT BARCODE HANDLERS
  // =====================================================
  async function handlePrintBookCopies(book: OfficeBookItem, existingCopies?: BookCopy[]) {
    try {
      let copies = existingCopies;
      if (!copies || copies.length === 0) {
        copies = await getBookCopiesApi(book.id, selectedCompanyId);
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

  function handlePrintSingleCopy(book: OfficeBookItem, copy: BookCopy) {
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

  async function handleBulkPrint() {
    if (!selectedCompanyId) {
      toast.warning("Pilih instansi terlebih dahulu.");
      return;
    }

    try {
      setBulkPrintLoading(true);
      const res = await getOfficeBooksApi(selectedCompanyId, {
        size: 100,
        sortby: "title",
        order: "asc",
      });

      const catalogBooks = res.items || [];
      if (catalogBooks.length === 0) {
        toast.warning("Tidak ada data buku untuk dicetak barcodenya.");
        return;
      }

      const items: PrintableBookItem[] = [];
      const totalBooks = catalogBooks.length;
      for (let i = 0; i < totalBooks; i++) {
        const book = catalogBooks[i];
        setBulkPrintProgress({ current: i + 1, total: totalBooks });
        try {
          const copies = await getBookCopiesApi(book.id, selectedCompanyId);
          if (copies && copies.length > 0) {
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
      toast.error(getErrorMessage(err, "Gagal menyiapkan data cetak barcode."));
    } finally {
      setBulkPrintLoading(false);
      setBulkPrintProgress(null);
    }
  }

  // =====================================================
  // EXPORT TO EXCEL
  // =====================================================
  async function handleExportExcel() {
    if (!selectedCompanyId) {
      toast.warning("Pilih instansi terlebih dahulu.");
      return;
    }

    try {
      setExportLoading(true);
      const BATCH_SIZE = 100;
      let allBooks: OfficeBookItem[] = [];

      const firstRes = await getOfficeBooksApi(selectedCompanyId, {
        page: 1,
        size: BATCH_SIZE,
        search: search.trim() || undefined,
      });

      allBooks = [...(firstRes.items || [])];
      const totalCount = firstRes.total > 0 ? firstRes.total : allBooks.length;
      const totalBatches = Math.max(1, Math.ceil(totalCount / BATCH_SIZE));

      if (totalBatches > 1) {
        toast.info(`Mengunduh seluruh data buku (1/${totalBatches})...`);
        for (let p = 2; p <= totalBatches; p++) {
          const batchRes = await getOfficeBooksApi(selectedCompanyId, {
            page: p,
            size: BATCH_SIZE,
            search: search.trim() || undefined,
          });
          allBooks.push(...(batchRes.items || []));
          if (!batchRes.items || batchRes.items.length === 0) break;
        }
      }

      if (allBooks.length === 0) {
        toast.warning("Tidak ada data buku untuk diekspor.");
        return;
      }

      const rows = allBooks.map((book, idx) => ({
        No: idx + 1,
        "Kode Buku": book.code,
        "Judul Buku": book.title,
        Pengarang: book.author || "-",
        Penerbit: book.publisher || "-",
        "Tahun Terbit": book.publishedYear || "-",
        Kategori: book.category || "-",
        ISBN: book.isbn || "-",
        Status: book.status === "AVAILABLE" ? "Aktif" : "Diarsipkan",
        "Total Eksemplar": book.totalCopies,
        "Eksemplar Tersedia": book.availableCopies,
      }));

      const cleanCompName = selectedCompanyName.replace(/[^a-zA-Z0-9]/g, "_");
      exportToExcel(
        rows,
        `Master_Buku_${cleanCompName}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        "Master Buku"
      );
      toast.success("Data buku berhasil diekspor ke Excel.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal mengekspor data buku."));
    } finally {
      setExportLoading(false);
    }
  }

  // RowActions Generator matching master/books exactly
  function getBookActions(book: OfficeBookItem) {
    const isInactive = book.status === "INACTIVE";
    return [
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
        tone: (isInactive ? "success" : "warning") as "success" | "warning",
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
    ];
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50">
        <LoadingState label="Memeriksa otorisasi Super Admin..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
        {/* Tombol Navigasi Kembali */}
        <div className="mb-4">
          <BackLink href="/office/dashboard">
            Kembali ke Dashboard Office
          </BackLink>
        </div>

        {/* HEADER & ACTIONS */}
        <PageHeader
          className="mb-5 sm:mb-6"
          title="Master Buku (Office)"
          description="Kelola data buku dan eksemplar perpustakaan per instansi."
          actions={
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              <CompanySwitcher
                size="sm"
                selectedCompanyId={selectedCompanyId}
                onSelectCompany={(id) => {
                  setStoredOfficeCompanyId(id);
                  setSelectedCompanyId(id);
                  setPage(1);
                  setBooks([]);
                  setTotal(0);
                  setTotalPages(1);
                  savedTotalRef.current = 0;
                }}
                companies={companies}
              />

              <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center sm:gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleExportExcel()}
                  loading={exportLoading}
                  disabled={Boolean(error) || loading || !selectedCompanyId || books.length === 0 || exportLoading}
                  className="w-full sm:w-auto text-xs h-9 px-3 text-center whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2v6h6M8 13h8M8 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>Ekspor Excel</span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleBulkPrint()}
                  loading={bulkPrintLoading}
                  disabled={Boolean(error) || loading || !selectedCompanyId || books.length === 0 || bulkPrintLoading}
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

                <Button
                  type="button"
                  variant="primary"
                  onClick={openCreateForm}
                  disabled={Boolean(error) || loading || !selectedCompanyId}
                  className="col-span-2 sm:col-auto w-full sm:w-auto text-xs h-9 px-3.5 font-semibold text-center whitespace-nowrap"
                >
                  + Tambah Buku
                </Button>
              </div>
            </div>
          }
        />

        {/* State 1: Belum Memilih Instansi */}
        {!selectedCompanyId ? (
          <Card className="p-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              ?
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              Pilih Instansi Terlebih Dahulu
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
              Silakan pilih instansi pada dropdown di atas untuk mengelola katalog buku perpustakaan.
            </p>
          </Card>
        ) : (
          /* State 2: Instansi Dipilih */
          <>
            {/* SEARCH & FILTERS (Desain persis Master Books: Sort hanya muncul di mobile/card view di samping search, di desktop table pakai sort header) */}
            <Card className="mb-3 p-3 sm:p-4">
              <div className="grid grid-cols-[1fr_135px] sm:grid-cols-[1fr_160px] xl:grid-cols-1 items-end gap-2.5 sm:gap-3">
                <div className="min-w-0">
                  <Input
                    ref={searchInputRef}
                    id="book-search"
                    label="Cari Buku"
                    value={search}
                    disabled={Boolean(error) || loading || !selectedCompanyId}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                      savedTotalRef.current = 0;
                    }}
                    placeholder="Judul, kode, ISBN, pengarang, atau kategori... (tekan /)"
                  />
                </div>

                {/* SORT (Khusus Card View: mobile & tablet < xl, disamping kolom search. Hanya Judul / Kode A-Z / Z-A) */}
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
                    disabled={Boolean(error) || loading || !selectedCompanyId}
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
              <Card>
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
                      {search
                        ? `Tidak ada buku yang sesuai dengan pencarian "${search}".`
                        : "Belum ada katalog buku yang terdaftar di instansi ini."}
                    </p>

                    <div className="mt-4 flex justify-center">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={openCreateForm}
                      >
                        + Tambah Buku
                      </Button>
                    </div>
                  </div>
                )}

                {/* DESKTOP TABLE (>= xl) */}
                {books.length > 0 && (
                  <div className="relative hidden overflow-x-auto rounded-t-xl xl:block">
                    <table className="w-full text-left text-sm text-slate-600 table-fixed">
                      <colgroup>
                        <col className="w-[140px]" />
                        <col className="w-auto" />
                        <col className="w-[110px]" />
                        <col className="w-[80px]" />
                        <col className="w-[110px]" />
                        <col className="w-[80px]" />
                      </colgroup>
                      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-3.5 py-3">Kode</th>
                          <th
                            className="px-3.5 py-3 cursor-pointer select-none hover:text-slate-900 transition-colors"
                            onClick={() => {
                              setSortBy("title");
                              setSortOrder((prev) =>
                                prev === "asc" ? "desc" : "asc"
                              );
                              setPage(1);
                            }}
                            title="Klik untuk mengurutkan berdasarkan judul buku (A-Z / Z-A)"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Buku</span>
                              <span className="text-xs text-slate-500 font-medium">
                                {sortBy === "title"
                                  ? sortOrder === "asc"
                                    ? "▲ A-Z"
                                    : "▼ Z-A"
                                  : "↕"}
                              </span>
                            </div>
                          </th>
                          <th className="px-3 py-3">Kategori</th>
                          <th className="px-2 py-3 text-center tabular-nums">
                            Eksemplar
                          </th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3 text-right">Aksi</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {books.map((book) => {
                          return (
                            <tr
                              key={book.id}
                              className="transition hover:bg-slate-50/70"
                            >
                              <td
                                className="px-3.5 py-3 font-semibold text-slate-900 truncate text-xs font-mono"
                                title={book.code}
                              >
                                {book.code}
                              </td>

                              <td className="px-3.5 py-3 min-w-0">
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
                              </td>

                              <td className="px-3 py-3 text-slate-600 truncate text-xs">
                                {book.category ?? "-"}
                              </td>

                              <td className="px-2 py-3 whitespace-nowrap text-xs text-center tabular-nums">
                                <span className="font-bold text-slate-900">
                                  {book.availableCopies}
                                </span>
                                <span className="text-slate-500">
                                  {" "}
                                  / {book.totalCopies}
                                </span>
                              </td>

                              <td className="px-3 py-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex whitespace-nowrap items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${getBookStatusClass(
                                    book.status
                                  )}`}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                  {getBookStatusLabel(book.status)}
                                </span>
                              </td>

                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                <RowActions actions={getBookActions(book)} />
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

                {/* MOBILE & TABLET CARDS (< xl) */}
                {books.length > 0 && (
                  <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/60 p-3 xl:hidden">
                    {books.map((book, idx) => {
                      const isLastOdd =
                        books.length % 2 !== 0 && idx === books.length - 1;

                      return (
                        <div
                          key={book.id}
                          className={`rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm flex flex-col justify-between h-full ${
                            isLastOdd
                              ? "md:col-span-2 md:w-[calc(50%-6px)] md:mx-auto"
                              : ""
                          }`}
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
                                  book.status
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
                            <RowActions actions={getBookActions(book)} />
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

                {/* PAGINATION DENGAN PER HALAMAN DI BAWAH */}
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
              </Card>
            )}
          </>
        )}

        {/* =====================================================
            MODAL TAMBAH / UBAH BUKU
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
                  ? `Perbarui informasi buku di instansi ${selectedCompanyName}.`
                  : `Masukkan data buku dan jumlah eksemplar awal untuk instansi ${selectedCompanyName}.`}
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
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 flex items-center justify-center"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>

          <form
            onSubmit={handleSubmitBook}
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
              placeholder="Contoh: BK-001"
              disabled={Boolean(editingBook)}
              required
            />

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
              placeholder="Judul buku lengkap"
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
              placeholder="978-602-..."
            />

            <Input
              id="book-author"
              label="Pengarang (opsional)"
              value={bookAuthor}
              onChange={(event) => setBookAuthor(event.target.value)}
              placeholder="Nama pengarang / penulis"
            />

            <Input
              id="book-category"
              label="Kategori (opsional)"
              value={bookCategory}
              onChange={(event) => setBookCategory(event.target.value)}
              placeholder="Contoh: Fiksi, Sains, Sejarah"
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
                variant="primary"
                loading={bookFormLoading}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                className="w-full sm:w-auto"
              >
                {editingBook ? "Simpan Perubahan" : "Tambah Buku"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Konfirmasi Batalkan Perubahan Form */}
        <ConfirmationDialog
          open={showDiscardConfirm}
          title="Batalkan Perubahan?"
          description="Perubahan yang telah Anda masukkan belum disimpan dan akan hilang jika form ditutup."
          confirmLabel="Ya, Batalkan"
          tone="destructive"
          onConfirm={() => {
            setShowDiscardConfirm(false);
            closeForm();
          }}
          onClose={() => setShowDiscardConfirm(false)}
        />

        {/* Modal Konfirmasi Arsipkan / Aktifkan Buku (Persis Master Books) */}
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
          tone={confirmBookStatus === "AVAILABLE" ? "primary" : "destructive"}
          loading={bookStatusLoading}
          onConfirm={() => void handleChangeBookStatus()}
          onClose={() => {
            if (!bookStatusLoading) {
              setConfirmBook(null);
              setConfirmBookStatus(null);
            }
          }}
        />

        {/* =====================================================
            MODAL DETAIL BUKU & EKSEMPLAR FISIK (PERSIS MASTER BOOKS)
        ===================================================== */}
        {detailBook && (
          <Modal
            open={Boolean(detailBook)}
            onClose={() => setDetailBook(null)}
            raw
            size="2xl"
            ariaLabelledBy="book-detail-title"
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            {/* HEADER */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="min-w-0 pr-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    {detailBook.code}
                  </span>

                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getBookStatusClass(
                      detailBook.status
                    )}`}
                  >
                    {getBookStatusLabel(detailBook.status)}
                  </span>
                </div>

                <h2
                  id="book-detail-title"
                  className="mt-1 truncate text-sm sm:text-base font-semibold text-slate-900"
                  title={detailBook.title}
                >
                  {detailBook.title}
                </h2>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Tutup dialog detail"
                onClick={() => setDetailBook(null)}
                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 shrink-0 flex items-center justify-center"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>

            {/* BODY */}
            <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-4 py-4 sm:px-5">
              {/* INFO 2x2 */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:px-4 sm:py-3 shadow-2xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    ISBN
                  </p>
                  <p className="mt-0.5 sm:mt-1 truncate font-mono text-xs sm:text-sm font-semibold text-slate-800">
                    {detailBook.isbn ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:px-4 sm:py-3 shadow-2xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Stok Tersedia
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm font-semibold text-slate-800">
                    <span className="font-bold text-emerald-600">
                      {detailBook.availableCopies}
                    </span>
                    <span className="text-slate-500">
                      {" "}
                      / {detailBook.totalCopies} copy
                    </span>
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

              {supplementalError && (
                <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800 flex items-center justify-between" role="note">
                  <span>Data tambahan gagal dimuat</span>
                  <button
                    type="button"
                    onClick={() => void refreshDetailCopies()}
                    className="font-medium underline hover:text-amber-950"
                  >
                    Coba lagi
                  </button>
                </div>
              )}

              {/* DAFTAR EKSEMPLAR */}
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
                      onClick={() =>
                        void handlePrintBookCopies(detailBook, detailCopies)
                      }
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
                    {supplementalError ? (
                      <span className="font-medium text-amber-800">
                        Data tambahan gagal dimuat
                      </span>
                    ) : (
                      "Belum ada eksemplar buku."
                    )}
                  </div>
                ) : (() => {
                  const totalCopyPages = Math.ceil(
                    detailCopies.length / COPY_PAGE_SIZE
                  );
                  const safeCurrentCopyPage = Math.min(
                    Math.max(1, copyPage),
                    totalCopyPages
                  );
                  const paginatedCopies = detailCopies.slice(
                    (safeCurrentCopyPage - 1) * COPY_PAGE_SIZE,
                    safeCurrentCopyPage * COPY_PAGE_SIZE
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
                                  onClick={() =>
                                    handlePrintSingleCopy(detailBook, copy)
                                  }
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

                                {isBorrowed ||
                                detailBook.status === "INACTIVE" ? (
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getCopyStatusClass(
                                      copy.status
                                    )}`}
                                    title={
                                      detailBook.status === "INACTIVE"
                                        ? "Buku sedang diarsipkan. Aktifkan buku untuk mengubah status eksemplar."
                                        : undefined
                                    }
                                  >
                                    {getCopyStatusLabel(copy.status)}
                                  </span>
                                ) : (
                                  <Dropdown
                                    value={copy.status}
                                    onChange={(value) =>
                                      handleCopyStatusChange(
                                        copy,
                                        value as BookCopyStatus
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
                Ubah Buku
              </Button>
            </div>
          </Modal>
        )}

        {/* Modal Tambah Eksemplar */}
        <Modal
          open={addCopyModalOpen}
          onClose={() => {
            if (!addCopyLoading) setAddCopyModalOpen(false);
          }}
          title="Tambah Salinan Eksemplar"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Buku:{" "}
              <span className="font-semibold text-slate-800">
                {detailBook?.title}
              </span>{" "}
              ({detailBook?.code})
            </p>

            <Input
              id="add-copy-count"
              label="Jumlah Eksemplar yang Ditambahkan"
              type="number"
              min={1}
              max={50}
              value={String(addCopyCount)}
              onChange={(e) => {
                const val = Math.max(
                  1,
                  Math.min(50, Number(e.target.value) || 1)
                );
                setAddCopyCount(val);
              }}
              required
            />

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button
                type="button"
                variant="secondary"
                disabled={addCopyLoading}
                onClick={() => setAddCopyModalOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={addCopyLoading}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                onClick={() => void handleAddCopy()}
              >
                Tambahkan
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal Konfirmasi Ubah Status Eksemplar */}
        <ConfirmationDialog
          open={Boolean(confirmCopy && confirmCopyStatus)}
          title={`Ubah Status Salinan ${confirmCopy?.code}`}
          description={`Apakah Anda yakin ingin mengubah status eksemplar "${confirmCopy?.code}" menjadi ${
            confirmCopyStatus ? getCopyStatusLabel(confirmCopyStatus) : ""
          }?`}
          confirmLabel="Ya, Ubah Status"
          tone={
            confirmCopyStatus === "INACTIVE" || confirmCopyStatus === "LOST"
              ? "destructive"
              : "primary"
          }
          loading={copyStatusLoading}
          onConfirm={() => void handleChangeCopyStatus()}
          onClose={() => {
            if (!copyStatusLoading) {
              setConfirmCopy(null);
              setConfirmCopyStatus(null);
            }
          }}
        />

        {/* Modal Cetak Barcode & QR Code */}
        <BookBarcodePrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          items={printItems}
          title={printTitle}
          companyName={selectedCompanyName}
        />
      </div>
    </div>
  );
}
