"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import OfficeNavbar from "@/components/office/OfficeNavbar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import LoadingState from "@/components/ui/LoadingState";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

import { getSession } from "@/lib/auth";
import {
  getCompaniesApi,
  createCompanyApi,
  updateCompanyApi,
  deleteCompanyApi,
} from "@/lib/api";
import type { Company, CompanyStatus } from "@/lib/types";
import { useToast } from "@/context/ToastContext";

export default function OfficeCompaniesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [userName, setUserName] = useState("Super Admin");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | "">("");

  // Modal Create & Edit
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formTimezone, setFormTimezone] = useState("Asia/Jakarta");
  const [formStatus, setFormStatus] = useState<CompanyStatus>("ACTIVE");
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({ code: "", name: "" });

  // Status Change Dialog
  const [confirmCompany, setConfirmCompany] = useState<Company | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<CompanyStatus | null>(null);
  const [statusActionLoading, setStatusActionLoading] = useState(false);

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  // 1. Guard Super Admin
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

  // 2. Fetch Companies
  const loadCompanies = async (silent: boolean = false) => {
    if (!silent && !initialLoaded) {
      setLoading(true);
    } else {
      setTableLoading(true);
    }
    setError("");
    try {
      const data = await getCompaniesApi();
      setCompanies(data);
      setInitialLoaded(true);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat daftar instansi.");
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    if (!checkingAuth) {
      loadCompanies();
    }
  }, [checkingAuth]);

  // Open Form
  const openCreateModal = () => {
    setEditingCompany(null);
    setFormCode("");
    setFormName("");
    setFormAddress("");
    setFormTimezone("Asia/Jakarta");
    setFormStatus("ACTIVE");
    setFormErrors({ code: "", name: "" });
    setShowModal(true);
  };

  const openEditModal = (comp: Company) => {
    setEditingCompany(comp);
    setFormCode(comp.code);
    setFormName(comp.name);
    setFormAddress(comp.address || "");
    setFormTimezone(comp.timezone || "Asia/Jakarta");
    setFormStatus(comp.status);
    setFormErrors({ code: "", name: "" });
    setShowModal(true);
  };

  const validateForm = () => {
    const errors = { code: "", name: "" };
    if (!formCode.trim()) errors.code = "Kode instansi wajib diisi.";
    if (!formName.trim()) errors.name = "Nama instansi wajib diisi.";
    setFormErrors(errors);
    return !errors.code && !errors.name;
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || formLoading) return;

    setFormLoading(true);
    try {
      if (editingCompany) {
        const hasChanges =
          formName.trim() !== editingCompany.name ||
          formCode.trim().toUpperCase() !== editingCompany.code ||
          formAddress.trim() !== (editingCompany.address || "") ||
          formTimezone !== (editingCompany.timezone || "Asia/Jakarta") ||
          formStatus !== editingCompany.status;

        if (!hasChanges) {
          toast.warning("Data masih sama, tidak ada perubahan yang disimpan.");
          setShowModal(false);
          return;
        }

        await updateCompanyApi(editingCompany.id, {
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          address: formAddress.trim(),
          timezone: formTimezone,
          status: formStatus,
        });
        // Optimistic update
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === editingCompany.id
              ? {
                  ...c,
                  name: formName.trim(),
                  code: formCode.trim().toUpperCase(),
                  address: formAddress.trim(),
                  timezone: formTimezone,
                  status: formStatus,
                }
              : c
          )
        );
        toast.success(`Instansi "${formName}" berhasil diperbarui.`);
      } else {
        await createCompanyApi({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          address: formAddress.trim(),
          timezone: formTimezone,
          status: formStatus,
        });
        toast.success(`Instansi baru "${formName}" berhasil didaftarkan.`);
      }
      setShowModal(false);
      await loadCompanies(true);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan data instansi.");
    } finally {
      setFormLoading(false);
    }
  };

  // Change Status Handler
  const handleChangeStatus = async () => {
    if (!confirmCompany || !confirmStatus || statusActionLoading) return;
    setStatusActionLoading(true);
    try {
      await updateCompanyApi(confirmCompany.id, { status: confirmStatus });
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === confirmCompany.id ? { ...c, status: confirmStatus } : c
        )
      );
      toast.success(
        `Status instansi "${confirmCompany.name}" diubah menjadi ${
          confirmStatus === "ACTIVE"
            ? "Aktif"
            : confirmStatus === "SUSPENDED"
            ? "Ditangguhkan"
            : "Nonaktif"
        }.`
      );
      setConfirmCompany(null);
      setConfirmStatus(null);
      await loadCompanies(true);
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengubah status instansi.");
    } finally {
      setStatusActionLoading(false);
    }
  };

  // Filtered List
  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      search.trim() === "" ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: CompanyStatus) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="success">Aktif</Badge>;
      case "SUSPENDED":
        return <Badge variant="danger">Ditangguhkan</Badge>;
      default:
        return <Badge variant="neutral">Nonaktif</Badge>;
    }
  };

  if (checkingAuth || (loading && !initialLoaded)) {
    return (
      <main className="min-h-screen bg-slate-50">
        <OfficeNavbar userName={userName} />
        <div className="flex h-96 items-center justify-center">
          <LoadingState label="Memuat data instansi & sekolah..." />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <OfficeNavbar userName={userName} />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Kelola Instansi & Perpustakaan
              </h1>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {companies.length} Instansi
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Pusat registrasi sekolah, universitas, dan cabang perpustakaan (Multi-tenant SaaS).
            </p>
          </div>

          <Button type="button" onClick={openCreateModal} className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Tambah Instansi Baru</span>
          </Button>
        </div>

        {/* STATS OVERVIEW */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs text-slate-500 font-medium">Total Instansi</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{companies.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500 font-medium">Instansi Aktif</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {companies.filter((c) => c.status === "ACTIVE").length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500 font-medium">Ditangguhkan</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {companies.filter((c) => c.status === "SUSPENDED").length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500 font-medium">Non-Aktif</p>
            <p className="mt-1 text-2xl font-bold text-slate-600">
              {companies.filter((c) => c.status === "INACTIVE").length}
            </p>
          </Card>
        </div>

        {/* SEARCH & FILTERS */}
        <Card className="mt-6 p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <Input
              id="company-search"
              label="Pencarian"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama sekolah, kode instansi, atau alamat..."
            />

            <div>
              <Dropdown
                id="status-filter"
                label="Filter Status"
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as any)}
                options={[
                  { value: "", label: "Semua Status" },
                  { value: "ACTIVE", label: "Aktif" },
                  { value: "SUSPENDED", label: "Ditangguhkan" },
                  { value: "INACTIVE", label: "Nonaktif" },
                ]}
              />
            </div>
          </div>
        </Card>

        {/* TABLE LIST */}
        <Card className="relative mt-6 overflow-hidden">
          {tableLoading && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]"
              role="status"
              aria-live="polite"
              aria-label="Memperbarui data instansi"
            >
              <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-md ring-1 ring-slate-200">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Memperbarui data...
              </div>
            </div>
          )}
          {filteredCompanies.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title={search || statusFilter ? "Instansi Tidak Ditemukan" : "Belum Ada Instansi"}
                description={
                  search || statusFilter
                    ? `Tidak ada instansi yang sesuai dengan kriteria pencarian "${search}".`
                    : "Mulai dengan mendaftarkan sekolah atau perpustakaan pertama kamu."
                }
              />
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW (>= lg) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 table-fixed">
                  <colgroup>
                    <col className="w-[260px]" />
                    <col className="w-[120px]" />
                    <col />
                    <col className="w-[140px]" />
                    <col className="w-[130px]" />
                    <col className="w-[190px]" />
                  </colgroup>
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Instansi / Sekolah</th>
                      <th className="px-5 py-3.5">Kode</th>
                      <th className="px-5 py-3.5">Alamat / Lokasi</th>
                      <th className="px-5 py-3.5">Timezone</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCompanies.map((comp) => (
                      <tr key={comp.id} className="transition hover:bg-slate-50/60">
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 font-bold text-blue-700 shadow-2xs">
                              {comp.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{comp.name}</p>
                              <p className="text-xs text-slate-400 font-mono">ID: {comp.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                            {comp.code}
                          </span>
                        </td>
                        <td className="px-5 py-4 truncate text-slate-600">
                          {comp.address || "-"}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {comp.timezone || "Asia/Jakarta"}
                        </td>
                        <td className="px-5 py-4">
                          {getStatusBadge(comp.status)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(comp)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              <span>Edit</span>
                            </button>

                            {comp.status === "ACTIVE" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmCompany(comp);
                                  setConfirmStatus("SUSPENDED");
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="10" y1="15" x2="10" y2="9" />
                                  <line x1="14" y1="15" x2="14" y2="9" />
                                </svg>
                                <span>Suspend</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmCompany(comp);
                                  setConfirmStatus("ACTIVE");
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>Aktifkan</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE & TABLET CARD VIEW (< lg) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3.5 bg-slate-50/60 lg:hidden">
                {filteredCompanies.map((comp) => (
                  <div
                    key={comp.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 font-bold text-blue-700 shadow-2xs">
                            {comp.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-sm truncate">{comp.name}</p>
                            <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                              {comp.code}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(comp.status)}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
                        <div className="flex items-start gap-1.5">
                          <span className="text-slate-400 shrink-0 font-medium">Alamat:</span>
                          <span className="truncate">{comp.address || "Belum ada alamat"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 shrink-0 font-medium">Timezone:</span>
                          <span>{comp.timezone || "Asia/Jakarta"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons footer */}
                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(comp)}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-blue-600"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Edit</span>
                      </button>

                      {comp.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmCompany(comp);
                            setConfirmStatus("SUSPENDED");
                          }}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="10" y1="15" x2="10" y2="9" />
                            <line x1="14" y1="15" x2="14" y2="9" />
                          </svg>
                          <span>Suspend</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmCompany(comp);
                            setConfirmStatus("ACTIVE");
                          }}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Aktifkan</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* MODAL CREATE / EDIT */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingCompany ? "Edit Data Instansi" : "Tambah Instansi Baru"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {editingCompany ? "Perbarui informasi perpustakaan instansi." : "Daftarkan sekolah/cabang perpustakaan baru ke sistem."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="mt-4 space-y-4">
              <div>
                <Input
                  id="form-company-name"
                  label="Nama Instansi / Sekolah"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: SMA Negeri 1 Jakarta"
                  error={formErrors.name}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="form-company-code"
                  label="Kode Instansi (Unik)"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="SMAN1-JKT"
                  error={formErrors.code}
                  required
                />

                <div>
                  <Dropdown
                    id="form-timezone"
                    label="Zona Waktu"
                    value={formTimezone}
                    onChange={(val) => setFormTimezone(val)}
                    options={[
                      { value: "Asia/Jakarta", label: "WIB (Asia/Jakarta)" },
                      { value: "Asia/Makassar", label: "WITA (Asia/Makassar)" },
                      { value: "Asia/Jayapura", label: "WIT (Asia/Jayapura)" },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="form-address" className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Lengkap
                </label>
                <textarea
                  id="form-address"
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Jl. Budi Utomo No. 7, Jakarta Pusat"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {editingCompany && (
                <div>
                  <Dropdown
                    id="form-status"
                    label="Status Operasional"
                    value={formStatus}
                    onChange={(val) => setFormStatus(val as any)}
                    options={[
                      { value: "ACTIVE", label: "Aktif (Dapat Bertransaksi)" },
                      { value: "SUSPENDED", label: "Ditangguhkan / Suspended" },
                      { value: "INACTIVE", label: "Nonaktif" },
                    ]}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                  disabled={formLoading}
                >
                  Batal
                </Button>
                <Button type="submit" loading={formLoading}>
                  {editingCompany ? "Simpan Perubahan" : "Daftarkan Instansi"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG */}
      <ConfirmationDialog
        open={Boolean(confirmCompany && confirmStatus)}
        title={`Ubah Status Instansi: ${confirmCompany?.name || ""}`}
        description={`Apakah Anda yakin ingin mengubah status instansi ini menjadi "${
          confirmStatus === "ACTIVE"
            ? "Aktif"
            : confirmStatus === "SUSPENDED"
            ? "Ditangguhkan"
            : "Nonaktif"
        }"?`}
        confirmLabel="Ya, Ubah Status"
        loading={statusActionLoading}
        onConfirm={handleChangeStatus}
        onClose={() => {
          setConfirmCompany(null);
          setConfirmStatus(null);
        }}
      />
    </main>
  );
}
