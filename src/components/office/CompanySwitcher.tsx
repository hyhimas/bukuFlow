"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import LoadingState from "@/components/ui/LoadingState";
import { getCompaniesPaginatedApi } from "@/lib/api";
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
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverTotalItems, setServerTotalItems] = useState(0);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [cachedMap, setCachedMap] = useState<Record<string, Company>>({});
  const savedTotalRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeReqIdRef = useRef(0);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
  }, []);

  useEffect(() => {
    if (initialCompanies && initialCompanies.length > 0) {
      setCompanyLoading(false);
      return;
    }

    const reqId = ++activeReqIdRef.current;
    setCompanyLoading(true);

    getCompaniesPaginatedApi({ page, size: PAGE_SIZE, sortby: "name", order: "asc" })
      .then((res) => {
        if (reqId !== activeReqIdRef.current) return;
        const items = res.items || [];
        setFetchedCompanies(items);

        setCachedMap((prev) => {
          const next = { ...prev };
          items.forEach((c) => {
            next[c.id] = c;
          });
          return next;
        });

        if (typeof res.total === "number" && res.total >= 0) {
          savedTotalRef.current = res.total;
          setServerTotalItems(res.total);
          setServerTotalPages(Math.max(1, Math.ceil(res.total / PAGE_SIZE)));
        } else if (savedTotalRef.current > 0) {
          setServerTotalItems(savedTotalRef.current);
          setServerTotalPages(Math.max(1, Math.ceil(savedTotalRef.current / PAGE_SIZE)));
        } else {
          setServerTotalPages(res.totalPages || 1);
        }
      })
      .catch((err) => {
        if (reqId !== activeReqIdRef.current) return;
        console.warn("Daftar instansi belum tersedia di backend:", err?.message || err);
      })
      .finally(() => {
        if (reqId === activeReqIdRef.current) {
          setCompanyLoading(false);
        }
      });
  }, [initialCompanies, page]);

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
    companies.find((c) => c.id === selectedCompanyId) ||
    cachedMap[selectedCompanyId] ||
    null;

  const isServerPaginated = !initialCompanies || initialCompanies.length === 0;

  const filteredCompanies = companies
    .filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, "id-ID", { sensitivity: "base" }));

  const totalItems = isServerPaginated
    ? (serverTotalItems > 0 ? serverTotalItems : filteredCompanies.length)
    : filteredCompanies.length;
  const totalPages = isServerPaginated
    ? Math.max(1, serverTotalPages)
    : Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginatedCompanies = isServerPaginated
    ? filteredCompanies
    : filteredCompanies.slice(
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
            ? "h-9 sm:w-64 px-3 py-1.5 text-xs font-semibold text-text-main"
            : "h-auto sm:w-72 px-4 py-2.5"
        }`}
      >
        <div className="min-w-0 flex-1">
          {!isSmall && (
            <p className="text-xs font-medium text-text-muted">Instansi</p>
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            <p
              className={`truncate font-semibold text-text-main ${
                isSmall ? "text-xs" : "text-sm"
              }`}
            >
              {selectedCompany ? selectedCompany.name : "Pilih instansi"}
            </p>
            {selectedCompany?.status === "INACTIVE" && (
              <span className="shrink-0 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5">
                Nonaktif
              </span>
            )}
          </div>
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-text-subtle transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </Button>

      {isOpen && (
        <div
          className={`absolute left-0 top-full z-50 mt-1.5 w-full min-w-[260px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface shadow-xl max-h-80 overflow-y-auto ${
            isSmall ? "sm:w-64" : "sm:w-72"
          }`}
        >
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            <span>Pilih Instansi</span>
            {companies.length > 0 && (
              <span className="text-[10px] lowercase font-normal text-text-muted">
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
                  className="w-full rounded-lg border border-border bg-surface-subtle px-2.5 py-1.5 text-xs text-text-main placeholder:text-text-subtle focus:border-blue-500 focus:bg-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setPage(1);
                    }}
                    className="absolute right-2 flex h-4 w-4 items-center justify-center rounded-full text-xs text-text-subtle hover:bg-surface-muted hover:text-text-secondary"
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
              <div className="px-3 py-4 text-center text-xs text-text-muted">
                {companyLoading
                  ? "Memuat daftar instansi..."
                  : searchQuery
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
                        : "text-text-secondary hover:bg-surface-muted/70 font-normal"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="truncate text-xs sm:text-sm font-medium">
                          {company.name}
                        </p>
                        {company.status === "INACTIVE" && (
                          <span className="shrink-0 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.2">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-text-muted">
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
            <div className="flex items-center justify-between border-t border-border-subtle px-3 py-2 text-xs text-text-secondary bg-surface-subtle rounded-b-xl">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={safePage <= 1 || companyLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Halaman sebelumnya"
                className="h-7 w-7 p-0 flex items-center justify-center text-text-muted hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent"
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

              <span className="font-medium text-[11px] text-text-secondary tabular-nums">
                {companyLoading
                  ? "Memuat..."
                  : `Halaman ${safePage} dari ${totalPages}`}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={safePage >= totalPages || companyLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Halaman berikutnya"
                className="h-7 w-7 p-0 flex items-center justify-center text-text-muted hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent"
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
