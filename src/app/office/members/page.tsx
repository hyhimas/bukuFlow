"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Dropdown from "@/components/ui/Dropdown";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import BackLink from "@/components/ui/BackLink";
import LoadingState from "@/components/ui/LoadingState";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import Pagination from "@/components/ui/Pagination";

import { getSession } from "@/lib/auth";
import {
  getOfficeMembersApi,
  searchOfficeMembersApi,
  createOfficeMemberApi,
  updateOfficeMemberApi,
  deleteMemberApi,
  getOfficeMemberDetailApi,
  getCompaniesApi,
} from "@/lib/api";
import type { Company, Member, MemberStatus } from "@/lib/types";
import { useToast } from "@/context/ToastContext";

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

export default function OfficeMembersPage() {
  const router = useRouter();
  const { toast } = useToast();

  // =====================================================
  // AUTH & TENANT SELECTION
  // =====================================================
  const [userName, setUserName] = useState("Super Admin");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("company-001");
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const companyDropdownRef = useRef<HTMLDivElement>(null);

  // =====================================================
  // TABLE STATE
  // =====================================================
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "">("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // =====================================================
  // FORM (CREATE / EDIT)
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
  // DETAIL MODAL
  // =====================================================
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const detailCloseRef = useRef<HTMLButtonElement>(null);
  const detailModalRef = useRef<HTMLDivElement>(null);

  // =====================================================
  // STATUS CONFIRMATION
  // =====================================================
  const [confirmMember, setConfirmMember] = useState<Member | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<MemberStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Close company dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        companyDropdownRef.current &&
        !companyDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCompanyDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Guard Super Admin Session
  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    if (session.user.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
      return;
    }
    setUserName(session.user.name || "Super Admin");
    setCheckingAuth(false);
  }, [router]);

  // Load Companies
  useEffect(() => {
    if (!checkingAuth) {
      getCompaniesApi().then((comps) => {
        if (comps.length > 0) {
          setCompanies(comps);
          if (!selectedCompanyId) {
            setSelectedCompanyId(comps[0].id);
          }
        }
      }).catch(() => {});
    }
  }, [checkingAuth]);

  // 2. Fetch Members (with debounce on search)
  useEffect(() => {
    if (checkingAuth) return;

    let cancelled = false;
    const isSearchQuery = Boolean(search.trim());

    if (!loading) {
      setTableLoading(true);
    }

    const timer = setTimeout(
      async () => {
        try {
          if (isSearchQuery) {
            const results = await searchOfficeMembersApi(
              selectedCompanyId,
              search.trim()
            );
            if (cancelled) return;

            const filtered = statusFilter
              ? results.filter((m) => m.status === statusFilter)
              : results;

            setMembers(filtered);
            setTotal(filtered.length);
            setTotalPages(1);
          } else {
            const res = await getOfficeMembersApi(selectedCompanyId, {
              page,
              size: pageSize,
            });
            if (cancelled) return;

            const filtered = statusFilter
              ? res.items.filter((m) => m.status === statusFilter)
              : res.items;

            setMembers(filtered);
            setTotal(res.total);
            setTotalPages(res.totalPages);
          }
          setError("");
        } catch (err: any) {
          if (!cancelled) {
            setError(err.message || "Gagal memuat data anggota.");
            toast.error(err.message || "Gagal memuat data anggota.");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
            setTableLoading(false);
          }
        }
      },
      isSearchQuery ? 350 : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedCompanyId, page, pageSize, search, statusFilter, checkingAuth, toast]);

  // Reset page when search or company changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, selectedCompanyId]);

  // =====================================================
  // FORM HANDLERS
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

  function openEditForm(member: Member) {
    setEditingMember(member);
    setName(member.name);
    setPhone(member.phone);
    setIdentityNumber(member.identityNumber || "");
    setEmail(member.email || "");
    setFormErrors(EMPTY_MEMBER_ERRORS);
    setShowForm(true);
  }

  function closeForm() {
    if (formLoading) return;
    setShowForm(false);
    setEditingMember(null);
    setFormErrors(EMPTY_MEMBER_ERRORS);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors: MemberFormErrors = {
      name: name.trim() ? "" : "Nama wajib diisi.",
      phone: phone.trim() ? "" : "Nomor HP wajib diisi.",
      identityNumber: identityNumber.trim() ? "" : "NIK wajib diisi.",
      email: "",
    };

    if (nextErrors.name || nextErrors.phone || nextErrors.identityNumber) {
      setFormErrors(nextErrors);
      return;
    }

    setFormLoading(true);
    setFormErrors(EMPTY_MEMBER_ERRORS);

    try {
      if (editingMember) {
        await updateOfficeMemberApi(selectedCompanyId, editingMember.id, {
          name: name.trim(),
          phone: phone.trim(),
          identity_number: identityNumber.trim(),
          email: email.trim() || undefined,
          status: editingMember.status,
        });
        toast.success("Data member berhasil diperbarui.");
      } else {
        const generatedMemberNumber = `MBR-${Date.now().toString().slice(-4)}`;
        await createOfficeMemberApi(selectedCompanyId, {
          name: name.trim(),
          phone: phone.trim(),
          identity_number: identityNumber.trim(),
          email: email.trim() || undefined,
          member_number: generatedMemberNumber,
        });
        toast.success("Member baru berhasil ditambahkan.");
      }

      closeForm();

      // Refresh list
      const res = await getOfficeMembersApi(selectedCompanyId, {
        page: 1,
        size: pageSize,
      });
      setMembers(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setPage(1);
    } catch (err: any) {
      const message = err.message || "Gagal menyimpan data member.";
      toast.error(message);
      const lower = message.toLowerCase();
      if (lower.includes("nik")) {
        setFormErrors((curr) => ({ ...curr, identityNumber: message }));
      } else if (lower.includes("email")) {
        setFormErrors((curr) => ({ ...curr, email: message }));
      } else if (lower.includes("hp") || lower.includes("phone")) {
        setFormErrors((curr) => ({ ...curr, phone: message }));
      } else {
        setFormErrors((curr) => ({ ...curr, name: message }));
      }
    } finally {
      setFormLoading(false);
    }
  }

  // =====================================================
  // DETAIL HANDLER
  // =====================================================
  async function openDetail(member: Member) {
    try {
      const result = await getOfficeMemberDetailApi(
        selectedCompanyId,
        member.id
      );
      setDetailMember(result ?? member);
    } catch {
      setDetailMember(member);
    }
  }

  // =====================================================
  // STATUS CHANGE HANDLERS
  // =====================================================
  function openStatusConfirm(member: Member) {
    const nextStatus: MemberStatus =
      member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setConfirmMember(member);
    setConfirmStatus(nextStatus);
  }

  async function handleChangeStatus() {
    if (!confirmMember || !confirmStatus) return;

    setStatusLoading(true);
    try {
      if (confirmStatus === "INACTIVE") {
        await deleteMemberApi(confirmMember.id);
      } else {
        await updateOfficeMemberApi(selectedCompanyId, confirmMember.id, {
          status: confirmStatus,
        });
      }

      toast.success(
        confirmStatus === "ACTIVE"
          ? "Member berhasil diaktifkan."
          : "Member berhasil dinonaktifkan."
      );

      setConfirmMember(null);
      setConfirmStatus(null);

      // Refresh list
      const res = await getOfficeMembersApi(selectedCompanyId, {
        page,
        size: pageSize,
      });
      const filtered = statusFilter
        ? res.items.filter((m) => m.status === statusFilter)
        : res.items;
      setMembers(filtered);
      setTotal(res.total);
      setTotalPages(res.totalPages);

      if (detailMember?.id === confirmMember.id) {
        setDetailMember({
          ...detailMember,
          status: confirmStatus,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Status member gagal diubah.");
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

  if (checkingAuth || (loading && members.length === 0 && !error)) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="flex h-96 items-center justify-center">
          <LoadingState label="Memuat data member instansi..." />
        </div>
      </main>
    );
  }

  const selectedCompany =
    companies.find((c) => c.id === selectedCompanyId) ||
    (companies.length > 0 ? companies[0] : { id: selectedCompanyId, name: "SMA Negeri 1 Jakarta", code: "SMAN1-JKT" });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4">
          <BackLink href="/office/dashboard">Kembali ke Dashboard Office</BackLink>
        </div>

        {/* =================================================
            HEADER
        ================================================= */}
        <div className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Master Anggota (Members)
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Inspeksi dan kelola data anggota perpustakaan seluruh instansi.
              </p>
            </div>

            {/* ACTION & COMPANY SWITCHER */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              {/* CUSTOM COMPANY SWITCHER DROPDOWN */}
              <div className="relative" ref={companyDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCompanyDropdownOpen((prev) => !prev)}
                  aria-expanded={isCompanyDropdownOpen}
                  aria-label="Pilih instansi"
                  className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-64"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900">
                      {selectedCompany.name}
                    </p>
                  </div>
                  <ChevronDownIcon
                    className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                      isCompanyDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isCompanyDropdownOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-full min-w-[260px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg sm:w-72">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Pilih Instansi
                    </div>
                    <div className="space-y-0.5">
                      {companies.map((company) => {
                        const isSelected = company.id === selectedCompanyId;
                        return (
                          <button
                            key={company.id}
                            type="button"
                            onClick={() => {
                              setSelectedCompanyId(company.id);
                              setPage(1);
                              setIsCompanyDropdownOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                              isSelected
                                ? "bg-blue-50 font-semibold text-blue-700"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">
                                {company.name}
                              </p>
                              <p className="font-mono text-[10px] text-slate-400">
                                {company.code}
                              </p>
                            </div>
                            {isSelected && (
                              <span className="shrink-0 text-blue-600">
                                <CheckIcon />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="button"
                onClick={openCreateForm}
                className="w-full sm:w-auto"
              >
                + Tambah Member
              </Button>
            </div>
          </div>
        </div>

        {/* =================================================
            SEARCH & FILTER CARD
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
            ERROR ALERT
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
            MEMBER TABLE / LIST CARD
        ================================================= */}
        <Card>
          {/* EMPTY STATE */}
          {!loading && members.length === 0 && (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <span className="text-lg">?</span>
              </div>

              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                Member tidak ditemukan
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                Coba ubah kata pencarian atau pilih instansi yang lain.
              </p>
            </div>
          )}

          {/* DESKTOP TABLE */}
          {members.length > 0 && (
            <div className="relative hidden overflow-x-auto rounded-t-xl lg:block">
              <table className="w-full min-w-[950px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[160px]" />
                  <col className="min-w-[200px]" />
                  <col className="w-[180px]" />
                  <col className="w-[150px]" />
                  <col className="w-[120px]" />
                  <col className="w-[280px]" />
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
                        <td
                          className="truncate px-4 py-3 text-xs font-semibold text-slate-900"
                          title={member.memberNumber}
                        >
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
                          {member.identityNumber || "-"}
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

          {/* TABLET + MOBILE */}
          {members.length > 0 && (
            <div className="relative grid grid-cols-1 gap-3 bg-slate-50/60 p-3 sm:p-3 md:grid-cols-2 lg:hidden">
              {members.map((member, idx) => {
                const isActive = member.status === "ACTIVE";
                const isLastOdd = members.length % 2 !== 0 && idx === members.length - 1;

                return (
                  <div
                    key={member.id}
                    className={`rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm flex flex-col justify-between h-full ${
                      isLastOdd ? "md:col-span-2 md:w-[calc(50%-6px)] md:mx-auto" : ""
                    }`}
                  >
                    <div>
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

                            <p className="truncate text-sm font-semibold text-slate-900" title={member.name}>
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

                          <p className="mt-0.5 truncate text-xs font-medium text-slate-700" title={member.identityNumber || "-"}>
                            {member.identityNumber || "-"}
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            No. HP
                          </p>

                          <p className="mt-0.5 truncate text-xs font-medium text-slate-700" title={member.phone || "-"}>
                            {member.phone || "-"}
                          </p>
                        </div>

                        <div className="col-span-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Email
                          </p>

                          <p className="mt-0.5 truncate text-xs font-medium text-slate-700" title={member.email || "-"}>
                            {member.email || "-"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void openDetail(member)}
                        className="h-9 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>Detail</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditForm(member)}
                        className="h-9 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openStatusConfirm(member)}
                        className={`col-span-2 h-9 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition focus:outline-none focus-visible:ring-2 ${
                          isActive
                            ? "border-amber-200/80 bg-amber-50/50 text-amber-800 hover:bg-amber-100/70 hover:border-amber-300 focus-visible:ring-amber-500"
                            : "border-emerald-200/80 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100/70 hover:border-emerald-300 focus-visible:ring-emerald-500"
                        }`}
                      >
                        {isActive ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                            <span>Nonaktifkan</span>
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <span>Aktifkan</span>
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
                  aria-label="Memuat data member"
                >
                  <div className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                    Memuat data...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PAGINATION */}
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
                  Instansi: <span className="font-semibold text-slate-700">{selectedCompany.name}</span>
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
                    setFormErrors((curr) => ({ ...curr, name: "" }));
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
                  const val = event.target.value.replace(/\D/g, "").slice(0, 15);
                  setPhone(val);
                  if (formErrors.phone) {
                    setFormErrors((curr) => ({ ...curr, phone: "" }));
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
                  const val = event.target.value.replace(/\D/g, "").slice(0, 16);
                  setIdentityNumber(val);
                  if (formErrors.identityNumber) {
                    setFormErrors((curr) => ({ ...curr, identityNumber: "" }));
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
                    setFormErrors((curr) => ({ ...curr, email: "" }));
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
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Nama Lengkap
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailMember.name}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Nomor Anggota
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailMember.memberNumber}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    NIK
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailMember.identityNumber || "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Nomor HP
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {detailMember.phone}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Email
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                    {detailMember.email || "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Instansi
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {selectedCompany.name}
                  </p>
                </div>

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
              </div>
            </div>

            {/* DETAIL FOOTER */}
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const target = detailMember;
                  setDetailMember(null);
                  openEditForm(target);
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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className || "h-4 w-4"}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
