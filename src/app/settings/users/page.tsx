"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import BackLink from "@/components/ui/BackLink";

import { getSession } from "@/lib/auth";
import { canAccessUserManagement } from "@/lib/authorization";

export default function UsersSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getSession();

    if (!session || !canAccessUserManagement()) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50">

      <div className="page-container py-6">
        <BackLink href="/dashboard" />

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Pengguna
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Pengelolaan pengguna dan akses sistem.
          </p>
        </div>

        <Card className="mt-6 p-6">
          <h2 className="font-semibold text-slate-900">
            Fitur belum tersedia
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Halaman pengelolaan pengguna belum tersedia pada versi MVP ini.
          </p>
        </Card>
      </div>
    </main>
  );
}
