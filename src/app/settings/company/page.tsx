"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import BackLink from "@/components/ui/BackLink";

import { getSession } from "@/lib/auth";
import { canAccessCompanySettings } from "@/lib/authorization";

export default function CompanySettingsPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getSession();

    if (!session || !canAccessCompanySettings()) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="page-container py-6">
        <BackLink href="/dashboard" />

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Company
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Pengaturan informasi company.
          </p>
        </div>

        <Card className="mt-6 p-6">
          <h2 className="font-semibold text-slate-900">
            Fitur belum tersedia
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Halaman pengaturan company belum tersedia pada versi MVP ini.
          </p>
        </Card>
      </div>
    </main>
  );
}
