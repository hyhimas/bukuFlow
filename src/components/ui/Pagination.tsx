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
}

export function calculateNewPageOnSizeChange(
  currentPage: number,
  currentSize: number,
  newSize: number,
  totalItems?: number
): number {
  if (currentSize <= 0 || newSize <= 0) return 1;
  const currentFirstItem = (Math.max(1, currentPage) - 1) * currentSize + 1;
  const newPage = Math.floor((currentFirstItem - 1) / newSize) + 1;
  if (totalItems !== undefined && totalItems > 0) {
    const newTotalPages = Math.max(1, Math.ceil(totalItems / newSize));
    return Math.max(1, Math.min(newPage, newTotalPages));
  }
  return Math.max(1, newPage);
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

  // Safe page clamping
  const safeCurrentPage = Math.min(
    Math.max(1, currentPage),
    Math.max(1, totalPages)
  );

  // Calculate pages with ellipses for desktop & tablet
  function getPageItems(): (number | "...")[] {
    if (totalPages <= 1) return [1];
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }

    if (safeCurrentPage >= totalPages - 3) {
      return [
        1,
        "...",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "...",
      safeCurrentPage - 1,
      safeCurrentPage,
      safeCurrentPage + 1,
      "...",
      totalPages,
    ];
  }

  const pageItems = getPageItems();

  const startItem =
    pageSize && totalItems
      ? (safeCurrentPage - 1) * pageSize + 1
      : undefined;
  const endItem =
    pageSize && totalItems
      ? Math.min(safeCurrentPage * pageSize, totalItems)
      : undefined;

  const displayedItemsCount =
    startItem !== undefined && endItem !== undefined
      ? endItem - startItem + 1
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

  return (
    <nav
      aria-label="Navigasi Halaman"
      className={`flex flex-col gap-3 border-t border-slate-200 bg-white px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5 ${className}`}
    >
      {/* =========================================================
          KIRI: SIZE SELECTOR & INFO DATA
      ========================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-600 sm:justify-start sm:text-sm">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium whitespace-nowrap">Tampilkan</span>
            <div ref={sizeContainerRef} className="relative inline-flex items-center">
              <button
                type="button"
                disabled={disabled}
                aria-label="Pilih jumlah data per halaman"
                aria-haspopup="listbox"
                aria-expanded={sizeOpen}
                onClick={handleToggleSize}
                className={`inline-flex h-8 items-center justify-between gap-2 rounded-lg border bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-2xs transition-all ${
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
                          const newPage = calculateNewPageOnSizeChange(
                            safeCurrentPage,
                            pageSize,
                            opt,
                            totalItems
                          );
                          onPageSizeChange(opt);
                          if (newPage !== safeCurrentPage) {
                            onPageChange(newPage);
                          }
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
            <span className="mx-1 hidden text-slate-300 sm:inline">•</span>
          </div>
        )}

        {totalItems !== undefined && startItem && endItem ? (
          <p className="leading-5 text-slate-500">
            {onPageSizeChange ? "" : "Menampilkan "}
            <span className="font-semibold text-slate-700">{startItem}</span> -{" "}
            <span className="font-semibold text-slate-700">{endItem}</span> dari{" "}
            <span className="font-semibold text-slate-700">{totalItems}</span> data
          </p>
        ) : (
          <p className="leading-5 text-slate-500">
            Halaman <span className="font-semibold text-slate-700">{safeCurrentPage}</span> dari{" "}
            <span className="font-semibold text-slate-700">{totalPages}</span>
          </p>
        )}

        {/* Indikator singkat khusus layar sangat kecil (mobile) */}
        <span className="font-medium text-slate-400 sm:hidden">
          {safeCurrentPage} / {totalPages}
        </span>
      </div>

      {/* =========================================================
          KANAN: KONTROL TOMBOL NAVIGASI
      ========================================================= */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center sm:justify-end gap-1.5 sm:gap-1 w-full sm:w-auto">
          {/* TOMBOL SEBELUMNYA */}
          <button
            type="button"
            disabled={safeCurrentPage <= 1 || disabled}
            onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
            aria-label="Halaman sebelumnya"
            className="flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
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
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>

          {/* NOMOR HALAMAN */}
          <div className="flex items-center gap-1">
            {pageItems.map((item, idx) => {
              if (item === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="flex h-8 w-6 select-none items-center justify-center text-xs font-bold text-slate-400 sm:w-7"
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
                  className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
            className="flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="hidden sm:inline">Berikutnya</span>
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

