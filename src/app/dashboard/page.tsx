"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

import { clearSession, getSession } from "@/lib/auth";
import { getDashboard } from "@/lib/mock-api";
import type { Loan, UserRole } from "@/lib/types";

interface DashboardData {
  booksAvailable: number;
  booksBorrowed: number;
  activeLoans: number;
  overdueLoans: number;
  recentLoans: Loan[];
}

const statusLabel: Record<Loan["status"], string> = {
  ACTIVE: "Aktif",
  OVERDUE: "Terlambat",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

function getStatusVariant(
  status: Loan["status"],
): "success" | "warning" | "danger" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "OVERDUE") return "warning";
  if (status === "CANCELLED") return "danger";

  return "neutral";
}

export default function DashboardPage() {
  const router = useRouter();

  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const session = getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setRole(session.user.role);
      setName(session.user.name);

      try {
        const result = await getDashboard();
        setData(result);
      } catch {
        setError("Data dashboard gagal dimuat.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-sm text-slate-500">
            Memuat dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-lg font-semibold text-slate-900">
            Dashboard tidak dapat dimuat
          </h1>

          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>
        </Card>
      </main>
    );
  }

  const isCompanyAdmin = role === "COMPANY_ADMIN";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              BukuFlow
            </h1>

            <p className="text-sm text-slate-500">
              {isCompanyAdmin
                ? "Dashboard Company"
                : "Dashboard Operasional"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">
                {name}
              </p>

              <p className="text-xs text-slate-500">
                {isCompanyAdmin ? "Admin Company" : "Petugas"}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            Selamat datang, {name}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Ringkasan operasional perpustakaan.
          </p>
        </div>

        <section
          aria-label="Ringkasan perpustakaan"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Card className="p-5">
            <p className="text-sm text-slate-500">
              Buku tersedia
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {data.booksAvailable}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-slate-500">
              Buku sedang dipinjam
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {data.booksBorrowed}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-slate-500">
              Transaksi aktif
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {data.activeLoans}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-slate-500">
              Transaksi terlambat
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {data.overdueLoans}
            </p>
          </Card>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Akses cepat
          </h2>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <a
              href="/loans/new"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <h3 className="font-semibold text-slate-900">
                Catat Peminjaman
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Catat transaksi peminjaman buku.
              </p>
            </a>

            <a
              href="/returns"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <h3 className="font-semibold text-slate-900">
                Catat Pengembalian
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Proses pengembalian buku.
              </p>
            </a>
          </div>
        </section>

        {isCompanyAdmin && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Administrasi
            </h2>

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <a
                href="/settings/users"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"
              >
                <h3 className="font-semibold text-slate-900">
                  Pengguna
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Kelola pengguna company.
                </p>
              </a>

              <a
                href="/settings/company"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"
              >
                <h3 className="font-semibold text-slate-900">
                  Company
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Kelola informasi company.
                </p>
              </a>

              <a
                href="/transactions"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"
              >
                <h3 className="font-semibold text-slate-900">
                  Riwayat Transaksi
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Lihat riwayat transaksi.
                </p>
              </a>
            </div>
          </section>
        )}

        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">
              Aktivitas Terbaru
            </h2>
          </div>

          {data.recentLoans.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-medium text-slate-700">
                Belum ada aktivitas transaksi
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Aktivitas transaksi terbaru akan muncul di sini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {loan.loanNumber}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Jatuh tempo{" "}
                      {new Date(
                        loan.dueAt,
                      ).toLocaleDateString("id-ID")}
                    </p>
                  </div>

                  <Badge variant={getStatusVariant(loan.status)}>
                    {statusLabel[loan.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}