"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

import {
  createMember,
  searchMembers,
  searchBooks,
  getBookCopies,
  createLoan,
} from "@/lib/mock-api";

import type {
  Book,
  BookCopy,
  Loan,
  Member,
} from "@/lib/types";

export default function NewLoanPage() {
  const router = useRouter();

  const [memberQuery, setMemberQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] =
    useState<Member | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showMemberForm, setShowMemberForm] =
    useState(false);

  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberIdentityNumber, setMemberIdentityNumber] =
    useState("");
  const [memberEmail, setMemberEmail] = useState("");

  const [memberFormError, setMemberFormError] =
    useState("");
  const [memberFormLoading, setMemberFormLoading] =
    useState(false);

  const [bookQuery, setBookQuery] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] =
    useState<Book | null>(null);

  const [bookCopies, setBookCopies] =
    useState<BookCopy[]>([]);
  const [selectedCopyIds, setSelectedCopyIds] =
    useState<string[]>([]);

  const [bookLoading, setBookLoading] =
    useState(false);
  const [bookError, setBookError] = useState("");
  const [copyLoading, setCopyLoading] =
    useState(false);
  const [copyError, setCopyError] = useState("");

  const [borrowedAt, setBorrowedAt] =
    useState("");
  const [dueAt, setDueAt] = useState("");
  const [dateError, setDateError] =
    useState("");

  const [submitLoading, setSubmitLoading] =
    useState(false);
  const [submitError, setSubmitError] =
    useState("");
  const [successLoan, setSuccessLoan] =
    useState<Loan | null>(null);

  async function handleSearchMember() {
    if (!memberQuery.trim()) {
      setMembers([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result =
        await searchMembers(memberQuery);

      setMembers(result);
    } catch {
      setError("Pencarian anggota gagal.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateMember() {
    setMemberFormError("");

    if (!memberName.trim()) {
      setMemberFormError("Nama wajib diisi.");
      return;
    }

    if (!memberPhone.trim()) {
      setMemberFormError(
        "Nomor HP wajib diisi.",
      );
      return;
    }

    if (!memberIdentityNumber.trim()) {
      setMemberFormError("NIK wajib diisi.");
      return;
    }

    if (
      memberEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        memberEmail.trim(),
      )
    ) {
      setMemberFormError(
        "Format email tidak valid.",
      );
      return;
    }

    setMemberFormLoading(true);

    try {
      const member = await createMember({
        name: memberName.trim(),
        phone: memberPhone.trim(),
        identityNumber:
          memberIdentityNumber.trim(),
        email:
          memberEmail.trim() || undefined,
        memberType: "UMUM",
        status: "ACTIVE",
      });

      setSelectedMember(member);
      setShowMemberForm(false);

      setMemberName("");
      setMemberPhone("");
      setMemberIdentityNumber("");
      setMemberEmail("");
    } catch {
      setMemberFormError(
        "Anggota gagal dibuat.",
      );
    } finally {
      setMemberFormLoading(false);
    }
  }

  async function handleSearchBook() {
    if (!bookQuery.trim()) {
      setBooks([]);
      return;
    }

    setBookLoading(true);
    setBookError("");

    try {
      const result =
        await searchBooks(bookQuery);

      setBooks(result);
    } catch {
      setBookError(
        "Pencarian buku gagal.",
      );
    } finally {
      setBookLoading(false);
    }
  }

  async function selectBook(book: Book) {
    if (
      book.status === "INACTIVE" ||
      book.availableCopies <= 0
    ) {
      return;
    }

    setSelectedBook(book);
    setSelectedCopyIds([]);
    setBookCopies([]);
    setCopyError("");

    setCopyLoading(true);

    try {
      const copies =
        await getBookCopies(book.id);

      setBookCopies(copies);
    } catch {
      setCopyError(
        "Copy buku gagal dimuat.",
      );
    } finally {
      setCopyLoading(false);
    }
  }

  function toggleCopy(copy: BookCopy) {
    if (copy.status !== "AVAILABLE") {
      return;
    }

    setSelectedCopyIds((current) => {
      if (current.includes(copy.id)) {
        return current.filter(
          (id) => id !== copy.id,
        );
      }

      return [...current, copy.id];
    });

    setSubmitError("");
  }

  function validateDates() {
    setDateError("");

    if (!borrowedAt) {
      setDateError(
        "Tanggal peminjaman wajib diisi.",
      );
      return false;
    }

    if (!dueAt) {
      setDateError(
        "Tanggal jatuh tempo wajib diisi.",
      );
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

  async function handleSubmitLoan() {
    setSubmitError("");

    if (!selectedMember) {
      setSubmitError(
        "Anggota belum dipilih.",
      );
      return;
    }

    if (!selectedBook) {
      setSubmitError("Buku belum dipilih.");
      return;
    }

    if (selectedCopyIds.length === 0) {
      setSubmitError(
        "Minimal satu copy harus dipilih.",
      );
      return;
    }

    if (!validateDates()) {
      return;
    }

    if (submitLoading) {
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
        error instanceof Error
          ? error.message
          : "Peminjaman gagal diproses.",
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              BukuFlow
            </h1>

            <p className="text-sm text-slate-500">
              Catat Peminjaman
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            Peminjaman Buku
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Cari anggota terlebih dahulu untuk
            membuat transaksi.
          </p>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900">
            1. Cari Anggota
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Cari berdasarkan nama, nomor anggota,
            NIK, atau nomor HP.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Input
                id="member-search"
                label="Anggota"
                value={memberQuery}
                onChange={(event) =>
                  setMemberQuery(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSearchMember();
                  }
                }}
                placeholder="Cari anggota..."
              />
            </div>

            <div className="sm:self-end">
              <Button
                type="button"
                onClick={handleSearchMember}
                loading={loading}
                disabled={!memberQuery.trim()}
              >
                Cari
              </Button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 text-sm text-red-600"
            >
              {error}
            </p>
          )}

          {!loading &&
            memberQuery.trim() &&
            members.length === 0 &&
            !error &&
            !showMemberForm && (
              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-800">
                  Anggota tidak ditemukan
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Anggota belum ditemukan. Kamu
                  dapat membuat anggota baru.
                </p>

                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    setShowMemberForm(true);
                    setMemberFormError("");
                  }}
                >
                  Buat Anggota Baru
                </Button>
              </div>
            )}

          {members.length > 0 &&
            !selectedMember && (
              <div className="mt-5 space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">
                  Hasil pencarian
                </h4>

                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() =>
                      setSelectedMember(member)
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <p className="font-medium text-slate-900">
                      {member.name}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {member.memberNumber} ·{" "}
                      {member.phone}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Status:{" "}
                      {member.status ===
                      "ACTIVE"
                        ? "Aktif"
                        : "Tidak aktif"}
                    </p>
                  </button>
                ))}
              </div>
            )}

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
                  onClick={() =>
                    setSelectedMember(null)
                  }
                >
                  Ganti Anggota
                </Button>
              </div>
            </div>
          )}
        </Card>

        {showMemberForm && (
          <Card className="mt-5 p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Buat Anggota Baru
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Isi data anggota untuk melanjutkan
              peminjaman.
            </p>

            <div className="mt-5 space-y-4">
              <Input
                id="member-name"
                label="Nama"
                value={memberName}
                onChange={(event) =>
                  setMemberName(
                    event.target.value,
                  )
                }
                required
              />

              <Input
                id="member-phone"
                label="Nomor HP"
                value={memberPhone}
                onChange={(event) =>
                  setMemberPhone(
                    event.target.value,
                  )
                }
                required
              />

              <Input
                id="member-identity-number"
                label="NIK"
                value={memberIdentityNumber}
                onChange={(event) =>
                  setMemberIdentityNumber(
                    event.target.value,
                  )
                }
                required
              />

              <Input
                id="member-email"
                label="Email (opsional)"
                type="email"
                value={memberEmail}
                onChange={(event) =>
                  setMemberEmail(
                    event.target.value,
                  )
                }
              />

              {memberFormError && (
                <p
                  role="alert"
                  className="text-sm text-red-600"
                >
                  {memberFormError}
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  loading={memberFormLoading}
                  onClick={handleCreateMember}
                >
                  Simpan Anggota
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={memberFormLoading}
                  onClick={() => {
                    setShowMemberForm(false);
                    setMemberFormError("");
                  }}
                >
                  Batal
                </Button>
              </div>
            </div>
          </Card>
        )}

        {selectedMember && (
          <Card className="mt-5 p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              2. Pilih Buku
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Cari judul buku yang akan dipinjam.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  id="book-search"
                  label="Buku"
                  value={bookQuery}
                  onChange={(event) =>
                    setBookQuery(
                      event.target.value,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSearchBook();
                    }
                  }}
                  placeholder="Cari judul, kode, atau ISBN..."
                />
              </div>

              <Button
                type="button"
                onClick={handleSearchBook}
                loading={bookLoading}
                disabled={!bookQuery.trim()}
              >
                Cari
              </Button>
            </div>

            {bookError && (
              <p
                role="alert"
                className="mt-4 text-sm text-red-600"
              >
                {bookError}
              </p>
            )}

            {!bookLoading &&
              bookQuery.trim() &&
              books.length === 0 &&
              !bookError && (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-medium text-slate-800">
                    Buku tidak ditemukan
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Tidak ada buku yang sesuai
                    dengan pencarian.
                  </p>
                </div>
              )}

            {books.length > 0 && (
              <div className="mt-5 space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">
                  Hasil pencarian
                </h4>

                {books.map((book) => {
                  const unavailable =
                    book.status ===
                      "INACTIVE" ||
                    book.availableCopies <= 0;

                  const selected =
                    selectedBook?.id === book.id;

                  return (
                    <div
                      key={book.id}
                      className={`rounded-lg border p-4 ${
                        selected
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium text-slate-900">
                            {book.title}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Kode: {book.code}
                          </p>
                        </div>

                        <p className="text-sm text-slate-600">
                          {book.status ===
                          "AVAILABLE"
                            ? "Tersedia"
                            : book.status ===
                                "BORROWED"
                              ? "Dipinjam"
                              : "Tidak aktif"}
                        </p>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-slate-500">
                            Total copy
                          </p>

                          <p className="font-medium text-slate-900">
                            {book.totalCopies}
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500">
                            Tersedia
                          </p>

                          <p className="font-medium text-slate-900">
                            {book.availableCopies}
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        className="mt-4"
                        disabled={unavailable}
                        loading={
                          selected &&
                          copyLoading
                        }
                        onClick={() =>
                          selectBook(book)
                        }
                      >
                        {unavailable
                          ? "Tidak tersedia"
                          : selected
                            ? "Buku dipilih"
                            : "Pilih Buku"}
                      </Button>

                      {selected && (
                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <p className="text-sm font-medium text-slate-700">
                            Pilih copy buku
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Pilih satu atau lebih
                            copy yang tersedia.
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
                          ) : (
                            <div className="mt-4 space-y-2">
                              {bookCopies.map(
                                (copy) => {
                                  const
                                    unavailableCopy =
                                      copy.status !==
                                      "AVAILABLE";

                                  const
                                    checked =
                                      selectedCopyIds.includes(
                                        copy.id,
                                      );

                                  return (
                                    <label
                                      key={
                                        copy.id
                                      }
                                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                                        unavailableCopy
                                          ? "cursor-not-allowed bg-slate-100 opacity-60"
                                          : checked
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-slate-200 bg-white"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={
                                          checked
                                        }
                                        disabled={
                                          unavailableCopy
                                        }
                                        onChange={() =>
                                          toggleCopy(
                                            copy,
                                          )
                                        }
                                        className="h-4 w-4"
                                      />

                                      <div>
                                        <p className="text-sm font-medium text-slate-900">
                                          {
                                            copy.code
                                          }
                                        </p>

                                        <p className="text-xs text-slate-500">
                                          Status:{" "}
                                          {copy.status ===
                                          "AVAILABLE"
                                            ? "Tersedia"
                                            : copy.status ===
                                                "BORROWED"
                                              ? "Dipinjam"
                                              : copy.status ===
                                                  "INACTIVE"
                                                ? "Tidak aktif"
                                                : "Hilang"}
                                        </p>
                                      </div>
                                    </label>
                                  );
                                },
                              )}
                            </div>
                          )}

                          <p className="mt-3 text-sm text-slate-600">
                            Copy dipilih:{" "}
                            <span className="font-semibold">
                              {
                                selectedCopyIds.length
                              }
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

        {selectedBook && (
          <Card className="mt-5 p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              3. Tanggal Peminjaman
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Tentukan tanggal peminjaman dan
              tanggal jatuh tempo.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input
                id="borrowed-at"
                label="Tanggal peminjaman"
                type="date"
                value={borrowedAt}
                onChange={(event) => {
                  const value =
                    event.target.value;

                  setBorrowedAt(value);
                  setDateError("");

                  if (
                    dueAt &&
                    value > dueAt
                  ) {
                    setDateError(
                      "Tanggal jatuh tempo tidak boleh sebelum tanggal peminjaman.",
                    );
                  }
                }}
                required
              />

              <Input
                id="due-at"
                label="Tanggal jatuh tempo"
                type="date"
                min={
                  borrowedAt || undefined
                }
                value={dueAt}
                onChange={(event) => {
                  const value =
                    event.target.value;

                  setDueAt(value);

                  if (
                    borrowedAt &&
                    value < borrowedAt
                  ) {
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
              <p
                role="alert"
                className="mt-4 text-sm text-red-600"
              >
                {dateError}
              </p>
            )}
          </Card>
        )}

        {selectedMember &&
          selectedBook &&
          selectedCopyIds.length > 0 &&
          borrowedAt &&
          dueAt && (
            <Card className="mt-5 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                4. Ringkasan Peminjaman
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Periksa kembali data peminjaman
                sebelum dikonfirmasi.
              </p>

              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-sm text-slate-500">
                    Anggota
                  </p>

                  <p className="mt-1 font-medium text-slate-900">
                    {selectedMember.name}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedMember.memberNumber}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Buku
                  </p>

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
                    {selectedCopyIds.map(
                      (copyId) => {
                        const copy =
                          bookCopies.find(
                            (item) =>
                              item.id ===
                              copyId,
                          );

                        return (
                          <p
                            key={copyId}
                            className="text-sm text-slate-600"
                          >
                            {copy?.code}
                          </p>
                        );
                      },
                    )}
                  </div>
                </div>

                <div className="grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-slate-500">
                      Tanggal peminjaman
                    </p>

                    <p className="mt-1 font-medium text-slate-900">
                      {new Date(
                        `${borrowedAt}T00:00:00`,
                      ).toLocaleDateString(
                        "id-ID",
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">
                      Tanggal jatuh tempo
                    </p>

                    <p className="mt-1 font-medium text-slate-900">
                      {new Date(
                        `${dueAt}T00:00:00`,
                      ).toLocaleDateString(
                        "id-ID",
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-200 pt-5">
                {submitError && (
                  <p
                    role="alert"
                    className="mb-4 text-sm text-red-600"
                  >
                    {submitError}
                  </p>
                )}

                <Button
                  type="button"
                  loading={submitLoading}
                  disabled={submitLoading}
                  onClick={handleSubmitLoan}
                >
                  Konfirmasi Peminjaman
                </Button>
              </div>
            </Card>
          )}

        {successLoan && (
          <Card className="mt-5 p-6">
            <div
              role="status"
              aria-live="polite"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                Peminjaman Berhasil
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Transaksi peminjaman berhasil
                dicatat.
              </p>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">
                  Nomor transaksi
                </p>

                <p className="mt-1 text-xl font-bold text-slate-900">
                  {successLoan.loanNumber}
                </p>
              </div>

              <Button
                type="button"
                className="mt-5"
                onClick={() => {
                  router.push("/transactions");
                }}
              >
                Kembali ke Transaksi
              </Button>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
