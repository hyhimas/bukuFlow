"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import BackLink from "@/components/ui/BackLink";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { getSession, saveAuthData, getAuthData } from "@/lib/auth";
import { logoutApi, updateCompanyUserApi, getErrorMessage } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useSubmitHotkey } from "@/hooks/useHotkeys";

export default function ProfilePage() {
  const { toast } = useToast();

  // Active Modes: "view" | "edit-profile"
  const [mode, setMode] = useState<"view" | "edit-profile">("view");

  // Real Backend Data State (Lazy initialization dari session)
  const [initialUser] = useState(() => {
    if (typeof window !== "undefined") {
      const sess = getSession();
      if (sess?.user) {
        const u = sess.user as unknown as Record<string, unknown>;
        const comp = u.company as { name?: string } | undefined;
        const sessCompName =
          typeof u.companyName === "string"
            ? u.companyName
            : typeof comp?.name === "string"
            ? comp.name
            : "-";
        return {
          id: sess.user.id || "",
          name: sess.user.name || "Demo Admin",
          email: sess.user.email || "admin@bukuflow.com",
          role: sess.user.role || "COMPANY_ADMIN",
          companyName: sessCompName,
        };
      }
    }
    return {
      id: "",
      name: "Demo Admin",
      email: "admin@bukuflow.com",
      role: "COMPANY_ADMIN",
      companyName: "-",
    };
  });

  const [userId] = useState(initialUser.id);
  const [name, setName] = useState(initialUser.name);
  const [email] = useState(initialUser.email);
  const [role] = useState(initialUser.role);
  const [companyName] = useState(initialUser.companyName);

  // Edit Temp Form State
  const [editName, setEditName] = useState("");

  // Modal & Loading State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isSuperAdmin = role === "SUPER_ADMIN";
  const backHref = isSuperAdmin ? "/office/dashboard" : "/dashboard";
  const displayCompanyName = isSuperAdmin
    ? "Kantor Pusat"
    : (companyName || "-");

  const getRoleLabel = (r: string) => {
    switch (r) {
      case "SUPER_ADMIN":
        return "Super Admin (Office Platform)";
      case "COMPANY_ADMIN":
        return "Admin Perpustakaan";
      case "STAFF":
        return "Staf / Pustakawan";
      default:
        return "Pengguna Perpustakaan";
    }
  };

  // Initials generator
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  // Open Edit Profile Mode
  const handleStartEditProfile = () => {
    setEditName(name);
    setMode("edit-profile");
  };

  // Cancel edit mode
  const handleCancelMode = () => {
    setMode("view");
  };

  // Handle Real Save Profile (Name)
  const handleSaveProfile = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error("Nama lengkap tidak boleh kosong.");
      return;
    }

    if (trimmedName === name) {
      toast.warning("Data masih sama, tidak ada perubahan yang disimpan.");
      setMode("view");
      return;
    }

    setIsSubmitting(true);
    try {
      if (userId) {
        await updateCompanyUserApi(userId, { name: trimmedName });
      }

      // Update local state
      setName(trimmedName);

      // Update auth session in local storage
      const auth = getAuthData();
      if (auth && auth.user) {
        auth.user.name = trimmedName;
        saveAuthData(auth);
      }

      setMode("view");
      toast.success("Nama profil berhasil diperbarui.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Gagal memperbarui data profil."));
    } finally {
      setIsSubmitting(false);
    }
  };

  useSubmitHotkey(() => void handleSaveProfile(), {
    enabled: mode === "edit-profile",
    loading: isSubmitting,
  });

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logoutApi();
  };

  const inputBaseStyle =
    "w-full h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 p-3.5 sm:p-6 lg:p-8">
      {/* Back Link */}
      <div>
        <BackLink href={backHref}>Kembali ke Dashboard</BackLink>
      </div>

      {/* HEADER PROFILE CARD */}
      <Card className="overflow-hidden border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            {/* Avatar */}
            <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-600 text-xl sm:text-2xl font-bold text-white shadow-md">
              {initials}
              <div
                title="Status Akun Aktif"
                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500"
              />
            </div>

            {/* User Meta */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate">{name}</h1>
                <Badge
                  variant={
                    isSuperAdmin
                      ? "neutral"
                      : role === "COMPANY_ADMIN"
                      ? "success"
                      : "neutral"
                  }
                >
                  {isSuperAdmin
                    ? "Super Admin"
                    : role === "COMPANY_ADMIN"
                    ? "Admin Perpustakaan"
                    : "Staff Perpustakaan"}
                </Badge>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 truncate">{email}</p>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <BuildingIcon />
                  {displayCompanyName}
                </span>
                <span className="text-slate-300 select-none" aria-hidden="true">&bull;</span>
                <span className="font-mono text-slate-500">ID: {userId || "-"}</span>
              </div>
            </div>
          </div>

          {/* Quick Logout Header Action */}
          <div className="flex shrink-0 items-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowLogoutConfirm(true)}
              icon={<LogoutSmallIcon />}
              className="w-full sm:w-auto"
            >
              Keluar Akun
            </Button>
          </div>
        </div>
      </Card>

      {/* ========================================================= */}
      {/* MAIN INTERACTIVE CARD (AUTHENTIC BACKEND DATA SCHEMA)    */}
      {/* ========================================================= */}
      <Card className="border-slate-200 bg-white p-4 sm:p-6 lg:p-7 shadow-sm">
        {/* 1. VIEW MODE (AUTHENTIC DATA ONLY) */}
        {mode === "view" && (
          <div key="view" className="animate-profile-fade">
            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between pb-4 sm:pb-5 border-b border-slate-100">
              <div className="min-w-0 pr-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Informasi Akun Pengguna</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Data identitas akun dan hak akses operasional yang terdaftar pada sistem BukuFlow.
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center gap-2 sm:shrink-0">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleStartEditProfile}
                  icon={<EditIcon />}
                  className="flex-1 sm:flex-initial"
                >
                  Ubah Nama
                </Button>
              </div>
            </div>

            {/* READ-ONLY INFO GRID (ONLY REAL FIELDS FROM BACKEND) */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4 pt-4 sm:pt-5 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Nama Lengkap
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900">{name}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Alamat Email Login
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900 break-all">{email}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Hak Akses / Peran Akun
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900">{getRoleLabel(role)}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Instansi / Sekolah
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {displayCompanyName}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Status Akun
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-700">Aktif (ACTIVE)</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  User ID Sistem
                </span>
                <p className="mt-1 text-xs font-mono font-medium text-slate-600 break-all">{userId || "-"}</p>
              </div>
            </div>
          </div>
        )}

        {/* 2. EDIT PROFILE MODE (FORM REAL BACKEND FIELDS) */}
        {mode === "edit-profile" && (
          <div key="edit-profile" className="animate-profile-fade">
            <form onSubmit={handleSaveProfile}>
              <div className="mb-4 sm:mb-5 border-b border-slate-100 pb-3 sm:pb-4">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Form Ubah Nama Profil</h2>
                <p className="text-xs text-slate-500">
                  Perbarui nama lengkap akun pengguna Anda.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-name" className="mb-1 block text-xs font-semibold text-slate-700">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    required
                    className={inputBaseStyle}
                  />
                </div>

                <div>
                  <label htmlFor="profile-email" className="mb-1 block text-xs font-semibold text-slate-700">
                    Alamat Email (Akun Login)
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    value={email}
                    disabled
                    title="Alamat email login dikelola oleh Administrator"
                    className={inputBaseStyle}
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Email login bersifat permanen untuk autentikasi.
                  </span>
                </div>

                <div>
                  <label htmlFor="profile-role" className="mb-1 block text-xs font-semibold text-slate-700">
                    Peran Akun
                  </label>
                  <input
                    id="profile-role"
                    type="text"
                    value={getRoleLabel(role)}
                    disabled
                    className={inputBaseStyle}
                  />
                </div>

                <div>
                  <label htmlFor="profile-company" className="mb-1 block text-xs font-semibold text-slate-700">
                    Instansi
                  </label>
                  <input
                    id="profile-company"
                    type="text"
                    value={displayCompanyName}
                    disabled
                    className={inputBaseStyle}
                  />
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 sm:gap-3 border-t border-slate-100 pt-4 mt-5 sm:mt-6">
                <Button type="button" variant="secondary" onClick={handleCancelMode} className="justify-center">
                  Batal
                </Button>
                <Button
                  type="submit"
                  loading={isSubmitting}
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                  className="justify-center"
                >
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        )}
      </Card>

      {/* CONFIRMATION MODAL LOGOUT */}
      <ConfirmationDialog
        open={showLogoutConfirm}
        title="Konfirmasi Keluar Akun"
        description="Apakah Anda yakin ingin keluar dari sistem BukuFlow? Sesi kerja aktif Anda akan ditutup."
        confirmLabel="Ya, Keluar"
        tone="destructive"
        onConfirm={handleLogout}
        onClose={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}

// Icons
function EditIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20V5l8-2v17M12 20h8V8l-8-3" />
    </svg>
  );
}

function LogoutSmallIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
