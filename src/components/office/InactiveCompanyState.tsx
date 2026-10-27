"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export function isCompanyInactiveError(errorMessage?: string): boolean {
  if (!errorMessage) return false;
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("inactive") ||
    lower.includes("nonaktif") ||
    lower.includes("tidak aktif") ||
    lower.includes("not active") ||
    lower.includes("suspended") ||
    lower.includes("ditangguhkan") ||
    lower.includes("status non-aktif")
  );
}

export function isStoredCompanyInactive(companyId?: string): boolean {
  if (!companyId || typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("bukuflow_company_meta_map");
    if (!raw) return false;
    const map = JSON.parse(raw);
    const meta = map[companyId];
    if (meta && meta.isActive === false) return true;
  } catch {
    return false;
  }
  return false;
}

export interface InactiveCompanyStateProps {
  companyName?: string;
  description?: string;
  className?: string;
}

export default function InactiveCompanyState({
  companyName = "Instansi ini",
  description = "Akses data operasional, katalog buku, transaksi, dan anggota ditangguhkan karena instansi ini sedang dalam status nonaktif.",
  className = "",
}: InactiveCompanyStateProps) {
  return (
    <Card
      className={`p-8 sm:p-12 text-center border-amber-200 bg-amber-50/40 ${className}`}
      role="status"
      aria-label="Instansi berstatus nonaktif"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-2xs">
        <svg
          className="h-7 w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <h3 className="text-lg font-bold text-amber-950">
          Instansi Sedang Dalam Status Nonaktif
        </h3>
        <span className="rounded-full bg-amber-200 text-amber-900 text-xs font-bold px-2.5 py-0.5">
          Nonaktif
        </span>
      </div>

      <p className="mx-auto mt-2 max-w-lg text-sm text-amber-800 leading-relaxed">
        {companyName !== "Instansi ini" && (
          <strong className="font-semibold text-amber-900 block mb-0.5">
            {companyName}
          </strong>
        )}
        {description}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/office/companies">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white border-transparent shadow-xs"
          >
            <svg
              className="mr-1.5 h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Kelola Status di Menu Instansi
          </Button>
        </Link>
      </div>
    </Card>
  );
}

