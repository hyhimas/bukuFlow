"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import BackLink from "@/components/ui/BackLink";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import Badge from "@/components/ui/Badge";
import LoadingState from "@/components/ui/LoadingState";
import Pagination from "@/components/ui/Pagination";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

import { getSession } from "@/lib/auth";
import { canAccessUserManagement } from "@/lib/authorization";
import {
  getCompanyUsersApi,
  createCompanyUserApi,
  updateCompanyUserApi,
} from "@/lib/api";
import type { UserRole, UserStatus } from "@/lib/types";
import { useToast } from "@/context/ToastContext";

interface UserItem {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  is_active?: boolean;
  createdAt?: string;
}

export default function UsersSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("company-001");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  // Pagination State (10 items/page)
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter & Search
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal State - Create User
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("admin123");
  const [createRole, setCreateRole] = useState<"COMPANY_ADMIN" | "STAFF">("STAFF");

  // Modal State - Edit User (Name, Email, Password)
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"COMPANY_ADMIN" | "STAFF">("STAFF");

  // Confirmation Dialog (for Deactivate / Activate)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "",
    onConfirm: () => {},
  });

  const loadUsers = useCallback(async (
    currentPage: number,
    currentSearch: string,
    currentRole: string,
    currentStatus: string,
    currentCompanyId: string,
    silent: boolean = false
  ) => {
    try {
      if (!silent && !initialLoaded) {
        setLoading(true);
      } else {
        setTableLoading(true);
      }
      const res = await getCompanyUsersApi({
        page: currentPage,
        size: pageSize,
        search: currentSearch,
        role: currentRole,
        status: currentStatus,
        companyId: currentCompanyId,
      });

      // Strictly ensure Super Admin is never displayed in company user settings
      const filtered = (res.items || []).filter((u: any) => u.role !== "SUPER_ADMIN");
      setUsers(filtered);
      setTotalItems(res.total);
      setTotalPages(res.totalPages || 1);
      setInitialLoaded(true);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat daftar pengguna dari backend.");
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [pageSize, toast, initialLoaded]);

  useEffect(() => {
    const session = getSession();

    if (!session || !canAccessUserManagement(session.user.role)) {
      router.replace("/dashboard");
      return;
    }

    setCurrentUserId(session.user.id);
    const targetCompId = session.user.companyId || "company-001";
    setCompanyId(targetCompId);

    loadUsers(page, search, roleFilter, statusFilter, targetCompId);
  }, [router, page, search, roleFilter, statusFilter, loadUsers]);

  // Handle Create User (POST /bukuflow/user)
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createEmail.trim()) {
      toast.error("Nama lengkap dan email wajib diisi.");
      return;
    }

    try {
      setActionLoading(true);
      await createCompanyUserApi({
        name: createName.trim(),
        email: createEmail.trim(),
        password: createPassword.trim(),
        role: createRole,
      });

      toast.success(`Pengguna baru "${createName}" berhasil didaftarkan!`);
      setIsCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("admin123");
      setCreateRole("STAFF");
      await loadUsers(page, search, roleFilter, statusFilter, companyId, true);
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat pengguna di backend.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal (Name, Email readonly, Role)
  const openEditModal = (user: UserItem) => {
    setEditUser(user);
    setEditName(user.name);
    setEditEmail(user.email || user.username || "");
    setEditRole(user.role === "COMPANY_ADMIN" ? "COMPANY_ADMIN" : "STAFF");
  };

  // Handle Edit Submit (PATCH /user/{user_id}) -> name & role
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error("Nama lengkap tidak boleh kosong.");
      return;
    }

    const currentName = editUser.name.trim();
    const currentRole = editUser.role;
    const hasChanges = trimmedName !== currentName || editRole !== currentRole;

    if (!hasChanges) {
      toast.warning("Data masih sama, tidak ada perubahan yang disimpan.");
      setEditUser(null);
      return;
    }

    try {
      setActionLoading(true);
      await updateCompanyUserApi(editUser.id, {
        name: trimmedName,
        role: editRole,
      });

      // Optimistically update local users state immediately
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editUser.id
            ? {
                ...u,
                name: trimmedName,
                role: editRole,
              }
            : u
        )
      );

      toast.success(`Data pengguna "${trimmedName}" berhasil diperbarui!`);
      setEditUser(null);
      await loadUsers(page, search, roleFilter, statusFilter, companyId, true);
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui pengguna di backend.");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Status (Aktifkan / Nonaktifkan)
  const handleToggleStatus = (user: UserItem) => {
    const isCurrentlyActive = user.is_active !== undefined ? user.is_active : user.status === "ACTIVE";
    const nextIsActive = !isCurrentlyActive;

    setConfirmDialog({
      open: true,
      title: isCurrentlyActive ? "Nonaktifkan Pengguna?" : "Aktifkan Pengguna?",
      description: isCurrentlyActive
        ? `Apakah Anda yakin ingin menonaktifkan akun "${user.name}"? Pengguna ini tidak akan bisa login ke sistem.`
        : `Aktifkan kembali akun "${user.name}" agar dapat login dan bertugas di perpustakaan.`,
      confirmLabel: isCurrentlyActive ? "Ya, Nonaktifkan" : "Ya, Aktifkan",
      onConfirm: async () => {
        try {
          setActionLoading(true);
          await updateCompanyUserApi(user.id, { is_active: nextIsActive });
          
          setUsers((prev) =>
            prev.map((u) =>
              u.id === user.id
                ? {
                    ...u,
                    is_active: nextIsActive,
                    status: nextIsActive ? "ACTIVE" : "INACTIVE",
                  }
                : u
            )
          );

          toast.success(
            `Status akun "${user.name}" berhasil diubah menjadi ${nextIsActive ? "Aktif" : "Nonaktif"}.`
          );
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          await loadUsers(page, search, roleFilter, statusFilter, companyId, true);
        } catch (err: any) {
          toast.error(err.message || "Gagal mengubah status akun.");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="page-container py-5 sm:py-6">
        <BackLink href="/dashboard" />

        {/* Header */}
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Kelola Staf & Pengguna
            </h1>
            <p className="mt-1 text-sm text-slate-500 sm:text-base">
              Kelola akun Admin Perpustakaan dan Staf operasional instansi Anda.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tambah Pengguna
          </Button>
        </div>

        {/* Filters & Search Toolbar */}
        <Card className="mt-5 p-3.5 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-center">
            {/* Search Input: Full width on tablet top, 50% on desktop */}
            <div className="sm:col-span-2 lg:col-span-6">
              <label htmlFor="search-user" className="sr-only">
                Cari Pengguna
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <input
                  id="search-user"
                  type="text"
                  placeholder="Cari berdasarkan nama atau email..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Role Filter: 50% on tablet row 2, 25% on desktop */}
            <div className="sm:col-span-1 lg:col-span-3">
              <Dropdown
                id="role-filter"
                value={roleFilter}
                ariaLabel="Filter Peran Pengguna"
                onChange={(val) => {
                  setRoleFilter(val);
                  setPage(1);
                }}
                options={[
                  { value: "ALL", label: "Semua Peran (Role)" },
                  { value: "COMPANY_ADMIN", label: "Admin Perpustakaan" },
                  { value: "STAFF", label: "Staf Operasional" },
                ]}
              />
            </div>

            {/* Status Filter: 50% on tablet row 2, 25% on desktop */}
            <div className="sm:col-span-1 lg:col-span-3">
              <Dropdown
                id="status-filter"
                value={statusFilter}
                ariaLabel="Filter Status Pengguna"
                onChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                options={[
                  { value: "ALL", label: "Semua Status" },
                  { value: "ACTIVE", label: "Aktif" },
                  { value: "INACTIVE", label: "Nonaktif" },
                ]}
              />
            </div>
          </div>
        </Card>

        {/* Content Section */}
        {loading && users.length === 0 ? (
          <div className="py-16">
            <LoadingState label="Memuat data pengguna..." />
          </div>
        ) : !loading && users.length === 0 ? (
          <Card className="mt-5 p-8 text-center">
            <p className="font-semibold text-slate-800">
              Tidak ada pengguna ditemukan
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Coba sesuaikan kata kunci pencarian atau filter yang dipilih.
            </p>
          </Card>
        ) : (
          <div className="relative mt-5 space-y-4">
            {tableLoading && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-[1px]"
                role="status"
                aria-live="polite"
                aria-label="Memperbarui data pengguna"
              >
                <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-md ring-1 ring-slate-200">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Memperbarui data...
                </div>
              </div>
            )}
            {/* =========================================================
                1. MOBILE & TABLET CARD VIEW (< lg)
            ========================================================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 lg:hidden">
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                const isActive = user.is_active !== undefined ? user.is_active : user.status === "ACTIVE";

                return (
                  <Card key={user.id} className="p-4 shadow-sm border border-slate-200/90 transition hover:border-slate-300 flex flex-col justify-between">
                    <div>
                      {/* User Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold text-sm shadow-sm">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-slate-900 text-sm truncate">
                                {user.name}
                              </p>
                              {isSelf && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                  Akun Anda
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">
                              {user.email || user.username}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          <Badge variant={isActive ? "success" : "neutral"}>
                            {isActive ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </div>
                      </div>

                      {/* Role & Details */}
                      <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                        <span className="text-slate-500 font-medium">Peran Akses:</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            user.role === "COMPANY_ADMIN"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {user.role === "COMPANY_ADMIN" ? "Admin Perpustakaan" : "Staf Operasional"}
                        </span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-3.5 flex items-center gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(user)}
                        className="flex-1 min-h-9 py-1.5 px-3 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-1.5"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Edit</span>
                      </button>

                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          className={`flex-1 min-h-9 py-1.5 px-3 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1.5 shadow-2xs ${
                            isActive
                              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
                          }`}
                        >
                          {isActive ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                              </svg>
                              <span>Nonaktifkan</span>
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                              </svg>
                              <span>Aktifkan</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}

              {/* Mobile/Tablet Pagination */}
              {totalPages > 1 && (
                <div className="col-span-1 md:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm mt-2">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onPageChange={(newPage) => setPage(newPage)}
                    className="!border-t-0"
                  />
                </div>
              )}
            </div>

            {/* =========================================================
                2. TABLE VIEW (DESKTOP: >= lg)
            ========================================================== */}
            <Card className="hidden lg:block overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] table-fixed text-left text-sm text-slate-600">
                  <colgroup>
                    <col className="w-[220px]" />
                    <col className="w-[200px]" />
                    <col className="w-[160px]" />
                    <col className="w-[110px]" />
                    <col className="w-[160px]" />
                  </colgroup>
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Pengguna</th>
                      <th className="px-4 py-3.5">Email Akun</th>
                      <th className="px-4 py-3.5">Peran (Role)</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((user) => {
                      const isSelf = user.id === currentUserId;
                      const isActive = user.is_active !== undefined ? user.is_active : user.status === "ACTIVE";

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/70 transition">
                          {/* 1. Pengguna */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-xs">
                                {user.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-slate-900 truncate">
                                    {user.name}
                                  </span>
                                  {isSelf && (
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                      Anda
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Email */}
                          <td className="px-4 py-3.5">
                            <p className="font-mono text-xs font-medium text-slate-900 truncate">
                              {user.email || user.username}
                            </p>
                          </td>

                          {/* 3. Role */}
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                user.role === "COMPANY_ADMIN"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-blue-50 text-blue-700 border border-blue-200"
                              }`}
                            >
                              {user.role === "COMPANY_ADMIN"
                                ? "Admin Perpustakaan"
                                : "Staf Operasional"}
                            </span>
                          </td>

                          {/* 4. Status */}
                          <td className="px-4 py-3.5">
                            <Badge variant={isActive ? "success" : "neutral"}>
                              {isActive ? "Aktif" : "Nonaktif"}
                            </Badge>
                          </td>

                          {/* 5. Aksi */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(user)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                <span>Edit</span>
                              </button>

                              {!isSelf ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(user)}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-2xs transition focus:outline-none focus-visible:ring-2 ${
                                    isActive
                                      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 focus-visible:ring-amber-500"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 focus-visible:ring-emerald-500"
                                  }`}
                                >
                                  {isActive ? (
                                    <>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                      </svg>
                                      <span>Nonaktifkan</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                      </svg>
                                      <span>Aktifkan</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400 italic px-1.5">
                                  (Akun Anda)
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Component (Desktop) */}
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={(newPage) => setPage(newPage)}
              />
            </Card>
          </div>
        )}

        {/* Modal: Tambah Pengguna Baru (POST /bukuflow/user) */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Tambah Pengguna Baru
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mendaftarkan akun staf atau admin perpustakaan baru
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <Input
                    id="new-name"
                    label="Nama Lengkap *"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Contoh: Siti Rahmawati"
                    required
                  />
                </div>

                <div>
                  <Input
                    id="new-email"
                    type="email"
                    label="Email Akun *"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="user@example.com"
                    helperText="Digunakan sebagai email login akun."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Dropdown
                      id="new-role"
                      label="Peran (Role)"
                      required
                      value={createRole}
                      onChange={(val) =>
                        setCreateRole(val as "COMPANY_ADMIN" | "STAFF")
                      }
                      options={[
                        { value: "STAFF", label: "Staf Operasional" },
                        { value: "COMPANY_ADMIN", label: "Admin Perpustakaan" },
                      ]}
                    />
                  </div>

                  <div>
                    <Input
                      id="new-password"
                      type="text"
                      label="Password Awal *"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      helperText="Default: admin123"
                      required
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsCreateOpen(false)}
                    disabled={actionLoading}
                  >
                    Batal
                  </Button>
                  <Button type="submit" loading={actionLoading}>
                    Simpan Pengguna
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Pengguna (Nama & Role) */}
        {editUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Edit Pengguna
                  </h3>
                  <p className="text-xs text-slate-500">
                    Perbarui nama lengkap dan peran akses pengguna
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                {/* Email (Readonly / Permanen) */}
                <div>
                  <label
                    htmlFor="edit-email"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Email Akun (Login ID)
                  </label>
                  <div className="relative">
                    <input
                      id="edit-email"
                      type="text"
                      value={editEmail}
                      disabled
                      readOnly
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-mono text-slate-500 cursor-not-allowed select-none outline-none"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Email login akun bersifat permanen dan tidak dapat diubah.
                  </p>
                </div>

                {/* Nama Lengkap (Editable) */}
                <div>
                  <Input
                    id="edit-name"
                    label="Nama Lengkap *"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                {/* Peran / Role (Editable) */}
                <div>
                  <Dropdown
                    id="edit-role"
                    label="Peran (Role)"
                    required
                    value={editRole}
                    disabled={editUser.id === currentUserId}
                    onChange={(val) =>
                      setEditRole(val as "COMPANY_ADMIN" | "STAFF")
                    }
                    options={[
                      { value: "STAFF", label: "Staf Operasional" },
                      { value: "COMPANY_ADMIN", label: "Admin Perpustakaan" },
                    ]}
                  />
                </div>

                {editUser.id === currentUserId && (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    Catatan: Anda tidak dapat mengubah peran akun Anda sendiri.
                  </p>
                )}

                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditUser(null)}
                    disabled={actionLoading}
                  >
                    Batal
                  </Button>
                  <Button type="submit" loading={actionLoading}>
                    Simpan Perubahan
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmation Dialog (Nonaktifkan / Aktifkan) */}
        <ConfirmationDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmLabel={confirmDialog.confirmLabel}
          loading={actionLoading}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        />
      </div>
    </main>
  );
}
