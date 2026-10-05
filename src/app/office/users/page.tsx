"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import BackLink from "@/components/ui/BackLink";
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
  getOfficeUsersApi,
  createOfficeUserApi,
  updateOfficeUserApi,
  getCompaniesApi,
} from "@/lib/api";
import type { Company, UserRole } from "@/lib/types";
import { useToast } from "@/context/ToastContext";

interface OfficeUserItem {
  id: string;
  companyId: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export default function OfficeUsersPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [userName, setUserName] = useState("Super Admin");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<OfficeUserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  // Modal Create & Edit
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<OfficeUserItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"COMPANY_ADMIN" | "STAFF">("COMPANY_ADMIN");
  const [formCompanyId, setFormCompanyId] = useState("company-001");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({ name: "", username: "" });

  // Status Change Dialog
  const [confirmUser, setConfirmUser] = useState<OfficeUserItem | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

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

  // 2. Load Data
  const loadData = async (silent: boolean = false) => {
    if (!silent && !initialLoaded) {
      setLoading(true);
    } else {
      setTableLoading(true);
    }
    try {
      const [comps, userList] = await Promise.all([
        getCompaniesApi().catch(() => []),
        getOfficeUsersApi(selectedCompanyId || undefined).catch(() => []),
      ]);
      setCompanies(comps);
      if (comps.length > 0 && !formCompanyId) {
        setFormCompanyId(comps[0].id);
      }
      setUsers(userList);
      setInitialLoaded(true);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memuat data pengguna.");
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    if (!checkingAuth) {
      loadData();
    }
  }, [checkingAuth, selectedCompanyId]);

  // Modal Handlers
  const openCreateModal = () => {
    setEditingUser(null);
    setFormName("");
    setFormUsername("");
    setFormEmail("");
    setFormPassword("admin123");
    setFormRole("COMPANY_ADMIN");
    setFormCompanyId(companies[0]?.id || "company-001");
    setFormStatus("ACTIVE");
    setFormErrors({ name: "", username: "" });
    setShowModal(true);
  };

  const openEditModal = (user: OfficeUserItem) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormEmail(user.email || "");
    setFormPassword("");
    setFormRole(user.role === "STAFF" ? "STAFF" : "COMPANY_ADMIN");
    setFormCompanyId(user.companyId);
    setFormStatus(user.status);
    setFormErrors({ name: "", username: "" });
    setShowModal(true);
  };

  const validateForm = () => {
    const errors = { name: "", username: "" };
    if (!formName.trim()) errors.name = "Nama lengkap wajib diisi.";
    if (!formUsername.trim()) errors.username = "Username wajib diisi.";
    setFormErrors(errors);
    return !errors.name && !errors.username;
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || formLoading) return;

    setFormLoading(true);
    try {
      if (editingUser) {
        const hasChanges =
          formName.trim() !== editingUser.name ||
          formEmail.trim() !== (editingUser.email || "") ||
          formRole !== editingUser.role ||
          formStatus !== editingUser.status;

        if (!hasChanges) {
          toast.warning("Data masih sama, tidak ada perubahan yang disimpan.");
          setShowModal(false);
          return;
        }

        await updateOfficeUserApi(
          editingUser.id,
          {
            name: formName.trim(),
            email: formEmail.trim(),
            role: formRole,
            status: formStatus,
          },
          formCompanyId
        );
        // Optimistic update
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUser.id
              ? {
                  ...u,
                  name: formName.trim(),
                  email: formEmail.trim(),
                  role: formRole,
                  status: formStatus,
                }
              : u
          )
        );
        toast.success(`Pengguna "${formName}" berhasil diperbarui.`);
      } else {
        await createOfficeUserApi(formCompanyId, {
          name: formName.trim(),
          username: formUsername.trim().toLowerCase(),
          email: formEmail.trim(),
          password: formPassword || "admin123",
          role: formRole,
        });
        toast.success(`Pengguna baru "${formName}" berhasil didaftarkan.`);
      }
      setShowModal(false);
      await loadData(true);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan data pengguna.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmUser || statusLoading) return;
    setStatusLoading(true);
    try {
      const nextStatus = confirmUser.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await updateOfficeUserApi(
        confirmUser.id,
        { status: nextStatus },
        confirmUser.companyId
      );
      setUsers((prev) =>
        prev.map((u) =>
          u.id === confirmUser.id
            ? { ...u, status: nextStatus }
            : u
        )
      );
      toast.success(
        `Status akun "${confirmUser.name}" diubah menjadi ${
          nextStatus === "ACTIVE" ? "Aktif" : "Nonaktif"
        }.`
      );
      setConfirmUser(null);
      await loadData(true);
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengubah status akun.");
    } finally {
      setStatusLoading(false);
    }
  };

  const getCompanyName = (compKid: string) => {
    const found = companies.find((c) => c.id === compKid);
    return found ? found.name : compKid;
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      search.trim() === "" ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());

    const matchesCompany = !selectedCompanyId || u.companyId === selectedCompanyId;
    const matchesRole = !roleFilter || u.role === roleFilter;

    return matchesSearch && matchesCompany && matchesRole;
  });

  if (checkingAuth || (loading && !initialLoaded)) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="flex h-96 items-center justify-center">
          <LoadingState label="Memuat data pengguna & admin..." />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4">
          <BackLink href="/office/dashboard">Kembali ke Dashboard Office</BackLink>
        </div>

        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Kelola Akun Admin & Staf
              </h1>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {users.length} Akun
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Manajemen akun Company Admin dan Pustakawan/Staf seluruh instansi perpustakaan.
            </p>
          </div>

          <Button type="button" onClick={openCreateModal} className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Tambah Pengguna Baru</span>
          </Button>
        </div>

        {/* SEARCH & FILTERS */}
        <Card className="mt-6 p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_180px]">
            <Input
              id="user-search"
              label="Pencarian"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, username, atau email..."
            />

            <div>
              <Dropdown
                id="company-filter"
                label="Filter Instansi"
                value={selectedCompanyId}
                onChange={(val) => setSelectedCompanyId(val)}
                options={[
                  { value: "", label: "Semua Instansi" },
                  ...companies.map((comp) => ({
                    value: comp.id,
                    label: comp.name,
                  })),
                ]}
              />
            </div>

            <div>
              <Dropdown
                id="role-filter"
                label="Filter Role"
                value={roleFilter}
                onChange={(val) => setRoleFilter(val)}
                options={[
                  { value: "", label: "Semua Role" },
                  { value: "COMPANY_ADMIN", label: "Company Admin" },
                  { value: "STAFF", label: "Staf / Kasir" },
                  { value: "SUPER_ADMIN", label: "Super Admin" },
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
              aria-label="Memperbarui data pengguna"
            >
              <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-md ring-1 ring-slate-200">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Memperbarui data...
              </div>
            </div>
          )}
          {filteredUsers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="Pengguna Tidak Ditemukan"
                description="Tidak ada pengguna yang sesuai dengan filter atau kata kunci pencarian."
              />
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE (>= lg) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full min-w-[950px] text-left text-sm text-slate-600 table-fixed">
                  <colgroup>
                    <col className="w-[240px]" />
                    <col className="w-[200px]" />
                    <col className="min-w-[200px]" />
                    <col className="w-[160px]" />
                    <col className="w-[120px]" />
                    <col className="w-[200px]" />
                  </colgroup>
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Nama & Username</th>
                      <th className="px-5 py-3.5">Instansi Terdaftar</th>
                      <th className="px-5 py-3.5">Email</th>
                      <th className="px-5 py-3.5">Role</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="transition hover:bg-slate-50/60">
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 font-bold text-xs text-blue-700 shadow-2xs">
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{u.name}</p>
                              <p className="text-xs text-slate-400 font-normal">@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-medium text-slate-700 truncate block">
                            {getCompanyName(u.companyId)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600 truncate font-mono text-xs">{u.email || "-"}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              u.role === "SUPER_ADMIN"
                                ? "bg-purple-100 text-purple-700"
                                : u.role === "COMPANY_ADMIN"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {u.role === "SUPER_ADMIN"
                              ? "Super Admin"
                              : u.role === "COMPANY_ADMIN"
                              ? "Company Admin"
                              : "Staf Kasir"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {u.status === "ACTIVE" ? (
                            <Badge variant="success">Aktif</Badge>
                          ) : (
                            <Badge variant="neutral">Nonaktif</Badge>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-blue-600"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setConfirmUser(u)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                                u.status === "ACTIVE"
                                  ? "border-amber-200 bg-amber-50/70 text-amber-700 hover:bg-amber-100"
                                  : "border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {u.status === "ACTIVE" ? (
                                <>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                  </svg>
                                  <span>Nonaktifkan</span>
                                </>
                              ) : (
                                <>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  <span>Aktifkan</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE & TABLET CARD VIEW (< lg) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3.5 bg-slate-50/60 lg:hidden">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 font-bold text-blue-700 shadow-2xs">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-sm truncate">{u.name}</p>
                            <p className="text-xs text-slate-500 font-mono truncate mt-0.5">{u.email || `@${u.username}`}</p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {u.status === "ACTIVE" ? (
                            <Badge variant="success">Aktif</Badge>
                          ) : (
                            <Badge variant="neutral">Nonaktif</Badge>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="mt-3.5 space-y-2 border-t border-slate-100 pt-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Instansi:</span>
                          <span className="font-semibold text-slate-700 truncate max-w-[180px]">
                            {getCompanyName(u.companyId)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Role:</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              u.role === "SUPER_ADMIN"
                                ? "bg-purple-100 text-purple-700"
                                : u.role === "COMPANY_ADMIN"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {u.role === "SUPER_ADMIN"
                              ? "Super Admin"
                              : u.role === "COMPANY_ADMIN"
                              ? "Company Admin"
                              : "Staf Kasir"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(u)}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-blue-600"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmUser(u)}
                        className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          u.status === "ACTIVE"
                            ? "border-amber-200 bg-amber-50/70 text-amber-700 hover:bg-amber-100"
                            : "border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {u.status === "ACTIVE" ? (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                            <span>Nonaktifkan</span>
                          </>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Aktifkan</span>
                          </>
                        )}
                      </button>
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
                  {editingUser ? "Edit Data Pengguna" : "Tambah Pengguna / Staf Baru"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {editingUser ? "Perbarui informasi akun dan hak akses." : "Daftarkan akun admin atau staf untuk perpustakaan."}
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

            <form onSubmit={handleSaveUser} className="mt-4 space-y-4">
              <div>
                <Dropdown
                  id="form-user-company"
                  label="Pilih Instansi / Sekolah"
                  value={formCompanyId}
                  disabled={Boolean(editingUser)}
                  onChange={(val) => setFormCompanyId(val)}
                  options={companies.map((comp) => ({
                    value: comp.id,
                    label: `${comp.name} (${comp.code})`,
                  }))}
                />
              </div>

              <div>
                <Input
                  id="form-user-name"
                  label="Nama Lengkap"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  error={formErrors.name}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="form-user-username"
                  label="Username"
                  value={formUsername}
                  disabled={Boolean(editingUser)}
                  onChange={(e) => setFormUsername(e.target.value.toLowerCase())}
                  placeholder="budisantoso"
                  error={formErrors.username}
                  required
                />

                <Input
                  id="form-user-email"
                  label="Email (Opsional)"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="budi@sekolah.sch.id"
                />
              </div>

              {!editingUser && (
                <div>
                  <Input
                    id="form-user-password"
                    label="Password Awal"
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Minimal 6 karakter (default: admin123)"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Dropdown
                    id="form-user-role"
                    label="Role / Hak Akses"
                    value={formRole}
                    onChange={(val) => setFormRole(val as any)}
                    options={[
                      { value: "COMPANY_ADMIN", label: "Company Admin (Kelola Master Data)" },
                      { value: "STAFF", label: "Staf / Operator Sirkulasi" },
                    ]}
                  />
                </div>

                {editingUser && (
                  <div>
                    <Dropdown
                      id="form-user-status"
                      label="Status Akun"
                      value={formStatus}
                      onChange={(val) => setFormStatus(val as any)}
                      options={[
                        { value: "ACTIVE", label: "Aktif" },
                        { value: "INACTIVE", label: "Nonaktif" },
                      ]}
                    />
                  </div>
                )}
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
                <Button type="submit" loading={formLoading}>
                  {editingUser ? "Simpan Perubahan" : "Daftarkan Pengguna"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM STATUS DIALOG */}
      <ConfirmationDialog
        open={Boolean(confirmUser)}
        title={`Ubah Status Akun: ${confirmUser?.name || ""}`}
        description={`Apakah Anda yakin ingin mengubah status akun ini menjadi "${
          confirmUser?.status === "ACTIVE" ? "Nonaktif" : "Aktif"
        }"?`}
        confirmLabel={confirmUser?.status === "ACTIVE" ? "Ya, Nonaktifkan" : "Ya, Aktifkan"}
        loading={statusLoading}
        onConfirm={handleToggleStatus}
        onClose={() => setConfirmUser(null)}
      />
    </main>
  );
}
