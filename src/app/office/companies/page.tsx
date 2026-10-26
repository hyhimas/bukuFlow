"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import LoadingState from "@/components/ui/LoadingState";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import RowActions from "@/components/ui/RowActions";
import Pagination from "@/components/ui/Pagination";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import Skeleton from "@/components/ui/Skeleton";
import { useSearchHotkey, useSubmitHotkey } from "@/hooks/useHotkeys";

import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import {
  getCompaniesApi,
  createCompanyApi,
  updateCompanyApi,
  getOfficeCompanyConfigApi,
  updateOfficeCompanyConfigApi,
  getErrorMessage,
} from "@/lib/api";
import type { Company, CompanyStatus } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export default function OfficeCompaniesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [isAuthorized] = useState(() => {
    if (typeof window === "undefined") return false;
    const session = getSession();
    return Boolean(session && session.user.role === "SUPER_ADMIN");
  });

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search, Filter & Pagination (Client-side for unpaginated GET /office/company)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal Create & Edit
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState<CompanyStatus>("ACTIVE");
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({ code: "", name: "" });

  // Policy Config Modal (GET/PUT /office/company/config?company_id=)
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configCompany, setConfigCompany] = useState<Company | null>(null);
  const [configDuration, setConfigDuration] = useState<number | string>("");
  const [configMaxLoans, setConfigMaxLoans] = useState<number | string>("");
  const [configLateFee, setConfigLateFee] = useState<number | string>("");
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // Status Change Dialog
  const [confirmCompany, setConfirmCompany] = useState<Company | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<CompanyStatus | null>(null);
  const [statusActionLoading, setStatusActionLoading] = useState(false);

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchHotkey(searchInputRef, {
    enabled: !error && !loading,
  });

  // 1. Guard Super Admin
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
      return;
    }
  }, [router]);

  // 2. Fetch Companies
  const loadCompanies = useCallback(
    async (silent = false) => {
      await Promise.resolve();
      if (silent) {
        setTableLoading(true);
      }
      setError("");
      try {
        const data = await getCompaniesApi();
        setCompanies(data);
        setInitialLoaded(true);
      } catch (err: unknown) {
        const msg = getErrorMessage(err, "Gagal memuat daftar instansi.");
        setError(msg);
      } finally {
        setLoading(false);
        setTableLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!isAuthorized) return;
    const timer = setTimeout(() => {
      void loadCompanies();
    }, 0);
    return () => clearTimeout(timer);
  }, [isAuthorized, loadCompanies]);

  // Open Form
  const openCreateModal = () => {
    setEditingCompany(null);
    setFormCode("");
    setFormName("");
    setFormStatus("ACTIVE");
    setFormErrors({ code: "", name: "" });
    setShowModal(true);
  };

  const openEditModal = (comp: Company) => {
    setEditingCompany(comp);
    const safeCode =
      comp.code && comp.code !== "-" && comp.code !== comp.id
        ? comp.code
        : comp.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "INST";
    setFormCode(safeCode);
    setFormName(comp.name);
    setFormStatus(comp.status);
    setFormErrors({ code: "", name: "" });
    setShowModal(true);
  };

  // Open Config Modal
  const openConfigModal = async (comp: Company) => {
    setConfigCompany(comp);
    setConfigDuration("");
    setConfigMaxLoans("");
    setConfigLateFee("");
    setConfigLoading(true);
    setConfigModalOpen(true);
    try {
      const cfg = await getOfficeCompanyConfigApi(comp.id);
      if (cfg) {
        setConfigDuration(cfg.default_loan_duration);
        setConfigMaxLoans(cfg.max_active_loans);
        setConfigLateFee(cfg.late_fee_per_day);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal memuat konfigurasi peminjaman instansi."));
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!configCompany || configSaving) return;
    setConfigSaving(true);
    try {
      await updateOfficeCompanyConfigApi(configCompany.id, {
        default_loan_duration: Number(configDuration),
        max_active_loans: Number(configMaxLoans),
        late_fee_per_day: Number(configLateFee),
      });
      toast.success(`Konfigurasi kebijakan instansi "${configCompany.name}" berhasil disimpan.`);
      setConfigModalOpen(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal menyimpan konfigurasi kebijakan."));
    } finally {
      setConfigSaving(false);
    }
  };

  const validateForm = () => {
    const errors = { code: "", name: "" };
    if (!formCode.trim()) errors.code = "Kode / inisial instansi wajib diisi.";
    if (!formName.trim()) errors.name = "Nama instansi wajib diisi.";
    setFormErrors(errors);
    return !errors.code && !errors.name;
  };

  const handleSaveCompany = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateForm() || formLoading) return;

    setFormLoading(true);
    try {
      if (editingCompany) {
        await updateCompanyApi(editingCompany.id, {
          name: formName.trim(),
          initial: formCode.trim().toLowerCase(),
          isActive: formStatus === "ACTIVE",
        });

        setCompanies((prev) =>
          prev.map((c) =>
            c.id === editingCompany.id
              ? {
                  ...c,
                  name: formName.trim(),
                  code: formCode.trim().toUpperCase(),
                  status: formStatus,
                }
              : c
          )
        );
        toast.success(`Instansi "${formName}" berhasil diperbarui.`);
      } else {
        const newCompany = await createCompanyApi({
          name: formName.trim(),
          initial: formCode.trim().toLowerCase(),
          isActive: formStatus === "ACTIVE",
          status: formStatus,
        });

        setCompanies((prev) => [newCompany, ...prev]);
        toast.success(`Instansi "${formName}" berhasil ditambahkan.`);
      }

      setShowModal(false);
      await loadCompanies(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal menyimpan data instansi."));
    } finally {
      setFormLoading(false);
    }
  };

  useSubmitHotkey(() => void handleSaveCompany(), {
    enabled: showModal,
    loading: formLoading,
  });
  useSubmitHotkey(() => void handleSaveConfig(), {
    enabled: configModalOpen,
    loading: configSaving,
  });

  // Change Status Handler (Nonaktifkan via isActive)
  const handleChangeStatus = async () => {
    if (!confirmCompany || !confirmStatus || statusActionLoading) return;
    setStatusActionLoading(true);
    try {
      const initialCode =
        confirmCompany.code &&
        confirmCompany.code !== "-" &&
        confirmCompany.code !== confirmCompany.id
          ? confirmCompany.code.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "inst"
          : confirmCompany.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toLowerCase() || "inst";

      await updateCompanyApi(confirmCompany.id, {
        name: confirmCompany.name,
        initial: initialCode,
        isActive: confirmStatus === "ACTIVE",
      });
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === confirmCompany.id ? { ...c, status: confirmStatus } : c
        )
      );
      toast.success(
        `Status instansi "${confirmCompany.name}" berhasil diubah menjadi ${
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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal mengubah status instansi."));
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

  // Client-side pagination calculation
  const totalItems = filteredCompanies.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedCompanies = filteredCompanies.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

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

  const columns = useMemo<DataTableColumn<Company>[]>(
    () => [
      {
        key: "name",
        header: "Instansi / Sekolah",
        render: (comp) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 font-bold text-blue-700 shadow-2xs">
              {comp.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 truncate">{comp.name}</p>
              <p className="text-xs text-slate-500 font-mono">ID: {comp.id}</p>
            </div>
          </div>
        ),
      },
      {
        key: "code",
        header: "Kode / Inisial",
        width: "180px",
        render: (comp) => (
          <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            {comp.code}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "160px",
        render: (comp) => getStatusBadge(comp.status),
      },
      {
        key: "actions",
        header: "Aksi",
        width: "110px",
        align: "right",
        render: (comp) => (
          <RowActions
            actions={[
              {
                label: "Kebijakan",
                onClick: () => openConfigModal(comp),
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                ),
              },
              {
                label: "Edit",
                onClick: () => openEditModal(comp),
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                ),
              },
              {
                label: comp.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan",
                onClick: () => {
                  setConfirmCompany(comp);
                  setConfirmStatus(comp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
                },
                tone: (comp.status === "ACTIVE" ? "destructive" : "success") as "destructive" | "success",
                icon: comp.status === "ACTIVE" ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="10" y1="15" x2="10" y2="9" />
                    <line x1="14" y1="15" x2="14" y2="9" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex h-96 items-center justify-center">
          <LoadingState label="Memeriksa otorisasi Super Admin..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}
        <PageHeader
          className="mb-6"
          title="Kelola Instansi & Perpustakaan"
          description="Pusat registrasi sekolah, universitas, dan cabang perpustakaan."
          backLink="/office/dashboard"
          badge={
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 tabular-nums">
              {companies.length} Instansi
            </span>
          }
          actions={
            <Button
              type="button"
              onClick={openCreateModal}
              disabled={Boolean(error) || loading}
              className="w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Tambah Instansi</span>
            </Button>
          }
        />

        {error ? (
          <ErrorState
            title="Gagal Memuat Daftar Instansi"
            message={error}
            onRetry={() => void loadCompanies()}
            className="mt-4"
          />
        ) : (
          <>
            {/* STATS OVERVIEW */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs text-slate-500 font-medium">Total Instansi</p>
            {!initialLoaded ? (
              <Skeleton className="mt-2 h-7 w-12" />
            ) : (
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{companies.length}</p>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500 font-medium">Instansi Aktif</p>
            {!initialLoaded ? (
              <Skeleton className="mt-2 h-7 w-12" />
            ) : (
              <p className="mt-1 text-2xl font-bold text-emerald-600 tabular-nums">
                {companies.filter((c) => c.status === "ACTIVE").length}
              </p>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500 font-medium">Ditangguhkan</p>
            {!initialLoaded ? (
              <Skeleton className="mt-2 h-7 w-12" />
            ) : (
              <p className="mt-1 text-2xl font-bold text-red-600 tabular-nums">
                {companies.filter((c) => c.status === "SUSPENDED").length}
              </p>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500 font-medium">Non-Aktif</p>
            {!initialLoaded ? (
              <Skeleton className="mt-2 h-7 w-12" />
            ) : (
              <p className="mt-1 text-2xl font-bold text-slate-600 tabular-nums">
                {companies.filter((c) => c.status === "INACTIVE").length}
              </p>
            )}
          </Card>
        </div>

        {/* SEARCH & FILTERS */}
        <Card className="mt-6 p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <Input
              ref={searchInputRef}
              id="company-search"
              label="Pencarian"
              value={search}
              disabled={Boolean(error) || loading}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama sekolah atau kode instansi... (tekan /)"
            />

            <div>
              <Dropdown
                id="status-filter"
                label="Filter Status"
                value={statusFilter}
                disabled={Boolean(error) || loading}
                onChange={(val) => {
                  setStatusFilter(val as CompanyStatus | "");
                  setPage(1);
                }}
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
          <DataTable
            rows={paginatedCompanies}
            columns={columns}
            keyExtractor={(comp) => comp.id}
            loading={tableLoading}
            loadingMessage="Memperbarui data..."
            mobileBreakpoint="xl"
            cardGridClassName="bg-slate-50/60 p-3.5"
            className="border-0 shadow-none rounded-none"
            emptyState={
              <div className="p-8">
                <EmptyState
                  title={search || statusFilter ? "Instansi Tidak Ditemukan" : "Belum Ada Instansi"}
                  description={
                    search || statusFilter
                      ? `Tidak ada instansi yang sesuai dengan kriteria pencarian "${search}".`
                      : "Mulai dengan mendaftarkan sekolah atau perpustakaan pertama Anda."
                  }
                />
              </div>
            }
            renderMobileCard={(comp) => (
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
                        <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                          {comp.code}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {getStatusBadge(comp.status)}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">ID Instansi:</span>
                      <span className="font-mono text-xs text-slate-600 truncate">{comp.id}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons footer */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs font-medium text-slate-500">Pilihan Aksi</span>
                  <RowActions
                    actions={[
                      {
                        label: "Kebijakan",
                        onClick: () => openConfigModal(comp),
                        icon: (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                        ),
                      },
                      {
                        label: "Edit",
                        onClick: () => openEditModal(comp),
                        icon: (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        ),
                      },
                      {
                        label: comp.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan",
                        onClick: () => {
                          setConfirmCompany(comp);
                          setConfirmStatus(comp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
                        },
                        tone: (comp.status === "ACTIVE" ? "destructive" : "success") as "destructive" | "success",
                        icon: comp.status === "ACTIVE" ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="10" y1="15" x2="10" y2="9" />
                            <line x1="14" y1="15" x2="14" y2="9" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ),
                      },
                    ]}
                  />
                </div>
              </div>
            )}
          />

          {/* PAGINATION */}
          {filteredCompanies.length > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              pageSizeOptions={[10, 20, 50]}
            />
          )}
        </Card>
        </>
      )}
      </div>

      {/* MODAL CREATE / EDIT */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        raw
        size="lg"
        overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        {showModal && (
          <>
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingCompany ? "Edit Data Instansi" : "Tambah Instansi Baru"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {editingCompany ? "Perbarui informasi instansi via PUT /office/company/{id}." : "Pendaftaran instansi baru ke platform."}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Tutup modal"
                onClick={() => setShowModal(false)}
                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></Button>
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

              <div>
                <Input
                  id="form-company-code"
                  label="Inisial / Kode Instansi"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="SMAN1-JKT"
                  error={formErrors.code}
                  required
                />
              </div>

              <div>
                <Dropdown
                  id="form-status"
                  label="Status Operasional"
                  value={formStatus}
                  onChange={(val) => setFormStatus(val as CompanyStatus)}
                  options={[
                    { value: "ACTIVE", label: "Aktif (Dapat Bertransaksi)" },
                    { value: "INACTIVE", label: "Nonaktif" },
                  ]}
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                  disabled={formLoading}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  loading={formLoading}
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                >
                  {editingCompany ? "Simpan Perubahan" : "Tambah Instansi"}
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* POLICY CONFIG MODAL (GET/PUT /office/company/config?company_id=) */}
      <Modal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        raw
        size="lg"
        overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        {configModalOpen && configCompany && (
          <>
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Konfigurasi Kebijakan: {configCompany.name}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  PUT /office/company/config?company_id={configCompany.id}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Tutup modal"
                onClick={() => setConfigModalOpen(false)}
                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></Button>
            </div>

            {configLoading ? (
              <div className="py-8">
                <LoadingState nested={true} label="Memuat konfigurasi peminjaman..." />
              </div>
            ) : (
              <form onSubmit={handleSaveConfig} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="config-duration" className="block text-xs font-semibold text-slate-700 mb-1">
                    Durasi Peminjaman Default (Hari) *
                  </label>
                  <input
                    id="config-duration"
                    type="number"
                    min="1"
                    required
                    value={configDuration}
                    onChange={(e) => setConfigDuration(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Batas hari peminjaman standar untuk setiap buku.
                  </p>
                </div>

                <div>
                  <label htmlFor="config-max-loans" className="block text-xs font-semibold text-slate-700 mb-1">
                    Maksimal Transaksi Aktif per Anggota *
                  </label>
                  <input
                    id="config-max-loans"
                    type="number"
                    min="1"
                    required
                    value={configMaxLoans}
                    onChange={(e) => setConfigMaxLoans(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Jumlah transaksi peminjaman aktif yang boleh dilakukan seorang anggota dalam satu waktu.
                  </p>
                </div>

                <div>
                  <label htmlFor="config-late-fee" className="block text-xs font-semibold text-slate-700 mb-1">
                    Denda Keterlambatan per Hari (Rp) *
                  </label>
                  <input
                    id="config-late-fee"
                    type="number"
                    min="0"
                    required
                    value={configLateFee}
                    onChange={(e) => setConfigLateFee(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Nominal denda keterlambatan per buku per hari (dalam Rupiah).
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfigModalOpen(false)}
                    disabled={configSaving}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    loading={configSaving}
                    aria-keyshortcuts="Control+Enter Meta+Enter"
                  >
                    Simpan Konfigurasi
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </Modal>

      {/* CONFIRMATION DIALOG */}
      <ConfirmationDialog
        open={Boolean(confirmCompany && confirmStatus)}
        title={`Ubah Status Instansi: ${confirmCompany?.name || ""}`}
        description={`Apakah Anda yakin ingin mengubah status instansi ini menjadi "${
          confirmStatus === "ACTIVE"
            ? "Aktif"
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
    </div>
  );
}
