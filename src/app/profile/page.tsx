"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import BackLink from "@/components/ui/BackLink";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { getSession, saveAuthData, getAuthData, type Session } from "@/lib/auth";
import { logoutApi, updateCompanyUserApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

export default function ProfilePage() {
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);

  // Active Modes: "view" | "edit-profile" | "change-password"
  const [mode, setMode] = useState<"view" | "edit-profile" | "change-password">("view");

  // Real Backend Data State
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("Demo Admin");
  const [email, setEmail] = useState("admin@bukuflow.com");
  const [role, setRole] = useState("COMPANY_ADMIN");
  const [companyId, setCompanyId] = useState("company-001");

  // Edit Temp Form State
  const [editName, setEditName] = useState("");

  // Change Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // UI Feedback & Modal State
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const sess = getSession();
    setSession(sess);

    if (sess?.user) {
      setUserId(sess.user.id || "");
      setName(sess.user.name || "Demo Admin");
      setEmail(sess.user.email || "admin@bukuflow.com");
      setRole(sess.user.role || "COMPANY_ADMIN");
      setCompanyId(sess.user.companyId || "company-001");
    }
  }, []);

  const isSuperAdmin = role === "SUPER_ADMIN";
  const backHref = isSuperAdmin ? "/office/dashboard" : "/dashboard";

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

  // Password rules check
  const hasMinLength = newPassword.length >= 6;
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Open Edit Profile Mode
  const handleStartEditProfile = () => {
    setEditName(name);
    setFeedback(null);
    setMode("edit-profile");
  };

  // Open Change Password Mode
  const handleStartChangePassword = () => {
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPass(false);
    setShowConfirmPass(false);
    setFeedback(null);
    setMode("change-password");
  };

  // Cancel edit/password mode
  const handleCancelMode = () => {
    setFeedback(null);
    setMode("view");
  };

  // Handle Real Save Profile (Name)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setFeedback({ type: "error", message: "Nama lengkap tidak boleh kosong." });
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
      toast.success("Nama profil berhasil diperbarui!");
      setFeedback({
        type: "success",
        message: "Data profil akun Anda berhasil diperbarui di sistem.",
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      const errMsg = err.message || "Gagal memperbarui data profil.";
      setFeedback({ type: "error", message: errMsg });
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Real Update Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!hasMinLength) {
      setFeedback({ type: "error", message: "Kata sandi baru minimal harus 6 karakter." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", message: "Konfirmasi kata sandi tidak cocok." });
      return;
    }

    setIsSubmitting(true);
    try {
      if (userId) {
        await updateCompanyUserApi(userId, { password: newPassword.trim() });
      }

      setMode("view");
      toast.success("Kata sandi berhasil diperbarui!");
      setFeedback({
        type: "success",
        message: "Kata sandi akun Anda berhasil diperbarui. Silakan gunakan sandi baru untuk login berikutnya.",
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      const errMsg = err.message || "Gagal memperbarui kata sandi.";
      setFeedback({ type: "error", message: errMsg });
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logoutApi();
  };

  const inputBaseStyle =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500";

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
            <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xl sm:text-2xl font-bold text-white shadow-md">
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
                    : "Staff Sirkulasi"}
                </Badge>
              </div>

              <p className="text-xs sm:text-sm text-slate-500 truncate">{email}</p>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <BuildingIcon />
                  {isSuperAdmin ? "Kantor Pusat / Multi-Tenant" : "SMA Negeri 1 Jakarta"}
                </span>
                <span>•</span>
                <span className="font-mono text-slate-400">ID: {userId || "-"}</span>
              </div>
            </div>
          </div>

          {/* Quick Logout Header Action */}
          <div className="flex shrink-0 items-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
            >
              <LogoutSmallIcon />
              Keluar Akun
            </button>
          </div>
        </div>
      </Card>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`animate-profile-fade flex items-center gap-2 rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm ${
            feedback.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? <CheckCircleIcon /> : <AlertIcon />}
          <span>{feedback.message}</span>
        </div>
      )}

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
                <button
                  type="button"
                  onClick={handleStartEditProfile}
                  className="flex-1 sm:flex-initial inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 transition shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
                >
                  <EditIcon />
                  Ubah Data
                </button>
                <button
                  type="button"
                  onClick={handleStartChangePassword}
                  className="flex-1 sm:flex-initial inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 transition shadow-xs focus:outline-none focus:ring-2 focus:ring-slate-400 whitespace-nowrap"
                >
                  <KeyIcon />
                  Ubah Password
                </button>
              </div>
            </div>

            {/* READ-ONLY INFO GRID (ONLY REAL FIELDS FROM BACKEND) */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4 pt-4 sm:pt-5 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Nama Lengkap
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900">{name}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Alamat Email Login
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900 break-all">{email}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Hak Akses / Peran Akun
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900">{getRoleLabel(role)}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Instansi / Sekolah
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {isSuperAdmin ? "Multi-Tenant Platform (Office)" : "SMA Negeri 1 Jakarta"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Status Akun
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-700">Aktif (ACTIVE)</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Form Ubah Data Profil</h2>
                <p className="text-xs text-slate-500">
                  Perbarui nama lengkap akun pengguna Anda.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    required
                    className={inputBaseStyle}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Alamat Email (Akun Login)
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    title="Alamat email login dikelola oleh Administrator"
                    className={inputBaseStyle}
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Email login bersifat permanen untuk autentikasi.
                  </span>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Peran Akun
                  </label>
                  <input
                    type="text"
                    value={getRoleLabel(role)}
                    disabled
                    className={inputBaseStyle}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Instansi
                  </label>
                  <input
                    type="text"
                    value={isSuperAdmin ? "Kantor Pusat / Multi-Tenant" : "SMA Negeri 1 Jakarta"}
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
                <Button type="submit" loading={isSubmitting} className="justify-center">
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* 3. CHANGE PASSWORD MODE */}
        {mode === "change-password" && (
          <div key="change-password" className="animate-profile-fade">
            <form onSubmit={handleUpdatePassword}>
              <div className="mb-4 sm:mb-5 border-b border-slate-100 pb-3 sm:pb-4">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Form Ubah Kata Sandi</h2>
                <p className="text-xs text-slate-500">
                  Gunakan kata sandi baru minimal 6 karakter.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Left Column: Password Inputs */}
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Kata Sandi Baru <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPass ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Ketik kata sandi baru"
                        required
                        className={inputBaseStyle}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-700 font-medium"
                      >
                        {showNewPass ? "Sembunyikan" : "Tampilkan"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Konfirmasi Kata Sandi Baru <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPass ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ketik ulang kata sandi baru"
                        required
                        className={inputBaseStyle}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-700 font-medium"
                      >
                        {showConfirmPass ? "Sembunyikan" : "Tampilkan"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Security Checklist */}
                <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 sm:p-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-800 mb-2">
                      Ketentuan Sandi:
                    </p>
                    <div className="space-y-1.5 text-xs">
                      <div
                        className={`flex items-center gap-2 ${
                          hasMinLength ? "text-emerald-700 font-semibold" : "text-slate-500"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                            hasMinLength ? "bg-emerald-100 text-emerald-700 font-bold" : "bg-slate-200 text-slate-400"
                          }`}
                        >
                          {hasMinLength ? "✓" : "•"}
                        </span>
                        Minimal 6 Karakter
                      </div>

                      <div
                        className={`flex items-center gap-2 ${
                          isMatch ? "text-emerald-700 font-semibold" : "text-slate-500"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                            isMatch ? "bg-emerald-100 text-emerald-700 font-bold" : "bg-slate-200 text-slate-400"
                          }`}
                        >
                          {isMatch ? "✓" : "•"}
                        </span>
                        Konfirmasi Sandi Cocok
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg bg-blue-50/70 p-2 text-[11px] text-blue-800 border border-blue-100">
                    💡 <strong>Tips:</strong> Gunakan kata sandi yang mudah Anda ingat namun aman.
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 sm:gap-3 border-t border-slate-100 pt-4 mt-5 sm:mt-6">
                <Button type="button" variant="secondary" onClick={handleCancelMode} className="justify-center">
                  Batal
                </Button>
                <Button type="submit" loading={isSubmitting} className="justify-center">
                  Perbarui Kata Sandi
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
        onConfirm={handleLogout}
        onClose={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}

// Icons
function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-1.5 1.5L14 9l-3-3 2.5-2.5a4.95 4.95 0 0 1 7 7l-5.5 5.5-3-3" />
      <path d="M15 5l-2 2" />
      <circle cx="7.5" cy="16.5" r="4.5" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20V5l8-2v17M12 20h8V8l-8-3" />
    </svg>
  );
}

function LogoutSmallIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
