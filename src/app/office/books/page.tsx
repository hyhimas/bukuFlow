"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackLink from "@/components/ui/BackLink";
import Card from "@/components/ui/Card";
import LoadingState from "@/components/ui/LoadingState";
import { getSession } from "@/lib/auth";

export default function OfficeBooksPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  // 1. Guard Authentication Super Admin
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

    setCheckingAuth(false);
  }, [router]);

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-slate-50">
        <LoadingState label="Memeriksa otorisasi Super Admin..." />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Tombol Navigasi Kembali */}
        <div className="mb-4">
          <BackLink href="/office/dashboard">Kembali ke Dashboard Office</BackLink>
        </div>

        {/* Header Halaman */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Kelola Buku (Office)
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Katalog dan manajemen master buku lintas instansi perpustakaan.
            </p>
          </div>
        </div>

        {/* Tempat kode konten manual Anda */}
        <Card className="mt-6 p-8 text-center">
          <p className="text-slate-500 text-sm">
            Halaman ini siap untuk ditulis kode pengelolaan buku secara manual.
          </p>
        </Card>
      </div>
    </main>
  );
}

