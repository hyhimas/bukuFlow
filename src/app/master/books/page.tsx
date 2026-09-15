"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import BackLink from "@/components/ui/BackLink";
import Card from "@/components/ui/Card";
import { getSession } from "@/lib/auth";
import { canAccessMasterData } from "@/lib/authorization";

export default function BooksPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    if (!canAccessMasterData(session.user.role)) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="page-container py-6">
        <BackLink href="/dashboard" />

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Master Buku & Copy Buku
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola data buku dan copy buku perpustakaan.
          </p>
        </div>

        <Card className="mt-6 p-6">
          <p className="text-sm text-slate-600">Data buku belum tersedia.</p>
        </Card>
      </div>
    </main>
  );
}
