"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import BackLink from "@/components/ui/BackLink";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import Skeleton, { TableSkeleton } from "@/components/ui/Skeleton";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/components/ui/Pagination";
import RowActions from "@/components/ui/RowActions";
import ErrorState from "@/components/ui/ErrorState";
import InactiveCompanyState, {
  isCompanyInactiveError,
  isStoredCompanyInactive,
} from "@/components/office/InactiveCompanyState";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import { useSearchHotkey, useSubmitHotkey } from "@/hooks/useHotkeys";
import CompanySwitcher, {
  getStoredOfficeCompanyId,
  setStoredOfficeCompanyId,
} from "@/components/office/CompanySwitcher";

import { getSession, isStoredSessionExpired, hasStoredAuth } from "@/lib/auth";
import { canAccessUserManagement } from "@/lib/authorization";
import {
  getCompanyUsersApi,
  createCompanyUserApi,
  updateCompanyUserApi,
  getOfficeUsersApi,
  createOfficeUserApi,
  updateOfficeUserApi,
  getCompaniesApi,
  getErrorMessage,
  getFieldErrors,
} from "@/lib/api";
import type { UserRole, UserStatus } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export interface UserManagementViewProps {
  scope: "office" | "company";
}

export interface UserItem {
  id: string;
  companyId: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  is_active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function getRoleLabel(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "COMPANY_ADMIN":
      return "Admin Instansi";
    case "STAFF":
      return "Staf";
    default:
      return role;
  }
}

function getRoleBadgeVariant(role: UserRole): "warning" | "info" | "neutral" {
  switch (role) {
    case "SUPER_ADMIN":
      return "warning";
    case "COMPANY_ADMIN":
      return "info";
    case "STAFF":
    default:
      return "neutral";
  }
}

function formatDate(value?: string): string {
  if (!value) return "-";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return value;
  }
}

function CompanyEmptyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-7 w-7 text-blue-600"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}

export default function UserManagementView({ scope }: UserManagementViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  const isOffice = scope === "office";

  // Auth & Current User
  const [isAuthorized] = useState(() => {
    if (typeof window === "undefined") return false;
    const session = getSession();
    if (!session) return false;
    if (isOffice) return session.user.role === "SUPER_ADMIN";
    return canAccessUserManagement(session.user.role);
  });

  const session = typeof window !== "undefined" ? getSession() : null;
  const currentUserId = session?.user?.id || "";
  const currentUserEmail = session?.user?.email || "";

  // Selected company (office scope)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() =>
    isOffice ? getStoredOfficeCompanyId() : ""
  );
  const [companyName, setCompanyName] = useState<string>("");
  const [companyStatus, setCompanyStatus] = useState<string>("");

  // Sync company name & status for Office Super Admin
  useEffect(() => {
    if (!isOffice || !selectedCompanyId) return;
    let isMounted = true;
    getCompaniesApi()
      .then((comps) => {
        if (!isMounted) return;
        const match = comps.find((c) => c.id === selectedCompanyId);
        if (match?.name) {
          setCompanyName(match.name);
        }
        if (match?.status) {
          setCompanyStatus(match.status);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isOffice, selectedCompanyId]);

  // Users & Loading state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState("");

  const isInactiveCompany =
    isOffice &&
    (companyStatus === "INACTIVE" ||
      companyStatus === "SUSPENDED" ||
      isStoredCompanyInactive(selectedCompanyId) ||
      isCompanyInactiveError(error));

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const savedTotalRef = useRef(0);

  // Modal State - Create & Edit
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("STAFF");
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({ name: "", email: "", password: "" });

  // Confirmation Dialog (Status Toggle)
  const [confirmUser, setConfirmUser] = useState<UserItem | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Confirmation Dialog (Discard Form Changes)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Fitur pencarian & filter role disembunyikan sementara sampai didukung oleh endpoint BE
  const SHOW_SEARCH_FILTER = false;

  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchHotkey(searchInputRef, {
    enabled: SHOW_SEARCH_FILTER && !(isOffice && !selectedCompanyId) && !error && !loading,
  });
  useSubmitHotkey(() => void handleSubmit(), {
    enabled: showModal,
    loading: formLoading,
  });

  // 1. Guard Authentication
  useEffect(() => {
    const s = getSession();
    if (!s) {
      if (!isStoredSessionExpired() && !hasStoredAuth()) {
        router.replace("/login");
      }
      return;
    }

    if (isOffice) {
      if (s.user.role !== "SUPER_ADMIN") {
        router.replace("/dashboard");
        return;
      }
    } else {
      if (!canAccessUserManagement(s.user.role)) {
        router.replace(s.user.role === "SUPER_ADMIN" ? "/office/dashboard" : "/dashboard");
        return;
      }
    }
  }, [router, isOffice]);

  // 2. Load Users
  const loadUsers = useCallback(
    async (isBackground = false) => {
      if (!isAuthorized) return;
      if (isOffice && !selectedCompanyId) {
        setUsers([]);
        setLoading(false);
        setTableLoading(false);
        return;
      }

      if (isBackground) {
        setTableLoading(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        if (isOffice) {
          const res = await getOfficeUsersApi(selectedCompanyId, {
            page,
            size: pageSize,
            search: search.trim() || undefined,
            role: roleFilter !== "ALL" ? roleFilter : undefined,
            sortby: "created_at",
            order: "desc",
          });

          const mapped: UserItem[] = res.items.map((u) => ({
            id: u.id,
            companyId: u.companyId,
            name: u.name,
            email: u.email,
            username: u.username,
            role: u.role,
            status: u.status,
            is_active: u.is_active,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
          }));

          // Akun SUPER_ADMIN adalah pengelola sistem/platform global, bukan staf perpustakaan suatu instansi.
          // Filter agar akun Super Admin tidak tercampur di daftar pegawai/staf lokal instansi,
          // sehingga tidak bisa diubah rolenya atau dinonaktifkan di level instansi.
          const companyUsers = mapped.filter((u) => u.role !== "SUPER_ADMIN");
          const diff = mapped.length - companyUsers.length;
          setUsers(companyUsers);
          if (res.total !== -1) {
            const adjustedTotal = Math.max(0, res.total - diff);
            savedTotalRef.current = adjustedTotal;
            setTotal(adjustedTotal);
            setTotalPages(Math.max(1, Math.ceil(adjustedTotal / pageSize)));
          } else {
            setTotal(savedTotalRef.current);
            setTotalPages(Math.max(1, Math.ceil(savedTotalRef.current / pageSize)));
          }
        } else {
          const res = await getCompanyUsersApi({
            page,
            size: pageSize,
            search: search.trim() || undefined,
            role: roleFilter,
          });

          const mapped: UserItem[] = res.items.map((u) => ({
            id: u.id,
            companyId: u.companyId,
            name: u.name,
            email: u.email || "",
            username: u.username,
            role: u.role,
            status: u.status,
            is_active: u.is_active,
            createdAt: u.createdAt,
          }));

          const companyUsers = mapped.filter((u) => u.role !== "SUPER_ADMIN");
          const diff = mapped.length - companyUsers.length;
          const adjustedTotal = Math.max(0, res.total - diff);
          setUsers(companyUsers);
          setTotal(adjustedTotal);
          setTotalPages(Math.max(1, Math.ceil(adjustedTotal / pageSize)));
        }
      } catch (err: unknown) {
        const msg = getErrorMessage(err, "Gagal memuat daftar pengguna.");
        setError(msg);
      } finally {
        setLoading(false);
        setTableLoading(false);
      }
    },
    [
      isAuthorized,
      isOffice,
      selectedCompanyId,
      page,
      pageSize,
      search,
      roleFilter,
      toast,
    ]
  );

  // Trigger load with debounce
  useEffect(() => {
    if (!isAuthorized) return;
    if (isOffice && !selectedCompanyId) return;

    const timer = setTimeout(() => {
      void loadUsers(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [
    isAuthorized,
    isOffice,
    selectedCompanyId,
    page,
    pageSize,
    search,
    roleFilter,
    loadUsers,
  ]);

  // Form Handlers
  function openCreateModal() {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("STAFF");
    setFormErrors({ name: "", email: "", password: "" });
    setShowModal(true);
  }

  function openEditModal(user: UserItem) {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword("");
    setFormRole(user.role);
    setFormErrors({ name: "", email: "", password: "" });
    setShowModal(true);
  }

  function isUserFormDirty(): boolean {
    if (editingUser) {
      const origRole = editingUser.role;
      return (
        formName.trim() !== (editingUser.name || "").trim() ||
        formRole !== origRole
      );
    }
    return (
      formName.trim() !== "" ||
      formEmail.trim() !== "" ||
      formPassword.trim() !== "" ||
      formRole !== "STAFF"
    );
  }

  function handleRequestCloseModal() {
    if (formLoading) return;
    if (isUserFormDirty()) {
      setShowDiscardConfirm(true);
      return;
    }
    closeModal();
  }

  function closeModal() {
    if (formLoading) return;
    setShowDiscardConfirm(false);
    setShowModal(false);
    setEditingUser(null);
    setFormErrors({ name: "", email: "", password: "" });
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();

    const cleanName = formName.trim();
    const cleanEmail = formEmail.trim();
    const cleanPassword = formPassword.trim();

    const errors = { name: "", email: "", password: "" };

    if (!cleanName) {
      errors.name = "Nama lengkap wajib diisi.";
    }
    if (!cleanEmail) {
      errors.email = "Email wajib diisi.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = "Format email tidak valid.";
    } else {
      // Cek apakah email sudah terdaftar di daftar pengguna (Client-side duplicate check)
      const isDuplicate = users.some(
        (u) =>
          u.email?.toLowerCase() === cleanEmail.toLowerCase() &&
          (!editingUser || u.id !== editingUser.id)
      );
      if (isDuplicate) {
        errors.email = "Email ini sudah digunakan oleh pengguna lain. Silakan gunakan email lain.";
      }
    }

    if (!editingUser) {
      if (!cleanPassword) {
        errors.password = "Password wajib diisi.";
      } else if (cleanPassword.length < 8) {
        errors.password = "Password minimal 8 karakter sesuai spesifikasi server.";
      }
    }

    if (errors.name || errors.email || errors.password) {
      setFormErrors(errors);
      return;
    }

    setFormLoading(true);
    setFormErrors({ name: "", email: "", password: "" });

    try {
      if (editingUser) {
        const isSuperAdminUser = editingUser.role === "SUPER_ADMIN";
        const rolePayload =
          !isSuperAdminUser && (formRole === "COMPANY_ADMIN" || formRole === "STAFF")
            ? formRole
            : undefined;

        if (isOffice) {
          await updateOfficeUserApi(selectedCompanyId, editingUser.id, {
            name: cleanName,
            ...(rolePayload ? { role: rolePayload } : {}),
          });
        } else {
          await updateCompanyUserApi(editingUser.id, {
            name: cleanName,
            ...(rolePayload ? { role: rolePayload } : {}),
          });
        }
        toast.success("Data pengguna berhasil diperbarui.");
      } else {
        const newRole: "COMPANY_ADMIN" | "STAFF" =
          formRole === "COMPANY_ADMIN" ? "COMPANY_ADMIN" : "STAFF";

        if (isOffice) {
          await createOfficeUserApi(selectedCompanyId, {
            name: cleanName,
            email: cleanEmail,
            password: cleanPassword,
            role: newRole,
          });
        } else {
          await createCompanyUserApi({
            name: cleanName,
            email: cleanEmail,
            password: cleanPassword,
            role: newRole,
          });
        }
        toast.success("Pengguna baru berhasil ditambahkan.");
      }

      closeModal();
      void loadUsers(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Gagal menyimpan data pengguna.");
      const fieldErrs = getFieldErrors(err);

      if (Object.keys(fieldErrs).length > 0) {
        if (fieldErrs.email) setFormErrors((prev) => ({ ...prev, email: fieldErrs.email }));
        if (fieldErrs.password) setFormErrors((prev) => ({ ...prev, password: fieldErrs.password }));
        if (fieldErrs.name) setFormErrors((prev) => ({ ...prev, name: fieldErrs.name }));
        if (fieldErrs.role) setFormErrors((prev) => ({ ...prev, role: fieldErrs.role }));
      } else {
        const lower = msg.toLowerCase();
        if (
          lower.includes("email") ||
          lower.includes("terdaftar") ||
          lower.includes("already registered") ||
          lower.includes("already exists") ||
          lower.includes("duplicate") ||
          lower.includes("sudah ada") ||
          lower.includes("sudah digunakan")
        ) {
          setFormErrors((prev) => ({
            ...prev,
            email: "Email sudah terdaftar di sistem. Silakan gunakan email lain.",
          }));
        } else if (lower.includes("password") || lower.includes("karakter")) {
          setFormErrors((prev) => ({ ...prev, password: msg }));
        } else {
          setFormErrors((prev) => ({ ...prev, name: msg }));
        }
      }
      toast.error(msg);
    } finally {
      setFormLoading(false);
    }
  }

  // Status Change Handlers
  async function handleConfirmToggleStatus() {
    if (!confirmUser) return;

    const nextActive = !confirmUser.is_active;
    setStatusLoading(true);

    try {
      if (isOffice) {
        await updateOfficeUserApi(selectedCompanyId, confirmUser.id, {
          is_active: nextActive,
        });
      } else {
        await updateCompanyUserApi(confirmUser.id, {
          is_active: nextActive,
        });
      }

      toast.success(
        nextActive
          ? `Akun ${confirmUser.name} berhasil diaktifkan.`
          : `Akun ${confirmUser.name} berhasil dinonaktifkan.`
      );
      setConfirmUser(null);
      void loadUsers(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Gagal mengubah status pengguna.");
      toast.error(msg);
    } finally {
      setStatusLoading(false);
    }
  }

  const getUserActions = useCallback(
    (user: UserItem) => {
      const isSuperAdminUser = user.role === "SUPER_ADMIN";
      const isSelf =
        (currentUserId && user.id === currentUserId) ||
        (currentUserEmail &&
          user.email?.toLowerCase() === currentUserEmail.toLowerCase());
      const isActive = user.is_active ?? (user.status === "ACTIVE");

      return [
        {
          label: "Edit",
          onClick: () => openEditModal(user),
        },
        ...(!isSelf && !isSuperAdminUser
          ? [
              {
                label: isActive ? "Nonaktifkan" : "Aktifkan",
                onClick: () => setConfirmUser(user),
                tone: (isActive ? "destructive" : "default") as
                  | "destructive"
                  | "default",
              },
            ]
          : []),
      ];
    },
    [currentUserId, currentUserEmail]
  );

  const columns = useMemo<DataTableColumn<UserItem>[]>(
    () => [
      {
        key: "name",
        header: "Nama Lengkap",
        render: (user) => {
          const isSelf =
            (currentUserId && user.id === currentUserId) ||
            (currentUserEmail &&
              user.email?.toLowerCase() === currentUserEmail.toLowerCase());
          const isActive = user.is_active ?? (user.status === "ACTIVE");

          return (
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isActive
                    ? "bg-blue-100 text-blue-700"
                    : "bg-surface-muted text-text-muted"
                }`}
              >
                {(user.name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold text-text-main">
                    {user.name}
                  </p>
                  {isSelf && (
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200/60">
                      Anda
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: "email",
        header: "Email (Identitas Login)",
        render: (user) => (
          <span className="font-mono text-xs text-text-secondary">
            {user.email || "-"}
          </span>
        ),
      },
      {
        key: "role",
        header: "Role",
        width: "150px",
        render: (user) => (
          <Badge variant={getRoleBadgeVariant(user.role)}>
            {getRoleLabel(user.role)}
          </Badge>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "110px",
        render: (user) => {
          const isActive = user.is_active ?? (user.status === "ACTIVE");
          return (
            <Badge variant={isActive ? "success" : "neutral"}>
              {isActive ? "Aktif" : "Nonaktif"}
            </Badge>
          );
        },
      },
      {
        key: "actions",
        header: "Aksi",
        width: "80px",
        align: "right",
        render: (user) => (
          <RowActions actions={getUserActions(user)} />
        ),
      },
    ],
    [currentUserId, currentUserEmail, getUserActions]
  );

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-surface-subtle" role="status" aria-label="Memeriksa otorisasi pengguna...">
        <div className="page-container py-6 space-y-4">
          <Skeleton className="h-4 w-44 rounded" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 mb-5">
            <div className="space-y-2">
              <Skeleton className="h-8 w-56 rounded-lg" />
              <Skeleton className="h-4 w-96 max-w-full rounded" />
            </div>
            <Skeleton className="h-9 w-36 rounded-lg" />
          </div>
          <Card className="overflow-hidden">
            <TableSkeleton rows={5} cols={5} />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="page-container py-6">
        <BackLink href={isOffice ? "/office/dashboard" : "/dashboard"}>
          {isOffice ? "Kembali ke Office Dashboard" : "Kembali ke Dashboard"}
        </BackLink>

        <div className="mt-4">
          <PageHeader
            className="mb-5 sm:mb-6"
            title={isOffice ? "Kelola Pengguna" : "Pengaturan Pengguna"}
            description={
              isOffice
                ? "Kelola akun pengguna, hak akses, dan status keaktifan per instansi."
                : "Kelola akun staf dan administrator yang memiliki akses ke sistem perpustakaan."
            }
            actions={
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
                {isOffice && (
                  <CompanySwitcher
                    size="sm"
                    selectedCompanyId={selectedCompanyId}
                    onSelectCompany={(id) => {
                      savedTotalRef.current = 0;
                      setStoredOfficeCompanyId(id);
                      setSelectedCompanyId(id);
                      setPage(1);
                    }}
                  />
                )}

                <Button
                  type="button"
                  variant="primary"
                  onClick={openCreateModal}
                  disabled={(isOffice && !selectedCompanyId) || isInactiveCompany || Boolean(error) || loading}
                  className="w-full sm:w-auto text-xs h-9 px-3.5 font-semibold text-center whitespace-nowrap"
                >
                  + Tambah Pengguna
                </Button>
              </div>
            }
          />
        </div>

        {/* PROMPT JIKA BELUM PILIH INSTANSI (OFFICE SCOPE) */}
        {isOffice && !selectedCompanyId ? (
          <Card className="mt-6 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
              <CompanyEmptyIcon />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-text-main">
              Pilih Instansi Terlebih Dahulu
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
              Sebelum memuat data pengguna, silakan pilih salah satu instansi melalui pemilih instansi di atas.
            </p>
          </Card>
        ) : (
          <>
            {/* FILTER & PENCARIAN (Disembunyikan sementara sampai didukung endpoint BE) */}
            {SHOW_SEARCH_FILTER && (
              <Card className="mt-6 p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
                  <div>
                    <Input
                      ref={searchInputRef}
                      id="user-search"
                      label="Cari Pengguna"
                      type="text"
                      value={search}
                      disabled={(isOffice && !selectedCompanyId) || Boolean(error) || loading}
                      onChange={(e) => {
                        savedTotalRef.current = 0;
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Cari berdasarkan nama atau email login... (tekan /)"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="user-role-filter"
                      className="block text-sm font-medium text-text-secondary mb-1.5"
                    >
                      Role Pengguna
                    </label>
                    <Dropdown
                      id="user-role-filter"
                      value={roleFilter}
                      disabled={(isOffice && !selectedCompanyId) || Boolean(error) || loading}
                      onChange={(val) => {
                        savedTotalRef.current = 0;
                        setRoleFilter(val);
                        setPage(1);
                      }}
                      ariaLabel="Filter role pengguna"
                      options={[
                        { value: "ALL", label: "Semua Role" },
                        { value: "COMPANY_ADMIN", label: "Admin Instansi" },
                        { value: "STAFF", label: "Staf" },
                      ]}
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* ERROR ALERT vs TABLE / LIST */}
            {isInactiveCompany ? (
              <InactiveCompanyState
                companyName={companyName}
                description="Pengelolaan akun pengguna dan staf ditangguhkan karena instansi ini sedang dalam status nonaktif."
                className="mt-4"
              />
            ) : error ? (
              <ErrorState
                title="Gagal Memuat Data Pengguna"
                message={error}
                onRetry={() => void loadUsers(false)}
                className="mt-4"
              />
            ) : (
              <Card className="mt-5 overflow-hidden">
                <DataTable
                  rows={users}
                  columns={columns}
                  keyExtractor={(u) => u.id}
                  loading={loading || tableLoading}
                  loadingMessage="Memperbarui data pengguna..."
                  mobileBreakpoint="xl"
                  cardGridClassName="bg-surface-subtle/60 p-3 sm:p-4"
                  className="border-0 shadow-none rounded-none"
                  emptyState={
                    <div className="p-12 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-text-subtle">
                        <svg className="h-6 w-6 text-text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-text-main">
                        Pengguna tidak ditemukan
                      </h3>
                      <p className="mt-1 text-xs text-text-muted">
                        {search
                          ? "Coba ubah kata kunci pencarian Anda."
                          : "Belum ada data pengguna yang terdaftar."}
                      </p>
                      <div className="mt-4 flex justify-center">
                        <Button
                          type="button"
                          variant="primary"
                          onClick={openCreateModal}
                          disabled={isOffice && !selectedCompanyId}
                        >
                          + Tambah Pengguna
                        </Button>
                      </div>
                    </div>
                  }
                  renderMobileCard={(user) => {
                    const isSelf =
                      (currentUserId && user.id === currentUserId) ||
                      (currentUserEmail &&
                        user.email?.toLowerCase() ===
                          currentUserEmail.toLowerCase());
                    const isActive = user.is_active ?? (user.status === "ACTIVE");

                    return (
                      <Card
                        key={user.id}
                        className="p-3.5 shadow-xs transition flex flex-col justify-between h-full hover:border-border"
                      >
                        <div>
                          {/* TOP: AVATAR, NAME, SELF BADGE, STATUS BADGE */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                  isActive
                                    ? "bg-blue-50 text-blue-600"
                                    : "bg-surface-muted text-text-muted"
                                }`}
                              >
                                {(user.name || "?").charAt(0).toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p
                                    className="truncate text-sm font-semibold text-text-main"
                                    title={user.name}
                                  >
                                    {user.name}
                                  </p>
                                  {isSelf && (
                                    <span className="inline-flex shrink-0 items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200/60">
                                      Anda
                                    </span>
                                  )}
                                </div>
                                <p
                                  className="truncate text-xs text-text-muted font-mono"
                                  title={user.email}
                                >
                                  {user.email || "-"}
                                </p>
                              </div>
                            </div>

                            <Badge variant={isActive ? "success" : "neutral"}>
                              {isActive ? "Aktif" : "Nonaktif"}
                            </Badge>
                          </div>

                          {/* INFORMATION */}
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                Role Akses
                              </p>
                              <div className="mt-1">
                                <Badge variant={getRoleBadgeVariant(user.role)}>
                                  {getRoleLabel(user.role)}
                                </Badge>
                              </div>
                            </div>

                            <div className="rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                Terdaftar Sejak
                              </p>
                              <p
                                className="mt-1 truncate text-xs font-medium text-text-secondary"
                                title={formatDate(user.createdAt)}
                              >
                                {formatDate(user.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* BOTTOM ACTIONS */}
                        <div className="mt-3.5 flex items-center justify-between border-t border-border-subtle pt-2.5">
                          <span className="text-xs font-medium text-text-muted">
                            Pilihan Aksi
                          </span>
                          <RowActions actions={getUserActions(user)} />
                        </div>
                      </Card>
                    );
                  }}
                />

                {/* PAGINATION */}
                {users.length > 0 && total > 0 && (
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={total}
                    pageSize={pageSize}
                    pageSizeOptions={[5, 10, 20, 50, 100]}
                    onPageSizeChange={(newSize) => {
                      savedTotalRef.current = 0;
                      setPageSize(newSize);
                      setPage(1);
                    }}
                    onPageChange={(p) => setPage(p)}
                  />
                )}
              </Card>
          )}
          </>
        )}

        {/* MODAL FORM CREATE / EDIT */}
        <Modal
          open={showModal}
          onClose={handleRequestCloseModal}
          title={editingUser ? "Edit Pengguna" : "Tambah Pengguna Baru"}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="user-form-name"
              label="Nama Lengkap"
              required
              type="text"
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                if (formErrors.name) setFormErrors((p) => ({ ...p, name: "" }));
              }}
              placeholder="Contoh: Ahmad Dahlan"
              error={formErrors.name}
            />

            <Input
              id="user-form-email"
              label="Email (Identitas Login)"
              required
              type="email"
              value={formEmail}
              disabled={editingUser !== null}
              onChange={(e) => {
                setFormEmail(e.target.value);
                if (formErrors.email) setFormErrors((p) => ({ ...p, email: "" }));
              }}
              onBlur={() => {
                const clean = formEmail.trim().toLowerCase();
                if (clean && !editingUser) {
                  if (users.some((u) => u.email?.toLowerCase() === clean)) {
                    setFormErrors((p) => ({
                      ...p,
                      email: "Email ini sudah digunakan oleh pengguna lain. Silakan gunakan email lain.",
                    }));
                  }
                }
              }}
              placeholder="Contoh: ahmad@perpustakaan.id"
              error={formErrors.email}
              helperText={
                editingUser
                  ? "Email identitas login tidak dapat diubah setelah dibuat."
                  : "Digunakan pengguna untuk masuk ke sistem BukuFlow."
              }
            />

            {!editingUser && (
              <Input
                id="user-form-password"
                label="Password"
                required
                type="password"
                minLength={8}
                value={formPassword}
                onChange={(e) => {
                  setFormPassword(e.target.value);
                  if (formErrors.password) {
                    setFormErrors((p) => ({ ...p, password: "" }));
                  }
                }}
                placeholder="Minimal 8 karakter"
                error={formErrors.password}
                helperText="Password minimal 8 karakter sesuai spesifikasi server (UserCreateRequest)."
              />
            )}

            <div>
              <label
                htmlFor="user-form-role"
                className="block text-sm font-medium text-text-muted mb-1.5"
              >
                Hak Akses / Role <span className="text-danger">*</span>
              </label>
              {editingUser?.role === "SUPER_ADMIN" ? (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                  <span className="font-bold text-amber-900">Super Admin (Platform)</span>
                  <span className="text-amber-700">— Role akun Super Admin dilindungi sistem dan tidak dapat diubah ke Staf atau Admin Instansi.</span>
                </div>
              ) : (
                <Dropdown
                  id="user-form-role"
                  value={formRole}
                  onChange={(val) =>
                    setFormRole(val as UserRole)
                  }
                  ariaLabel="Role pengguna"
                  options={[
                    { value: "STAFF", label: "Staf" },
                    { value: "COMPANY_ADMIN", label: "Admin Instansi" },
                  ]}
                />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleRequestCloseModal}
                disabled={formLoading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={formLoading}
                aria-keyshortcuts="Control+Enter Meta+Enter"
              >
                {editingUser ? "Simpan Perubahan" : "Tambah Pengguna"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* CONFIRMATION DIALOG DISCARD FORM */}
        <ConfirmationDialog
          open={showDiscardConfirm}
          title="Tutup Formulir Pengguna?"
          description="Data yang telah Anda isi belum disimpan. Jika formulir ditutup, seluruh isian data pengguna akan hilang."
          confirmLabel="Ya, Tutup Formulir"
          tone="destructive"
          onConfirm={() => {
            setShowDiscardConfirm(false);
            closeModal();
          }}
          onClose={() => setShowDiscardConfirm(false)}
        />

        {/* CONFIRMATION DIALOG STATUS TOGGLE */}
        <ConfirmationDialog
          open={confirmUser !== null}
          title={
            (confirmUser?.is_active ?? confirmUser?.status === "ACTIVE")
              ? "Nonaktifkan Akun Pengguna"
              : "Aktifkan Akun Pengguna"
          }
          description={
            (confirmUser?.is_active ?? confirmUser?.status === "ACTIVE")
              ? `Apakah Anda yakin ingin menonaktifkan akun "${confirmUser?.name}"? Pengguna tidak akan dapat login ke sistem.`
              : `Apakah Anda yakin ingin mengaktifkan kembali akun "${confirmUser?.name}"? Pengguna akan dapat login ke sistem.`
          }
          confirmLabel={
            (confirmUser?.is_active ?? confirmUser?.status === "ACTIVE")
              ? "Nonaktifkan"
              : "Aktifkan"
          }
          tone={
            (confirmUser?.is_active ?? confirmUser?.status === "ACTIVE")
              ? "destructive"
              : "primary"
          }
          loading={statusLoading}
          onConfirm={() => void handleConfirmToggleStatus()}
          onClose={() => {
            if (!statusLoading) setConfirmUser(null);
          }}
        />
      </div>
    </div>
  );
}

