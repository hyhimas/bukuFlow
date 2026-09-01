"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

import { login } from "@/lib/mock-api";
import { setSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await login(email, password);

      setSession(response.user);

      router.push("/dashboard");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat login.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm md:max-w-lg xl:max-w-xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-slate-900">
            BukuFlow
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Sistem manajemen perpustakaan
          </p>
        </div>

        <Card className="p-5 sm:p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Masuk
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Masukkan email dan password untuk melanjutkan.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="nama@bukuflow.id"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
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
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  {showPassword
                    ? "Sembunyikan"
                    : "Tampilkan"}
                </button>
              </div>

              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
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

        {process.env.NODE_ENV === "development" && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">
              Akun demo development
            </p>

            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p>Admin: admin@bukuflow.id</p>
              <p>Staff: staff@bukuflow.id</p>
              <p>Password: admin123</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
