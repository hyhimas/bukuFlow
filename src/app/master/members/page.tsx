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

import type { Member, MemberStatus } from "@/lib/types";
import { masterDataRepository } from "@/lib/master-data/repository";

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

const PAGE_SIZE = 8;

export default function MasterMembersPage() {
  const router = useRouter();

  // =====================================================
  // PAGE
  // =====================================================

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState("");

  const hasLoadedMembers = useRef(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "">("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [successMessage, setSuccessMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");

  // =====================================================
  // FORM
  // =====================================================

  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [email, setEmail] = useState("");

  const [formErrors, setFormErrors] =
    useState<MemberFormErrors>(EMPTY_MEMBER_ERRORS);

  const [formLoading, setFormLoading] = useState(false);

  const formCloseRef = useRef<HTMLButtonElement>(null);
  const formModalRef = useRef<HTMLDivElement>(null);

  // =====================================================
  // DETAIL
  // =====================================================

  const [detailMember, setDetailMember] = useState<Member | null>(null);

  const detailCloseRef = useRef<HTMLButtonElement>(null);
  const detailModalRef = useRef<HTMLDivElement>(null);

  // =====================================================
  // STATUS
  // =====================================================

  const [confirmMember, setConfirmMember] = useState<Member | null>(null);

  const [confirmStatus, setConfirmStatus] = useState<MemberStatus | null>(null);

  const [statusLoading, setStatusLoading] = useState(false);

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
  // LOAD MEMBERS
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      if (!hasLoadedMembers.current) {
        setLoading(true);
      } else {
        setTableLoading(true);
      }

      setError("");

      try {
        const result = await masterDataRepository.listMembers({
          search,
          status: statusFilter || undefined,
          page,
          pageSize: PAGE_SIZE,
        });

        if (cancelled) {
          return;
        }

        setMembers(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);

        hasLoadedMembers.current = true;
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMembers([]);
        setTotal(0);
        setTotalPages(1);

        setError(
          error instanceof Error ? error.message : "Data member gagal dimuat.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
          setTableLoading(false);
        }
      }
    }, 400);

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
  // FORM ESCAPE + FOCUS TRAP
  // =====================================================

  useEffect(() => {
    if (!showForm) {
      return;
    }

    formCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !formLoading) {
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
  }, [showForm, formLoading]);

  // =====================================================
  // DETAIL ESCAPE
  // =====================================================

  useEffect(() => {
    if (!detailMember) {
      return;
    }

    detailCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailMember(null);
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
  }, [detailMember]);

  // =====================================================
  // OPEN CREATE
  // =====================================================

  function openCreateForm() {
    setEditingMember(null);

    setName("");
    setPhone("");
    setIdentityNumber("");
    setEmail("");

    setFormErrors(EMPTY_MEMBER_ERRORS);
    setShowForm(true);
  }

  // =====================================================
  // OPEN EDIT
  // =====================================================

  function openEditForm(member: Member) {
    setEditingMember(member);

    setName(member.name);
    setPhone(member.phone);
    setIdentityNumber(member.identityNumber);
    setEmail(member.email ?? "");

    setFormErrors(EMPTY_MEMBER_ERRORS);
    setShowForm(true);
  }

  // =====================================================
  // CLOSE FORM
  // =====================================================

  function closeForm() {
    if (formLoading) {
      return;
    }

    setShowForm(false);
    setEditingMember(null);
    setFormErrors(EMPTY_MEMBER_ERRORS);
  }

  // =====================================================
  // VALIDATE FORM
  // =====================================================

  function validateForm() {
    const errors: MemberFormErrors = {
      name: "",
      phone: "",
      identityNumber: "",
      email: "",
    };

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanNik = identityNumber.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      errors.name = "Nama wajib diisi.";
    } else if (cleanName.length < 2) {
      errors.name = "Nama harus terdiri dari minimal 2 karakter.";
    }

    if (!cleanPhone) {
      errors.phone = "Nomor HP wajib diisi.";
    } else if (!/^\d{10,15}$/.test(cleanPhone)) {
      errors.phone = "Nomor HP harus terdiri dari 10-15 digit.";
    }

    if (!cleanNik) {
      errors.identityNumber = "NIK wajib diisi.";
    } else if (!/^\d{16}$/.test(cleanNik)) {
      errors.identityNumber = "NIK harus terdiri dari 16 digit.";
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = "Format email tidak valid.";
    }

    setFormErrors(errors);

    return !Object.values(errors).some(Boolean);
  }

  // =====================================================
  // SUBMIT
  // =====================================================

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSuccessMessage("");
    setWarningMessage("");

    if (!validateForm()) {
      return;
    }

    setFormLoading(true);

    try {
      if (editingMember) {
        const newName = name.trim();
        const newPhone = phone.trim();
        const newIdentityNumber = identityNumber.trim();
        const newEmail = email.trim();

        const currentEmail = editingMember.email?.trim() ?? "";

        const hasChanges =
          newName !== editingMember.name ||
          newPhone !== editingMember.phone ||
          newIdentityNumber !== editingMember.identityNumber ||
          newEmail !== currentEmail;

        if (!hasChanges) {
          setWarningMessage("Tidak ada perubahan yang disimpan.");
          closeForm();
          return;
        }

        await masterDataRepository.updateMember(editingMember.id, {
          name: newName,
          phone: newPhone,
          identityNumber: newIdentityNumber,
          email: newEmail || undefined,
        });

        setSuccessMessage("Data member berhasil diperbarui.");
      } else {
        await masterDataRepository.createMember({
          name: name.trim(),
          phone: phone.trim(),
          identityNumber: identityNumber.trim(),
          email: email.trim() || undefined,
        });

        setSuccessMessage("Member berhasil ditambahkan.");
      }

      closeForm();

      const result = await masterDataRepository.listMembers({
        search,
        status: statusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });

      setMembers(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Data member gagal disimpan.";

      const lowerMessage = message.toLowerCase();

      if (lowerMessage.includes("nik") || lowerMessage.includes("terdaftar")) {
        setFormErrors((current) => ({
          ...current,
          identityNumber: message,
        }));
      } else if (lowerMessage.includes("email")) {
        setFormErrors((current) => ({
          ...current,
          email: message,
        }));
      } else if (
        lowerMessage.includes("nomor hp") ||
        lowerMessage.includes("phone")
      ) {
        setFormErrors((current) => ({
          ...current,
          phone: message,
        }));
      } else {
        setFormErrors((current) => ({
          ...current,
          name: message,
        }));
      }
    } finally {
      setFormLoading(false);
    }
  }

  // =====================================================
  // DETAIL
  // =====================================================

  async function openDetail(member: Member) {
    try {
      const result = await masterDataRepository.getMember(member.id);

      setDetailMember(result ?? member);
    } catch {
      setDetailMember(member);
    }
  }

  // =====================================================
  // STATUS CONFIRM
  // =====================================================

  function openStatusConfirm(member: Member) {
    const nextStatus: MemberStatus =
      member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    setConfirmMember(member);
    setConfirmStatus(nextStatus);
  }

  // =====================================================
  // CHANGE STATUS
  // =====================================================

  async function handleChangeStatus() {
    if (!confirmMember || !confirmStatus) {
      return;
    }

    setStatusLoading(true);

    try {
      await masterDataRepository.changeMemberStatus(confirmMember.id, {
        status: confirmStatus,
      });

      setSuccessMessage(
        confirmStatus === "ACTIVE"
          ? "Member berhasil diaktifkan."
          : "Member berhasil dinonaktifkan.",
      );

      setConfirmMember(null);
      setConfirmStatus(null);

      const result = await masterDataRepository.listMembers({
        search,
        status: statusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });

      setMembers(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);

      if (detailMember?.id === confirmMember.id) {
        setDetailMember({
          ...detailMember,
          status: confirmStatus,
        });
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Status member gagal diubah.",
      );

      setConfirmMember(null);
      setConfirmStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }

  // =====================================================
  // HELPERS
  // =====================================================

  function getStatusLabel(status: MemberStatus) {
    return status === "ACTIVE" ? "Aktif" : "Tidak Aktif";
  }

  function getInitial(name: string) {
    return name.trim().charAt(0).toUpperCase();
  }

  // =====================================================
  // INITIAL LOADING
  // =====================================================

  if (loading && members.length === 0 && !error) {
    return (
      <main className="min-h-screen bg-slate-50">
        <LoadingState label="Memuat data member..." />
      </main>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-4">
          <BackLink href="/dashboard" />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Master Member
              </h1>

              <p className="mt-0.5 text-sm text-slate-500">
                Kelola data anggota perpustakaan.
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
                  + Tambah Member
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* =================================================
            SUCCESS
        ================================================= */}

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
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>
          </div>
        )}

        {/* =================================================
            WARNING
        ================================================= */}

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
                  Tidak ada perubahan
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
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>
          </div>
        )}

        {/* =================================================
            SEARCH
        ================================================= */}

        <Card className="mb-3 p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-end">
            <Input
              id="member-search"
              label="Cari Member"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nama, nomor anggota, NIK, atau email..."
            />

            <div>
              <label
                htmlFor="member-status"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Status
              </label>

              <div className="relative">
                <Dropdown
                  id="member-status"
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value as MemberStatus | "");
                  }}
                  ariaLabel="Filter status member"
                  options={[
                    {
                      value: "",
                      label: "Semua Status",
                    },
                    {
                      value: "ACTIVE",
                      label: "Aktif",
                    },
                    {
                      value: "INACTIVE",
                      label: "Tidak Aktif",
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div
            role="alert"
            className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* =================================================
            MEMBER TABLE / LIST
        ================================================= */}

        <Card className="overflow-hidden">
          {/* CARD HEADER */}

          {/* =================================================
              EMPTY
          ================================================= */}

          {!loading && members.length === 0 && (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <span className="text-lg">?</span>
              </div>

              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                Member tidak ditemukan
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                Coba ubah kata pencarian atau filter status.
              </p>
            </div>
          )}

          {/* =================================================
              DESKTOP TABLE
          ================================================= */}

          {members.length > 0 && (
            <div className="relative hidden overflow-hidden lg:block">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[125px]" />
                  <col />
                  <col className="w-[180px]" />
                  <col className="w-[140px]" />
                  <col className="w-[125px]" />
                  <col className="w-[255px]" />
                </colgroup>

                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">No. Anggota</th>

                    <th className="px-4 py-2.5">Nama</th>

                    <th className="px-4 py-2.5">NIK</th>

                    <th className="px-4 py-2.5">No. HP</th>

                    <th className="px-4 py-2.5">Status</th>

                    <th className="px-4 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {members.map((member) => {
                    const isActive = member.status === "ACTIVE";

                    return (
                      <tr
                        key={member.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {member.memberNumber}
                        </td>

                        <td className="min-w-0 px-4 py-3">
                          <p className="truncate font-medium text-slate-800">
                            {member.name}
                          </p>

                          {member.email && (
                            <p className="mt-0.5 truncate text-xs text-slate-400">
                              {member.email}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {member.identityNumber}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {member.phone}
                        </td>

                        {/* STATUS */}

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isActive ? "bg-emerald-500" : "bg-red-500"
                              }`}
                            />

                            {getStatusLabel(member.status)}
                          </span>
                        </td>

                        {/* ACTION */}

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void openDetail(member)}
                              className="inline-flex h-8 min-w-[56px] items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              Detail
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditForm(member)}
                              className="inline-flex h-8 min-w-[52px] items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              Ubah
                            </button>

                            <button
                              type="button"
                              onClick={() => openStatusConfirm(member)}
                              className={`inline-flex h-8 min-w-[88px] items-center justify-center rounded-md border px-2.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                isActive
                                  ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {isActive ? "Nonaktifkan" : "Aktifkan"}
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
                  aria-label="Memuat data member"
                >
                  <div className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                    Memuat data...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================
              TABLET + MOBILE
          ================================================= */}

          {members.length > 0 && (
            <div className="relative grid grid-cols-1 gap-3 bg-slate-50/60 p-3 sm:p-3 md:grid-cols-2 lg:hidden">
              {members.map((member) => {
                const isActive = member.status === "ACTIVE";

                return (
                  <div
                    key={member.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    {/* TOP */}

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            isActive
                              ? "bg-blue-50 text-blue-600"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {getInitial(member.name)}
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-400">
                            {member.memberNumber}
                          </p>

                          <p className="truncate text-sm font-semibold text-slate-900">
                            {member.name}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isActive ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />

                        {getStatusLabel(member.status)}
                      </span>
                    </div>

                    {/* INFORMATION */}

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          NIK
                        </p>

                        <p className="mt-0.5 truncate text-xs font-medium text-slate-700">
                          {member.identityNumber}
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          No. HP
                        </p>

                        <p className="mt-0.5 truncate text-xs font-medium text-slate-700">
                          {member.phone}
                        </p>
                      </div>
                    </div>

                    {/* EMAIL */}

                    {member.email && (
                      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Email
                        </p>

                        <p className="mt-0.5 truncate text-xs font-medium text-slate-700">
                          {member.email}
                        </p>
                      </div>
                    )}

                    {/* ACTION */}

                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => void openDetail(member)}
                        className="h-9 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        Detail
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditForm(member)}
                        className="h-9 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        Ubah
                      </button>

                      <button
                        type="button"
                        onClick={() => openStatusConfirm(member)}
                        className={`h-9 rounded-md border text-xs font-semibold ${
                          isActive
                            ? "border-red-200 bg-red-50 text-red-600"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {isActive ? "Nonaktifkan" : "Aktifkan"}
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
                  aria-label="Memuat data member"
                >
                  <div className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                    Memuat data...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================
              PAGINATION
          ================================================= */}

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

                {Array.from({ length: totalPages }, (_, index) => index + 1)
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
          ADD / EDIT MODAL
      ===================================================== */}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !formLoading) {
              closeForm();
            }
          }}
        >
          <div
            ref={formModalRef}
            className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-form-title"
          >
            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2
                  id="member-form-title"
                  className="text-base font-semibold text-slate-900"
                >
                  {editingMember ? "Ubah Member" : "Tambah Member"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  {editingMember
                    ? "Perbarui informasi member."
                    : "Masukkan data member baru."}
                </p>
              </div>

              <button
                ref={formCloseRef}
                type="button"
                disabled={formLoading}
                aria-label="Tutup form"
                onClick={closeForm}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  ×
                </span>
              </button>
            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="grid gap-3.5 p-4 sm:grid-cols-2"
            >
              {editingMember && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Nomor Anggota
                  </p>

                  <p className="mt-0.5 text-sm font-semibold text-slate-800">
                    {editingMember.memberNumber}
                  </p>
                </div>
              )}

              <Input
                id="member-name"
                label="Nama"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);

                  if (formErrors.name) {
                    setFormErrors((current) => ({
                      ...current,
                      name: "",
                    }));
                  }
                }}
                error={formErrors.name}
                autoComplete="name"
                required
              />

              <Input
                id="member-phone"
                label="Nomor HP"
                type="tel"
                inputMode="numeric"
                maxLength={15}
                value={phone}
                onChange={(event) => {
                  const value = event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 15);

                  setPhone(value);

                  if (formErrors.phone) {
                    setFormErrors((current) => ({
                      ...current,
                      phone: "",
                    }));
                  }
                }}
                error={formErrors.phone}
                placeholder="08xxxxxxxxxx"
                autoComplete="tel"
                required
              />

              <Input
                id="member-nik"
                label="NIK"
                type="text"
                inputMode="numeric"
                maxLength={16}
                value={identityNumber}
                onChange={(event) => {
                  const value = event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 16);

                  setIdentityNumber(value);

                  if (formErrors.identityNumber) {
                    setFormErrors((current) => ({
                      ...current,
                      identityNumber: "",
                    }));
                  }
                }}
                error={formErrors.identityNumber}
                placeholder="16 digit NIK"
                required
              />

              <Input
                id="member-email"
                label="Email (opsional)"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);

                  if (formErrors.email) {
                    setFormErrors((current) => ({
                      ...current,
                      email: "",
                    }));
                  }
                }}
                error={formErrors.email}
                placeholder="nama@email.com"
                autoComplete="email"
              />

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:col-span-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={formLoading}
                  onClick={closeForm}
                  className="w-full sm:w-auto"
                >
                  Batal
                </Button>

                <Button
                  type="submit"
                  loading={formLoading}
                  className="w-full sm:w-auto"
                >
                  {editingMember ? "Simpan Perubahan" : "Simpan Member"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
    DETAIL MODAL
===================================================== */}

      {detailMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDetailMember(null);
            }
          }}
        >
          <div
            ref={detailModalRef}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-detail-title"
          >
            {/* DETAIL HEADER */}

            <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  {/* AVATAR */}

                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xl font-bold text-blue-600">
                    {getInitial(detailMember.name)}
                  </div>

                  {/* MEMBER IDENTITY */}

                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-400">
                      {detailMember.memberNumber}
                    </p>

                    <h2
                      id="member-detail-title"
                      className="mt-0.5 truncate text-xl font-bold text-slate-900"
                    >
                      {detailMember.name}
                    </h2>

                    <span
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        detailMember.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          detailMember.status === "ACTIVE"
                            ? "bg-emerald-500"
                            : "bg-red-500"
                        }`}
                      />

                      {getStatusLabel(detailMember.status)}
                    </span>
                  </div>
                </div>

                {/* CLOSE */}

                <button
                  ref={detailCloseRef}
                  type="button"
                  aria-label="Tutup detail member"
                  onClick={() => setDetailMember(null)}
                  className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span aria-hidden="true" className="text-xl leading-none">
                    ×
                  </span>
                </button>
              </div>
            </div>

            {/* DETAIL BODY */}

            <div className="bg-slate-50/60 p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {/* NAMA */}

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Nama Lengkap
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailMember.name}
                  </p>
                </div>

                {/* NOMOR ANGGOTA */}

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Nomor Anggota
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailMember.memberNumber}
                  </p>
                </div>

                {/* NIK */}

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    NIK
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailMember.identityNumber}
                  </p>
                </div>

                {/* NOMOR HP */}

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Nomor HP
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailMember.phone}
                  </p>
                </div>

                {/* EMAIL */}

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Email
                  </p>

                  <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                    {detailMember.email || "-"}
                  </p>
                </div>

                {/* TIPE MEMBER */}

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Tipe Member
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailMember.memberType || "Umum"}
                  </p>
                </div>

                {/* STATUS */}

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Status
                  </p>

                  <span
                    className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      detailMember.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        detailMember.status === "ACTIVE"
                          ? "bg-emerald-500"
                          : "bg-red-500"
                      }`}
                    />

                    {getStatusLabel(detailMember.status)}
                  </span>
                </div>

                {/* BERGABUNG */}

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Bergabung Pada
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {new Date(detailMember.createdAt).toLocaleDateString(
                      "id-ID",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      },
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* DETAIL FOOTER */}

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDetailMember(null);
                  openEditForm(detailMember);
                }}
                className="w-full sm:w-auto"
              >
                Ubah Member
              </Button>

              <Button
                type="button"
                onClick={() => setDetailMember(null)}
                className="w-full sm:w-auto"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          STATUS CONFIRMATION
      ===================================================== */}

      <ConfirmationDialog
        open={Boolean(confirmMember && confirmStatus)}
        title={
          confirmStatus === "ACTIVE"
            ? "Aktifkan Member?"
            : "Nonaktifkan Member?"
        }
        description={
          confirmMember
            ? confirmStatus === "ACTIVE"
              ? `Member "${confirmMember.name}" akan diaktifkan kembali.`
              : `Member "${confirmMember.name}" akan dinonaktifkan. Data tetap tersimpan.`
            : ""
        }
        confirmLabel={
          confirmStatus === "ACTIVE" ? "Ya, Aktifkan" : "Ya, Nonaktifkan"
        }
        onClose={() => {
          if (!statusLoading) {
            setConfirmMember(null);
            setConfirmStatus(null);
          }
        }}
        onConfirm={() => {
          void handleChangeStatus();
        }}
      />
    </main>
  );
}
