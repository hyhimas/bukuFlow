"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import LoadingState from "@/components/ui/LoadingState";
import { getCompaniesApi } from "@/lib/api";
import type { Company } from "@/lib/types";

export const OFFICE_COMPANY_STORAGE_KEY = "bukuflow_office_selected_company_id";

export function getStoredOfficeCompanyId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(OFFICE_COMPANY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredOfficeCompanyId(companyId: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!companyId) {
      localStorage.removeItem(OFFICE_COMPANY_STORAGE_KEY);
    } else {
      localStorage.setItem(OFFICE_COMPANY_STORAGE_KEY, companyId);
    }
  } catch {
    // Ignore localStorage access restrictions if any
  }
}

export interface CompanySwitcherProps {
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  companies?: Company[];
  className?: string;
  size?: "default" | "sm";
}

function ChevronDownIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function CompanySwitcher({
  selectedCompanyId,
  onSelectCompany,
  companies: initialCompanies,
  className = "",
  size = "default",
}: CompanySwitcherProps) {
  const [fetchedCompanies, setFetchedCompanies] = useState<Company[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
    setPage(1);
  }, []);

  useEffect(() => {
    if (initialCompanies && initialCompanies.length > 0) return;

    let isMounted = true;
    getCompaniesApi()
      .then((comps) => {
        if (isMounted) {
          setFetchedCompanies(comps);
        }
      })
      .catch((err) => {
        console.warn("Daftar instansi belum tersedia di backend:", err?.message || err);
      });

    return () => {
      isMounted = false;
    };
  }, [initialCompanies]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const companies =
    initialCompanies && initialCompanies.length > 0
      ? initialCompanies
      : fetchedCompanies;

  const selectedCompany =
    companies.find((c) => c.id === selectedCompanyId) || null;

  const filteredCompanies = companies.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q))
    );
  });

  const totalItems = filteredCompanies.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginatedCompanies = filteredCompanies.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const isSmall = size === "sm";

  return (
    <div className={`relative w-full sm:w-auto ${className}`} ref={dropdownRef}>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          if (isOpen) {
            closeDropdown();
          } else {
            setIsOpen(true);
          }
        }}
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between gap-3 text-left ${
          isSmall
            ? "h-9 sm:w-64 px-3 py-1.5 text-xs font-semibold text-slate-800"
            : "h-auto sm:w-72 px-4 py-2.5"
        }`}
      >
        <div className="min-w-0 flex-1">
          {!isSmall && (
            <p className="text-xs font-medium text-slate-500">Instansi</p>
          )}
          <p
            className={`truncate font-semibold text-slate-900 ${
              isSmall ? "text-xs" : "text-sm"
            }`}
          >
            {selectedCompany ? selectedCompany.name : "Pilih instansi"}
          </p>
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </Button>

      {isOpen && (
        <div
          className={`absolute left-0 top-full z-50 mt-1.5 w-full min-w-[260px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-xl max-h-80 overflow-y-auto ${
            isSmall ? "sm:w-64" : "sm:w-72"
          }`}
        >
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Pilih Instansi</span>
            {companies.length > 0 && (
              <span className="text-[10px] lowercase font-normal text-slate-500">
                {companies.length} terdaftar
              </span>
            )}
          </div>

          {companies.length > 5 && (
            <div className="px-2 pb-1.5">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari nama atau inisial..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setPage(1);
                    }}
                    className="absolute right-2 flex h-4 w-4 items-center justify-center rounded-full text-xs text-slate-400 hover:bg-slate-200/60 hover:text-slate-600"
                    aria-label="Hapus kata pencarian"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-0.5 max-h-64 overflow-y-auto px-1.5 py-1">
            {paginatedCompanies.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-500">
                {searchQuery
                  ? "Instansi tidak ditemukan."
                  : "Tidak ada data instansi."}
              </div>
            ) : (
              paginatedCompanies.map((company) => {
                const isSelected = company.id === selectedCompanyId;
                return (
                  <Button
                    key={company.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStoredOfficeCompanyId(company.id);
                      onSelectCompany(company.id);
                      closeDropdown();
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left h-auto rounded-lg ${
                      isSelected
                        ? "bg-blue-50 font-semibold text-blue-700 hover:bg-blue-100/60"
                        : "text-slate-700 hover:bg-slate-100/70 font-normal"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-medium">
                        {company.name}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {company.code}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="shrink-0 text-blue-600">
                        <CheckIcon />
                      </span>
                    )}
                  </Button>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-600 bg-slate-50/70 rounded-b-xl">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Halaman sebelumnya"
                className="h-7 w-7 p-0 flex items-center justify-center text-slate-500 hover:bg-slate-200/60 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" />
                </svg>
              </Button>

              <span className="font-medium text-[11px] text-slate-600 tabular-nums">
                Halaman {safePage} dari {totalPages}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Halaman berikutnya"
                className="h-7 w-7 p-0 flex items-center justify-center text-slate-500 hover:bg-slate-200/60 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                </svg>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
