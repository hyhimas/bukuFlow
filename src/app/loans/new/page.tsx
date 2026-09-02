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
  getMembers,
  searchMembers,
  searchBooks,
  getBookCopies,
  createLoan,
} from "@/lib/mock-api";

import type { Book, BookCopy, Loan, Member } from "@/lib/types";

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

export default function NewLoanPage() {
  const router = useRouter();
  const successRef = useRef<HTMLDivElement>(null);

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

  // =====================================================
  // BOOK SEARCH
  // =====================================================

  const [bookQuery, setBookQuery] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const [bookLoading, setBookLoading] = useState(false);
  const [bookError, setBookError] = useState("");

  // =====================================================
  // BOOK COPY
  // =====================================================

  const [bookCopies, setBookCopies] = useState<BookCopy[]>([]);

  const [selectedCopyIds, setSelectedCopyIds] = useState<string[]>([]);

  const [copyLoading, setCopyLoading] = useState(false);
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
    if (successLoan) {
      successRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [successLoan]);

  useEffect(() => {
    const session = getSession();

    if (!session) {
      router.replace("/login");
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
  }, [memberQuery, selectedMember, showMemberForm]);

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
    setSelectedBook(null);
    setSelectedCopyIds([]);
    setBookCopies([]);
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Anggota gagal dibuat.";

      setMemberFormErrors({
        name: "",
        phone: "",
        identityNumber: "",
        email: message,
      });
    } finally {
      setMemberFormLoading(false);
    }
  }

  // =====================================================
  // SELECT BOOK
  // =====================================================

  async function selectBook(book: Book) {
    if (book.status === "INACTIVE" || book.availableCopies <= 0) {
      return;
    }

    setSelectedBook(book);
    setSelectedCopyIds([]);
    setBookCopies([]);

    setCopyError("");
    setSubmitError("");

    setCopyLoading(true);

    try {
      const copies = await getBookCopies(book.id);

      setBookCopies(copies);
    } catch {
      setCopyError("Copy buku gagal dimuat.");

      setBookCopies([]);
    } finally {
      setCopyLoading(false);
    }
  }

  // =====================================================
  // TOGGLE BOOK COPY
  // =====================================================

  function toggleCopy(copy: BookCopy) {
    if (copy.status !== "AVAILABLE") {
      return;
    }

    setSelectedCopyIds((current) => {
      if (current.includes(copy.id)) {
        return current.filter((id) => id !== copy.id);
      }

      return [...current, copy.id];
    });

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

    // Validasi anggota
    if (!selectedMember) {
      setSubmitError("Anggota belum dipilih.");

      return;
    }

    // Validasi buku
    if (!selectedBook) {
      setSubmitError("Buku belum dipilih.");

      return;
    }

    // Validasi copy
    if (selectedCopyIds.length === 0) {
      setSubmitError("Minimal satu copy harus dipilih.");

      return;
    }

    // Pastikan copy masih valid
    const selectedCopies = bookCopies.filter((copy) =>
      selectedCopyIds.includes(copy.id),
    );

    const hasUnavailableCopy =
      selectedCopies.length !== selectedCopyIds.length ||
      selectedCopies.some((copy) => copy.status !== "AVAILABLE");

    if (hasUnavailableCopy) {
      setSubmitError(
        "Ada copy yang sudah tidak tersedia. Silakan pilih ulang copy buku.",
      );

      return;
    }

    // Validasi tanggal
    if (!validateDates()) {
      return;
    }

    setSubmitLoading(true);

    try {
      const loan = await createLoan({
        memberId: selectedMember.id,
        bookId: selectedBook.id,
        bookCopyIds: selectedCopyIds,
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
    setSelectedBook(null);
    setSelectedCopyIds([]);
    setBookCopies([]);

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
    setSelectedBook(null);
    setBookError("");
    setBookCopies([]);
    setSelectedCopyIds([]);
    setCopyError("");
    setBorrowedAt("");
    setDueAt("");
    setDateError("");
    setSubmitError("");
    setSuccessLoan(null);
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
          inert={Boolean(successLoan) || undefined}
          className={successLoan ? "pointer-events-none opacity-60" : ""}
        >
          <Card className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-slate-900">
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
                        className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <p className="font-medium text-slate-900">
                          {member.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {member.memberNumber} · {member.phone}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Status:{" "}
                          {member.status === "ACTIVE" ? "Aktif" : "Tidak aktif"}
                        </p>
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
            <Card className="mt-5 p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Buat Anggota Baru
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Isi data anggota untuk melanjutkan peminjaman.
              </p>

              <form
                onSubmit={handleCreateMember}
                className="mt-5 grid gap-4 sm:grid-cols-2"
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

                <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
                  <Button type="submit" loading={memberFormLoading}>
                    Simpan Anggota
                  </Button>

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
                </div>
              </form>
            </Card>
          )}

          {/* =================================================
            2. BOOK
        ================================================= */}

          {selectedMember && (
            <Card className="mt-5 p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">
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
                </div>
              )}

              {/* BOOK LIST */}

              {!bookLoading && books.length > 0 && (
                <div className="mt-5 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700">
                    {bookQuery.trim() ? "Hasil pencarian" : "Buku tersedia"}
                  </h4>

                  {books.map((book) => {
                    const unavailable =
                      book.status === "INACTIVE" || book.availableCopies <= 0;

                    const selected = selectedBook?.id === book.id;

                    return (
                      <div
                        key={book.id}
                        className={`rounded-lg border p-4 ${
                          selected
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        {/* BOOK HEADER */}

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-medium text-slate-900">
                              {book.title}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              Kode: {book.code}
                            </p>

                            {book.author && (
                              <p className="mt-1 text-sm text-slate-500">
                                Penulis: {book.author}
                              </p>
                            )}

                            {book.isbn && (
                              <p className="mt-1 text-xs text-slate-400">
                                ISBN: {book.isbn}
                              </p>
                            )}
                          </div>

                          <p className="text-sm font-medium text-slate-600">
                            {book.status === "AVAILABLE"
                              ? "Tersedia"
                              : book.status === "BORROWED"
                                ? "Dipinjam"
                                : "Tidak aktif"}
                          </p>
                        </div>

                        {/* COPY INFO */}

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Total copy</p>

                            <p className="mt-1 text-lg font-semibold text-slate-900">
                              {book.totalCopies}
                            </p>
                          </div>

                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Tersedia</p>

                            <p className="mt-1 text-lg font-semibold text-slate-900">
                              {book.availableCopies}
                            </p>
                          </div>
                        </div>

                        {/* SELECT BOOK */}

                        <Button
                          type="button"
                          className="mt-4"
                          disabled={unavailable || selected}
                          loading={selected && copyLoading}
                          onClick={() => selectBook(book)}
                        >
                          {unavailable
                            ? "Tidak tersedia"
                            : selected
                              ? "Buku dipilih"
                              : "Pilih Buku"}
                        </Button>

                        {/* COPY LIST */}

                        {selected && (
                          <div className="mt-4 border-t border-slate-200 pt-4">
                            <p className="text-sm font-medium text-slate-700">
                              Pilih copy buku
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Pilih satu atau lebih copy yang tersedia.
                            </p>

                            {copyError && (
                              <p
                                role="alert"
                                className="mt-3 text-sm text-red-600"
                              >
                                {copyError}
                              </p>
                            )}

                            {copyLoading ? (
                              <p className="mt-4 text-sm text-slate-500">
                                Memuat copy buku...
                              </p>
                            ) : bookCopies.length === 0 ? (
                              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm font-medium text-slate-800">
                                  Tidak ada copy buku yang tersedia.
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  Semua copy buku sedang dipinjam atau tidak
                                  dapat digunakan.
                                </p>
                              </div>
                            ) : (
                              <div className="mt-4 space-y-2">
                                {bookCopies.map((copy) => {
                                  const unavailableCopy =
                                    copy.status !== "AVAILABLE";

                                  const checked = selectedCopyIds.includes(
                                    copy.id,
                                  );

                                  return (
                                    <label
                                      key={copy.id}
                                      className={`flex items-center gap-3 rounded-lg border p-3 ${
                                        unavailableCopy
                                          ? "cursor-not-allowed bg-slate-100 opacity-60"
                                          : checked
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-slate-200 bg-white"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={unavailableCopy}
                                        onChange={() => toggleCopy(copy)}
                                        className="h-4 w-4"
                                      />

                                      <div>
                                        <p className="text-sm font-medium text-slate-900">
                                          {copy.code}
                                        </p>

                                        <p className="text-xs text-slate-500">
                                          Status:{" "}
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
                                {selectedCopyIds.length}
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

          {/* =================================================
            3. DATE
        ================================================= */}

          {selectedBook && (
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
            selectedBook &&
            selectedCopyIds.length > 0 &&
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

                  {/* BOOK */}

                  <div>
                    <p className="text-sm text-slate-500">Buku</p>

                    <p className="mt-1 font-medium text-slate-900">
                      {selectedBook.title}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Kode: {selectedBook.code}
                    </p>

                    <p className="mt-2 text-sm text-slate-700">
                      Copy dipilih:{" "}
                      <span className="font-semibold">
                        {selectedCopyIds.length}
                      </span>
                    </p>

                    <div className="mt-2 space-y-1">
                      {selectedCopyIds.map((copyId) => {
                        const copy = bookCopies.find(
                          (item) => item.id === copyId,
                        );

                        return (
                          <p key={copyId} className="text-sm text-slate-600">
                            {copy?.code}
                          </p>
                        );
                      })}
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
        </div>

        {/* =================================================
            SUCCESS
        ================================================= */}

        {successLoan && (
          <div ref={successRef} className="scroll-mt-6">
            <Card className="mt-5 border-green-200 bg-green-50 p-4 sm:p-6">
              <div role="status" aria-live="polite">
                <h3 className="text-lg font-semibold text-slate-900">
                  Peminjaman Berhasil
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Transaksi peminjaman berhasil dicatat.
                </p>

                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Nomor transaksi</p>

                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {successLoan.loanNumber}
                  </p>
                </div>

                <div className="mt-4 grid gap-4 border-t border-green-200 pt-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-slate-500">Anggota</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {selectedMember?.name ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Buku</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {selectedBook?.title ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Copy</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {bookCopies
                        .filter((copy) => selectedCopyIds.includes(copy.id))
                        .map((copy) => copy.code)
                        .join(", ") || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Tanggal peminjaman</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {formatDate(successLoan.borrowedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Jatuh tempo</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {formatDate(successLoan.dueAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    onClick={() => {
                      router.push("/transactions");
                    }}
                  >
                    Lihat Riwayat Transaksi
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetLoanForm}
                  >
                    Catat Peminjaman Baru
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
