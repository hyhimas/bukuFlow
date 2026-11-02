"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import LogoSpinner from "@/components/ui/LogoSpinner";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";

import { loginApi, getErrorMessage } from "@/lib/api";
import { getAuthData, saveAuthData } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSessionExpired] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("reason") === "expired";
    }
    return false;
  });
  const [checkingAuth] = useState(() => {
    if (typeof window !== "undefined") {
      return Boolean(getAuthData());
    }
    return true;
  });

  useEffect(() => {
    const auth = getAuthData();
    if (auth) {
      if (auth.user.role === "SUPER_ADMIN") {
        router.replace("/office/dashboard");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setEmailError("");
    setPasswordError("");

    let hasValidationError = false;
    if (!email.trim()) {
      setEmailError("Email wajib diisi");
      hasValidationError = true;
    } else if (!email.includes("@")) {
      setEmailError("Format email tidak valid");
      hasValidationError = true;
    }

    if (!password) {
      setPasswordError("Password wajib diisi");
      hasValidationError = true;
    }

    if (hasValidationError) {
      return;
    }

    setLoading(true);

    try {
      const response = await loginApi(email, password);

      const user = response.data;
      const companyId = user.companyId || "";
      const role = user.role || "STAFF";

      if (role !== "SUPER_ADMIN" && !companyId) {
        setError("Akun belum terhubung ke instansi.");
        setLoading(false);
        return;
      }

      const u = user as unknown as Record<string, unknown>;
      const userToSave = {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.email,
        role: user.role,
        companyId,
        status: "ACTIVE" as const,
        createdAt: (typeof u.created_at === "string" ? u.created_at : typeof u.createdAt === "string" ? u.createdAt : ""),
        updatedAt: (typeof u.updated_at === "string" ? u.updated_at : typeof u.updatedAt === "string" ? u.updatedAt : ""),
      };

      saveAuthData({
        accessToken: response.access_token,
        tokenType: response.token_type,
        user: userToSave,
      });

      if (user.role === "SUPER_ADMIN") {
        router.replace("/office/dashboard");
      } else {
        router.replace("/dashboard");
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { status?: number } } | null | undefined;
      if (errObj?.response?.status === 401) {
        setError("Email atau password salah. Periksa kembali akun Anda.");
      } else {
        setError(
          getErrorMessage(
            err,
            "Email atau password salah. Periksa kembali akun Anda."
          )
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <LogoSpinner label="Memeriksa sesi..." />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10 sm:px-6">
      <div className="absolute top-4 right-4 z-40">
        <ThemeSwitcher />
      </div>
      {/* LOGIN CARD CONTAINER */}
      <div className="w-full max-w-[420px]">
        {/* BRAND HEADER */}
        

        {/* MAIN FORM CARD (SOLID CLEAN) */}
        <div className="rounded-xl border border-border bg-surface text-text-main p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <img
              src="/logo.png"
              alt="BukuFlow Logo"
              className="h-11 w-auto object-contain dark:hidden"
            />
            <img
              src="/logo-dark.png"
              alt="BukuFlow Logo"
              className="h-11 w-auto object-contain hidden dark:inline-block"
            />
          <p className="mt-2 text-xs font-medium text-text-muted">
            Sistem Manajemen Perpustakaan
          </p>
        </div>
          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-tight text-text-main sm:text-2xl text-center">
              Masuk ke Akun
            </h1>
          </div>

          {/* EXPIRED SESSION NOTICE */}
          {isSessionExpired && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Sesi Anda telah berakhir</p>
                <p className="mt-0.5 text-amber-700 leading-relaxed">
                  Sesi login Anda telah habis karena batas waktu. Silakan masuk kembali untuk melanjutkan.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* EMAIL FIELD */}
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              autoComplete="email"
              required
              value={email}
              error={emailError}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) setEmailError("");
              }}
              placeholder="admin@perpustakaan.com"
              className="h-11"
            />

            {/* PASSWORD FIELD */}
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              label="Password"
              autoComplete="current-password"
              required
              value={password}
              error={passwordError}
              onChange={(event) => {
                setPassword(event.target.value);
                if (passwordError) setPasswordError("");
              }}
              placeholder="Masukkan kata sandi"
              className="h-11"
              endSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:text-text-main hover:bg-surface-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.75}
                      stroke="currentColor"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.75}
                      stroke="currentColor"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                    </svg>
                  )}
                </button>
              }
            />

            {/* ERROR FEEDBACK */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="12" />
                  <line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
                <p className="flex-1 leading-relaxed">{error}</p>
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <Button
                type="submit"
                loading={loading}
                disabled={loading}
                className="w-full h-11"
              >
                Masuk
              </Button>
            </div>
          </form>
        </div>

        {/* FOOTER TEXT */}
        <p className="mt-6 text-center text-xs text-text-muted">
          © {new Date().getFullYear()} BukuFlow. Sistem Perpustakaan Terpadu.
        </p>
      </div>
    </main>
  );
}