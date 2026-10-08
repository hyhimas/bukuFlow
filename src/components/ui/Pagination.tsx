"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  className?: string;
  disabled?: boolean;
  compact?: boolean;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  className = "",
  disabled = false,
  compact = false,
}: PaginationProps): ReactElement | null {
  const [sizeOpen, setSizeOpen] = useState(false);
  const [openDirection, setOpenDirection] = useState<"up" | "down">("up");
  const sizeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sizeContainerRef.current &&
        !sizeContainerRef.current.contains(event.target as Node)
      ) {
        setSizeOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!sizeOpen) return;
      if (event.key === "Escape") {
        setSizeOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [sizeOpen]);

  if (totalPages <= 0 && (totalItems === undefined || totalItems <= 0)) {
    return null;
  }

  const safeTotalPages = Math.max(1, totalPages || 1);
  const safeTotalItems =
    typeof totalItems === "number" && totalItems >= 0 ? totalItems : undefined;

  // Safe page clamping
  const safeCurrentPage = Math.min(
    Math.max(1, currentPage),
    safeTotalPages
  );

  // Calculate pages with ellipses for desktop & tablet
  function getPageItems(): (number | "...")[] {
    if (safeTotalPages <= 1) return [1];
    if (safeTotalPages <= 7) {
      return Array.from({ length: safeTotalPages }, (_, i) => i + 1);
    }

    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", safeTotalPages];
    }

    if (safeCurrentPage >= safeTotalPages - 3) {
      return [
        1,
        "...",
        safeTotalPages - 4,
        safeTotalPages - 3,
        safeTotalPages - 2,
        safeTotalPages - 1,
        safeTotalPages,
      ];
    }

    return [
      1,
      "...",
      safeCurrentPage - 1,
      safeCurrentPage,
      safeCurrentPage + 1,
      "...",
      safeTotalPages,
    ];
  }

  const pageItems = getPageItems();

  const startItem =
    pageSize && safeTotalItems !== undefined
      ? (safeCurrentPage - 1) * pageSize + 1
      : undefined;
  const endItem =
    pageSize && safeTotalItems !== undefined
      ? Math.min(safeCurrentPage * pageSize, safeTotalItems)
      : undefined;

  const displayedItemsCount =
    startItem !== undefined && endItem !== undefined
      ? Math.max(0, endItem - startItem + 1)
      : pageSize;

  const handleToggleSize = () => {
    if (disabled) return;
    if (!sizeOpen && sizeContainerRef.current) {
      const rect = sizeContainerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Jika data yang tampil sedikit (< 5 baris), buka ke bawah agar tidak menabrak header tabel.
      // Jika data yang tampil banyak (>= 5 baris), buka ke atas karena ruang di atasnya luas.
      if (displayedItemsCount < 5) {
        if (spaceBelow >= 180 || spaceBelow > spaceAbove) {
          setOpenDirection("down");
        } else {
          setOpenDirection("up");
        }
      } else {
        if (spaceAbove >= 180 || spaceAbove >= spaceBelow) {
          setOpenDirection("up");
        } else {
          setOpenDirection("down");
        }
      }
    }
    setSizeOpen((prev) => !prev);
  };

  if (compact) {
    return (
      <nav
        aria-label="Navigasi Halaman"
        className={`flex items-center justify-between gap-2 py-1 text-xs ${className}`}
      >
        <p className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
          {totalItems !== undefined && startItem && endItem
            ? `${startItem}-${endItem} dari ${totalItems}`
            : `Halaman ${safeCurrentPage} dari ${totalPages}`}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={safeCurrentPage <= 1 || disabled}
              onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
              aria-label="Halaman sebelumnya"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            <div className="flex items-center gap-0.5">
              {pageItems.map((item, idx) => {
                if (item === "...") {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="flex h-7 w-4 select-none items-center justify-center text-[10px] font-bold text-slate-400"
                    >
                      …
                    </span>
                  );
                }

                const isCurrent = item === safeCurrentPage;

                return (
                  <button
                    key={`page-${item}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPageChange(item)}
                    aria-current={isCurrent ? "page" : undefined}
                    className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-xs font-semibold transition ${
                      isCurrent
                        ? "bg-blue-600 text-white shadow-xs"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={safeCurrentPage >= totalPages || disabled}
              onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
              aria-label="Halaman berikutnya"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Navigasi Halaman"
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200 bg-white px-3.5 py-3 sm:px-5 sm:py-3.5 ${className}`}
    >
      {/* =========================================================
          KIRI: SIZE SELECTOR & INFO DATA
      ========================================================= */}
      <div className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-2 text-xs text-slate-600 sm:text-sm shrink-0">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
            <span className="font-medium whitespace-nowrap">Tampilkan</span>
            <div ref={sizeContainerRef} className="relative inline-flex items-center">
              <button
                type="button"
                disabled={disabled}
                aria-label="Pilih jumlah data per halaman"
                aria-haspopup="listbox"
                aria-expanded={sizeOpen}
                onClick={handleToggleSize}
                className={`inline-flex h-8 items-center justify-between gap-1.5 rounded-lg border bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-2xs transition-all ${
                  sizeOpen
                    ? "border-blue-600 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span>{pageSize}</span>
                <svg
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                    sizeOpen ? "rotate-180 text-blue-600" : ""
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {sizeOpen && !disabled && (
                <div
                  role="listbox"
                  aria-label="Pilihan jumlah data per halaman"
                  className={`absolute left-0 z-50 min-w-[76px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95 duration-100 ${
                    openDirection === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5"
                  }`}
                >
                  {pageSizeOptions.map((opt) => {
                    const isSelected = opt === pageSize;
                    return (
                      <button
                        key={opt}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onPageSizeChange(opt);
                          setSizeOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                          isSelected
                            ? "bg-blue-50 font-bold text-blue-600"
                            : "font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span>{opt}</span>
                        {isSelected && (
                          <svg
                            className="h-3.5 w-3.5 shrink-0 text-blue-600"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <span className="hidden sm:inline mx-0.5 text-slate-300 shrink-0">•</span>
          </div>
        )}

        {totalItems !== undefined && startItem && endItem ? (
          <p className="leading-5 text-slate-500 whitespace-nowrap shrink-0 text-right sm:text-left text-xs sm:text-sm">
            {onPageSizeChange ? "" : "Menampilkan "}
            <span className="font-semibold text-slate-700">{startItem}</span> -{" "}
            <span className="font-semibold text-slate-700">{endItem}</span> dari{" "}
            <span className="font-semibold text-slate-700">{totalItems}</span> data
          </p>
        ) : (
          <p className="leading-5 text-slate-500 whitespace-nowrap shrink-0 text-right sm:text-left text-xs sm:text-sm">
            Halaman <span className="font-semibold text-slate-700">{safeCurrentPage}</span> dari{" "}
            <span className="font-semibold text-slate-700">{totalPages}</span>
          </p>
        )}
      </div>

      {/* =========================================================
          KANAN: KONTROL TOMBOL NAVIGASI
      ========================================================= */}
      {totalPages > 1 && (
        <div className="flex w-full sm:w-auto items-center justify-center sm:justify-end gap-1.5 shrink-0">
          {/* TOMBOL SEBELUMNYA */}
          <button
            type="button"
            disabled={safeCurrentPage <= 1 || disabled}
            onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
            aria-label="Halaman sebelumnya"
            className="flex h-8.5 min-w-8.5 sm:h-8 sm:min-w-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 sm:px-2.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden md:inline">Sebelumnya</span>
          </button>

          {/* NOMOR HALAMAN */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {pageItems.map((item, idx) => {
              if (item === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="flex h-8.5 w-6 sm:h-8 select-none items-center justify-center text-xs font-bold text-slate-400 sm:w-7"
                    aria-hidden="true"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = item === safeCurrentPage;

              return (
                <button
                  key={`page-${item}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPageChange(item)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`flex h-8.5 min-w-8.5 sm:h-8 sm:min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isCurrent
                      ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-600"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {/* TOMBOL BERIKUTNYA */}
          <button
            type="button"
            disabled={safeCurrentPage >= totalPages || disabled}
            onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
            aria-label="Halaman berikutnya"
            className="flex h-8.5 min-w-8.5 sm:h-8 sm:min-w-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 sm:px-2.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="hidden md:inline">Berikutnya</span>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}
    </nav>
  );
}

