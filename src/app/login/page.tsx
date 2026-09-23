"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

import { loginApi } from "@/lib/api";
import { getAuthData, saveAuthData } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const auth = getAuthData();
    if (auth) {
      router.replace("/dashboard");
    } else {
      setCheckingAuth(false);
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await loginApi(email, password);

      const user = response.data;
      const userToSave = {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.email,
        role: user.role,
        companyId: user.companyId || "company-001",
        status: "ACTIVE" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      saveAuthData({
        accessToken: response.access_token,
        tokenType: response.token_type,
        user: userToSave,
      });

      router.replace("/dashboard");
    } catch (err: any) {
      const message =
        err.response?.data?.detail ||
        err.message ||
        "Email atau password salah.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm md:max-w-lg xl:max-w-xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-slate-900">BukuFlow</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sistem manajemen perpustakaan
          </p>
        </div>

        <Card className="p-5 sm:p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Masuk</h2>
            <p className="mt-1 text-sm text-slate-500">
              Masukkan email dan password untuk melanjutkan.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="nama@bukuflow.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-700"
                >
                  Password
                </label>

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  {showPassword ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>

              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Masukkan password"
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              disabled={!email || !password}
              className="w-full"
            >
              Masuk
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}