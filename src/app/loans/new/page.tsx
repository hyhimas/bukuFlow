"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import AppHeader from "@/components/ui/AppHeader";
import BackLink from "@/components/ui/BackLink";

import {
  createMember,
  createBook,
  getMembers,
  searchMembers,
  searchBooks,
  getBookCopies,
  createLoan,
} from "@/lib/mock-api";

import type { Book, BookCopy, Loan, Member } from "@/lib/types";
import LoadingState from "@/components/ui/LoadingState";

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
  title: string;
  isbn: string;
  author: string;
  publisher: string;
  publicationYear: string;
  category: string;
  totalCopies: string;
};

const EMPTY_BOOK_ERRORS: BookFormErrors = {
  title: "",
  isbn: "",
  author: "",
  publisher: "",
  publicationYear: "",
  category: "",
  totalCopies: "",
};

export default function NewLoanPage() {
  const router = useRouter();
  const successModalCloseRef = useRef<HTMLButtonElement>(null);
  const memberModalCloseRef = useRef<HTMLButtonElement>(null);
  const bookModalCloseRef = useRef<HTMLButtonElement>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // =====================================================
  // MEMBER SEARCH
  // =====================================================

  const [memberQuery, setMemberQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
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

  const [bookLoading, setBookLoading] = useState(false);
  const [bookError, setBookError] = useState("");

  // =====================================================
  // CREATE BOOK
  // =====================================================

  const [showBookForm, setShowBookForm] = useState(false);
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
  const [copyError, setCopyError] = useState("");

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
  const [submitError, setSubmitError] = useState("");
  const [successLoan, setSuccessLoan] = useState<Loan | null>(null);

  type CreationSuccess = {
    type: "member" | "book";
    name: string;
  };

  const [creationSuccess, setCreationSuccess] =
    useState<CreationSuccess | null>(null);

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

  useEffect(() => {
    if (!creationSuccess) return;

    const timer = window.setTimeout(() => {
      setCreationSuccess(null);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [creationSuccess]);

  useEffect(() => {
  const session = getSession();

  if (!session) {
    router.replace("/login");
    return;
  }

  setPageLoading(false);
}, [router]);

  // =====================================================
  // SEARCH MEMBER WITH DEBOUNCE
  // =====================================================

  useEffect(() => {
    if (selectedMember || showMemberForm) {
      return;
    }

    let cancelled = false;

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

          const result = keyword
            ? await searchMembers(keyword)
            : await getMembers();

          if (!cancelled) {
            setMembers(result);
          }
        } catch {
          if (!cancelled) {
            setMemberError("Data anggota gagal dimuat.");
            setMembers([]);
          }
        } finally {
          if (!cancelled) {
            setMemberLoading(false);
          }
        }
      }

      void loadMembers();
    }, 400);

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

    const timer = window.setTimeout(() => {
      async function loadBooks() {
        setBookLoading(true);
        setBookError("");

        try {
          const result = await searchBooks(bookQuery.trim());

          if (!cancelled) {
            setBooks(result);
          }
        } catch {
          if (!cancelled) {
            setBookError("Pencarian buku gagal.");
            setBooks([]);
          }
        } finally {
          if (!cancelled) {
            setBookLoading(false);
          }
        }
      }

      void loadBooks();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bookQuery, selectedMember]);

  // =====================================================
  // SELECT MEMBER
  // =====================================================

  async function handleSelectMember(member: Member) {
    setSelectedMember(member);

    setMembers([]);
    setMemberQuery("");
    setMemberError("");

    // Reset pemilihan buku
    setBookQuery("");
    setSelectedBooks([]);
    setBookError("");
    setCopyError("");

    // Reset tanggal
    setBorrowedAt("");
    setDueAt("");
    setDateError("");

    // Reset submit
    setSubmitError("");
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

    // NIK harus unik untuk anggota dalam perusahaan yang sedang aktif.
    try {
      const existingMembers = await getMembers();
      const duplicateNik = existingMembers.some(
        (member) => member.identityNumber === memberIdentityNumber.trim(),
      );

      if (duplicateNik) {
        setMemberFormErrors((current) => ({
          ...current,
          identityNumber:
            "NIK tersebut sudah terdaftar sebagai anggota. Gunakan NIK yang berbeda.",
        }));
        return;
      }
    } catch {
      setMemberFormErrors((current) => ({
        ...current,
        identityNumber: "Data anggota gagal diverifikasi. Silakan coba lagi.",
      }));
      return;
    }

    setMemberFormLoading(true);

    try {
      const member = await createMember({
        name: memberName.trim(),
        phone: memberPhone.trim(),
        identityNumber: memberIdentityNumber.trim(),
        email: memberEmail.trim() || undefined,
        memberType: "UMUM",
        status: "ACTIVE",
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
      setCreationSuccess({ type: "member", name: member.name });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Anggota gagal dibuat.";

      if (
        message.toLowerCase().includes("nik") &&
        message.toLowerCase().includes("sudah terdaftar")
      ) {
        setMemberFormErrors((current) => ({
          ...current,
          identityNumber: message,
        }));
      } else {
        setMemberFormErrors((current) => ({
          ...current,
          identityNumber: message,
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
      title: "",
      isbn: "",
      author: "",
      publisher: "",
      publicationYear: "",
      category: "",
      totalCopies: "",
    };

    const title = bookTitle.trim();
    const isbn = bookIsbn.trim();
    const author = bookAuthor.trim();
    const publisher = bookPublisher.trim();
    const publicationYear = bookPublicationYear.trim();
    const category = bookCategory.trim();
    const totalCopies = Number(bookTotalCopies);

    if (!title) {
      errors.title = "Judul buku wajib diisi.";
    } else if (title.length < 2) {
      errors.title = "Judul buku harus terdiri dari minimal 2 karakter.";
    }

    if (!author) {
      errors.author = "Penulis wajib diisi.";
    }

    if (!isbn) {
      errors.isbn = "ISBN wajib diisi.";
    } else if (!/^[0-9Xx-]+$/.test(isbn)) {
      errors.isbn = "ISBN hanya boleh berisi angka, tanda hubung, atau X.";
    }

    if (!publisher) {
      errors.publisher = "Penerbit wajib diisi.";
    }

    if (!publicationYear) {
      errors.publicationYear = "Tahun terbit wajib diisi.";
    } else {
      const year = Number(publicationYear);
      const currentYear = new Date().getFullYear();
      if (
        !/^\d{4}$/.test(publicationYear) ||
        year < 1000 ||
        year > currentYear
      ) {
        errors.publicationYear = `Tahun terbit harus antara 1000-${currentYear}.`;
      }
    }

    if (!category) {
      errors.category = "Kategori wajib diisi.";
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
      const book = await createBook({
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
      await selectBook(book);
      setCreationSuccess({ type: "book", name: book.title });
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

  async function selectBook(book: Book) {
    if (book.status === "INACTIVE" || book.availableCopies <= 0) {
      return;
    }

    if (selectedBooks.some((item) => item.book.id === book.id)) {
      setSubmitError("");
      return;
    }

    setCopyError("");
    setSubmitError("");
    setCopyLoadingBookId(book.id);

    try {
      const copies = await getBookCopies(book.id);

      setSelectedBooks((current) => {
        if (current.some((item) => item.book.id === book.id)) {
          return current;
        }

        return [
          ...current,
          {
            book,
            copies,
            selectedCopyIds: [],
          },
        ];
      });
    } catch {
      setCopyError(`Copy buku ${book.title} gagal dimuat.`);
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
    setSubmitError("");
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

    setSubmitError("");
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

    setSubmitError("");

    if (!selectedMember) {
      setSubmitError("Anggota belum dipilih.");
      return;
    }

    if (selectedBooks.length === 0) {
      setSubmitError("Minimal satu buku harus dipilih.");
      return;
    }

    const bookWithoutCopy = selectedBooks.find(
      (item) => item.selectedCopyIds.length === 0,
    );

    if (bookWithoutCopy) {
      setSubmitError(
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
      setSubmitError(
        "Ada copy yang sudah tidak tersedia. Silakan periksa kembali pilihan copy buku.",
      );
      return;
    }

    if (!validateDates()) {
      return;
    }

    setSubmitLoading(true);

    try {
      const loan = await createLoan({
        memberId: selectedMember.id,
        items: selectedBooks.map((item) => ({
          bookId: item.book.id,
          bookCopyIds: item.selectedCopyIds,
        })),
        borrowedAt,
        dueAt,
      });

      setSuccessLoan(loan);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Peminjaman gagal diproses.",
      );
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
    setMemberError("");

    setBookQuery("");
    setBooks([]);
    setSelectedBooks([]);

    setBookError("");
    setCopyError("");

    setBorrowedAt("");
    setDueAt("");
    setDateError("");

    setSubmitError("");
    setSuccessLoan(null);
  }

  function resetLoanForm() {
    setMemberQuery("");
    setMembers([]);
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
    setSelectedBooks([]);
    setBookError("");
    setCopyLoadingBookId(null);
    setCopyError("");
    setBorrowedAt("");
    setDueAt("");
    setDateError("");
    setSubmitError("");
    setSuccessLoan(null);
  }
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

      <AppHeader subtitle="Catat Peminjaman" />

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
          className={`${successLoan ? "pointer-events-none opacity-60" : ""} grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]`}
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
                      <h4 className="text-sm font-semibold text-slate-700">
                        Hasil pencarian
                      </h4>

                      {members.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleSelectMember(member)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {member.name}
                              </p>

                              <p className="mt-1 truncate text-sm text-slate-500">
                                {member.memberNumber} · {member.phone}
                              </p>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                                member.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {member.status === "ACTIVE"
                                ? "Aktif"
                                : "Tidak aktif"}
                            </span>
                          </div>
                        </button>
                      ))}
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
                <h3 className="text-base font-semibold text-slate-900">
                  2. Pilih Buku
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Semua buku yang tersedia ditampilkan. Gunakan pencarian untuk
                  mempersempit daftar.
                </p>

                {/* SEARCH BOOK */}

                <div className="mt-5">
                  <Input
                    id="book-search"
                    label="Cari Buku"
                    value={bookQuery}
                    onChange={(event) => setBookQuery(event.target.value)}
                    placeholder="Cari judul, kode, atau ISBN..."
                  />
                </div>
                {/* RESET SEARCH */}

                {bookQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setBookQuery("");
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

                {!bookLoading && books.length === 0 && !bookError && (
                  <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="font-medium text-slate-800">
                      {bookQuery.trim()
                        ? "Buku tidak ditemukan"
                        : "Tidak ada buku tersedia"}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {bookQuery.trim()
                        ? "Tidak ada buku tersedia yang sesuai dengan pencarian."
                        : "Saat ini tidak ada buku yang dapat dipinjam."}
                    </p>

                    {bookQuery.trim() && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-3"
                        onClick={() => {
                          setShowBookForm(true);
                          setBookFormErrors(EMPTY_BOOK_ERRORS);
                        }}
                      >
                        Tambah Buku Baru
                      </Button>
                    )}
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
                      className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="create-book-title"
                    >
                      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                        <div>
                          <h3
                            id="create-book-title"
                            className="text-lg font-semibold text-slate-900"
                          >
                            Tambah Buku Baru
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Isi data buku untuk menambahkannya ke transaksi
                            peminjaman.
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

                      <form
                        onSubmit={handleCreateBook}
                        className="grid gap-3.5 p-5 sm:grid-cols-2"
                      >
                        <Input
                          id="book-title"
                          label="Judul Buku"
                          value={bookTitle}
                          onChange={(event) => {
                            setBookTitle(event.target.value);
                            if (bookFormErrors.title)
                              setBookFormErrors((current) => ({
                                ...current,
                                title: "",
                              }));
                          }}
                          error={bookFormErrors.title}
                          required
                        />
                        <Input
                          id="book-author"
                          label="Penulis"
                          value={bookAuthor}
                          onChange={(event) => {
                            setBookAuthor(event.target.value);
                            if (bookFormErrors.author)
                              setBookFormErrors((current) => ({
                                ...current,
                                author: "",
                              }));
                          }}
                          error={bookFormErrors.author}
                          required
                        />
                        <Input
                          id="book-isbn"
                          label="ISBN"
                          value={bookIsbn}
                          onChange={(event) => {
                            setBookIsbn(event.target.value);
                            if (bookFormErrors.isbn)
                              setBookFormErrors((current) => ({
                                ...current,
                                isbn: "",
                              }));
                          }}
                          error={bookFormErrors.isbn}
                          placeholder="978-..."
                          required
                        />
                        <Input
                          id="book-publisher"
                          label="Penerbit"
                          value={bookPublisher}
                          onChange={(event) => {
                            setBookPublisher(event.target.value);
                            if (bookFormErrors.publisher)
                              setBookFormErrors((current) => ({
                                ...current,
                                publisher: "",
                              }));
                          }}
                          error={bookFormErrors.publisher}
                          required
                        />
                        <Input
                          id="book-publication-year"
                          label="Tahun Terbit"
                          type="number"
                          inputMode="numeric"
                          min={1000}
                          max={new Date().getFullYear()}
                          value={bookPublicationYear}
                          onChange={(event) => {
                            setBookPublicationYear(event.target.value);
                            if (bookFormErrors.publicationYear)
                              setBookFormErrors((current) => ({
                                ...current,
                                publicationYear: "",
                              }));
                          }}
                          error={bookFormErrors.publicationYear}
                          required
                        />
                        <Input
                          id="book-category"
                          label="Kategori"
                          value={bookCategory}
                          onChange={(event) => {
                            setBookCategory(event.target.value);
                            if (bookFormErrors.category)
                              setBookFormErrors((current) => ({
                                ...current,
                                category: "",
                              }));
                          }}
                          error={bookFormErrors.category}
                          required
                        />
                        <Input
                          id="book-total-copies"
                          label="Jumlah Copy"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={bookTotalCopies}
                          onChange={(event) => {
                            setBookTotalCopies(event.target.value);
                            if (bookFormErrors.totalCopies)
                              setBookFormErrors((current) => ({
                                ...current,
                                totalCopies: "",
                              }));
                          }}
                          error={bookFormErrors.totalCopies}
                          required
                        />

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
                    <h4 className="text-sm font-semibold text-slate-700">
                      {bookQuery.trim() ? "Hasil pencarian" : "Daftar buku"}
                    </h4>

                    {books.map((book) => {
                      const unavailable =
                        book.status === "INACTIVE" || book.availableCopies <= 0;
                      const selectedItem = selectedBooks.find(
                        (item) => item.book.id === book.id,
                      );
                      const selected = Boolean(selectedItem);
                      const loading = copyLoadingBookId === book.id;

                      return (
                        <div
                          key={book.id}
                          className={`rounded-xl border p-4 transition ${
                            selected
                              ? "border-blue-400 bg-blue-50/60"
                              : unavailable
                                ? "border-slate-200 bg-slate-50"
                                : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_230px] md:items-center">
                            {/* INFO BUKU */}
<div className="min-w-0">
  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4">
    {/* Judul + detail */}
    <div className="min-w-0">
      <p
        className="truncate font-semibold text-slate-900"
        title={book.title}
      >
        {book.title}
      </p>

      <div className="mt-2 space-y-1 text-sm text-slate-500">
        <p>
          <span className="text-slate-400">Penulis</span>{" "}
          {book.author || "-"}
        </p>

        <p>
          <span className="text-slate-400">ISBN</span>{" "}
          {book.isbn || "-"}
        </p>
      </div>
    </div>

    {/* KODE BUKU */}
    <p className="shrink-0 whitespace-nowrap pt-0.5 text-right text-sm text-slate-500">
      {" "}
      <span className="font-medium text-slate-700">
        {book.code}
      </span>
    </p>
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
                            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                              Tidak ada copy yang tersedia untuk dipinjam.
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

                              {copyError && (
                                <p
                                  role="alert"
                                  className="mt-3 text-sm text-red-600"
                                >
                                  {copyError}
                                </p>
                              )}

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
                  </div>
                )}
              </Card>
            )}
          </div>

          <div className="min-w-0 lg:sticky lg:top-5 lg:self-start">
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

                      return (
                        <div
                          key={item.book.id}
                          className="flex items-center gap-2.5 px-3 py-2.5"
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
                    <Input
                      id="borrowed-at"
                      label="Tanggal peminjaman"
                      type="date"
                      value={borrowedAt}
                      onChange={(event) => {
                        const value = event.target.value;

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

                    <Input
                      id="due-at"
                      label="Tanggal jatuh tempo"
                      type="date"
                      min={borrowedAt || undefined}
                      value={dueAt}
                      onChange={(event) => {
                        const value = event.target.value;

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
                      {submitError && (
                        <p role="alert" className="mb-4 text-sm text-red-600">
                          {submitError}
                        </p>
                      )}

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

        {creationSuccess && (
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
                <p className="text-sm font-semibold text-slate-900">
                  {creationSuccess.type === "member"
                    ? "Anggota berhasil ditambahkan"
                    : "Buku berhasil ditambahkan"}
                </p>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  {creationSuccess.type === "member"
                    ? `${creationSuccess.name} berhasil ditambahkan dan dipilih sebagai anggota.`
                    : `${creationSuccess.name} berhasil ditambahkan dan dipilih untuk peminjaman.`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup notifikasi sukses"
                onClick={() => setCreationSuccess(null)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>
          </div>
        )}

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
                  onClick={resetLoanForm}
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
      </div>
    </main>
  );
}
