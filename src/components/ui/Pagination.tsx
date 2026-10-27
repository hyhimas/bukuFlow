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

  // Desktop pages calculation (max 7 slots: ensures predictable width regardless of page count)
  function getDesktopPageItems(): (number | "...")[] {
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

  // Mobile / narrow view calculation (max 5 slots: guaranteed to never overflow on mobile devices)
  function getMobilePageItems(): (number | "...")[] {
    if (safeTotalPages <= 1) return [1];
    if (safeTotalPages <= 4) {
      return Array.from({ length: safeTotalPages }, (_, i) => i + 1);
    }

    if (safeCurrentPage <= 2) {
      return [1, 2, 3, "...", safeTotalPages];
    }

    if (safeCurrentPage >= safeTotalPages - 1) {
      return [
        1,
        "...",
        safeTotalPages - 2,
        safeTotalPages - 1,
        safeTotalPages,
      ];
    }

    return [
      1,
      "...",
      safeCurrentPage,
      "...",
      safeTotalPages,
    ];
  }

  const desktopPageItems = getDesktopPageItems();
  const mobilePageItems = getMobilePageItems();

  const startItem =
    pageSize && safeTotalItems !== undefined
      ? (safeCurrentPage - 1) * pageSize + 1
      : undefined;
  const endItem =
    pageSize && safeTotalItems !== undefined
      ? Math.min(safeCurrentPage * pageSize, safeTotalItems)
      : undefined;

  const handleToggleSize = () => {
    if (disabled) return;
    if (!sizeOpen && sizeContainerRef.current) {
      const rect = sizeContainerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Dropdown di footer tabel default buka ke atas (dropup) agar tidak terpotong
      // oleh batas bawah kartu atau viewport. Buka ke bawah hanya jika ruang atas sangat terbatas.
      if (spaceAbove < 180 && spaceBelow >= 180) {
        setOpenDirection("down");
      } else {
        setOpenDirection("up");
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
        <p className="text-xs font-medium text-text-muted whitespace-nowrap">
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
              className="flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition hover:bg-surface-muted hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            <div className="flex items-center gap-1">
              {mobilePageItems.map((item, idx) => {
                if (item === "...") {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="flex h-10 w-4 min-h-[40px] select-none items-center justify-center text-xs font-bold text-text-muted"
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
                    className={`flex h-10 min-w-10 min-h-[40px] items-center justify-center rounded-lg px-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isCurrent
                        ? "bg-blue-600 text-white shadow-xs"
                        : "border border-border bg-surface text-text-secondary hover:bg-surface-muted"
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
              className="flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition hover:bg-surface-muted hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
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
      className={`flex flex-wrap items-center justify-between gap-y-2.5 gap-x-3 border-t border-border bg-surface px-3.5 py-3 sm:px-5 sm:py-3.5 rounded-b-xl ${className}`}
    >
      {/* =========================================================
          KIRI: SIZE SELECTOR & INFO DATA
      ========================================================= */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary sm:text-sm">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="font-medium whitespace-nowrap">Tampilkan</span>
            <div ref={sizeContainerRef} className="relative inline-flex items-center">
              <button
                type="button"
                disabled={disabled}
                aria-label={`${pageSize}, pilih jumlah data per halaman`}
                aria-haspopup="listbox"
                aria-expanded={sizeOpen}
                onClick={handleToggleSize}
                className={`inline-flex h-8 items-center justify-between gap-1.5 rounded-lg border bg-surface px-2.5 text-xs font-semibold text-text-main shadow-2xs transition-all ${
                  sizeOpen
                    ? "border-blue-600 ring-2 ring-blue-100"
                    : "border-border hover:border-border hover:bg-surface-muted"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span>{pageSize}</span>
                <svg
                  className={`h-3.5 w-3.5 text-text-subtle transition-transform duration-200 ${
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
                  className={`absolute left-0 z-50 min-w-[76px] overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95 duration-100 ${
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
                            : "font-medium text-text-secondary hover:bg-surface-muted hover:text-text-main"
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
                            aria-hidden="true"
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
            <span className="hidden sm:inline mx-0.5 text-text-subtle shrink-0 select-none" aria-hidden="true">&bull;</span>
          </div>
        )}

        {totalItems !== undefined && startItem && endItem ? (
          <p className="leading-5 text-text-muted whitespace-nowrap text-xs sm:text-sm">
            {onPageSizeChange ? "" : "Menampilkan "}
            <span className="font-semibold text-text-secondary">{startItem}</span> -{" "}
            <span className="font-semibold text-text-secondary">{endItem}</span> dari{" "}
            <span className="font-semibold text-text-secondary">{totalItems}</span> data
          </p>
        ) : (
          <p className="leading-5 text-text-muted whitespace-nowrap text-xs sm:text-sm">
            Halaman <span className="font-semibold text-text-secondary">{safeCurrentPage}</span> dari{" "}
            <span className="font-semibold text-text-secondary">{totalPages}</span>
          </p>
        )}
      </div>

      {/* =========================================================
          KANAN: KONTROL TOMBOL NAVIGASI
      ========================================================= */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-1 sm:gap-1.5 ml-auto sm:ml-0 shrink-0 max-w-full overflow-x-auto py-0.5">
          {/* TOMBOL SEBELUMNYA */}
          <button
            type="button"
            disabled={safeCurrentPage <= 1 || disabled}
            onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
            aria-label="Halaman sebelumnya"
            className="flex h-10 min-w-10 min-h-[40px] sm:h-9 sm:min-w-9 sm:min-h-[36px] items-center justify-center gap-1 rounded-lg border border-border bg-surface px-2 sm:px-2.5 text-xs font-medium text-text-secondary shadow-2xs transition hover:bg-surface-muted hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden 2xl:inline">Sebelumnya</span>
          </button>

          {/* NOMOR HALAMAN (MOBILE: < sm, MAX 5 ITEMS) */}
          <div className="flex items-center gap-1 sm:hidden">
            {mobilePageItems.map((item, idx) => {
              if (item === "...") {
                return (
                  <span
                    key={`m-ellipsis-${idx}`}
                    className="flex h-10 w-4 min-h-[40px] select-none items-center justify-center text-xs font-bold text-text-muted"
                    aria-hidden="true"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = item === safeCurrentPage;

              return (
                <button
                  key={`m-page-${item}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPageChange(item)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`flex h-10 min-w-10 min-h-[40px] items-center justify-center rounded-lg px-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isCurrent
                      ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-600"
                      : "border border-border bg-surface text-text-secondary hover:border-border hover:bg-surface-muted"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {/* NOMOR HALAMAN (TABLET & DESKTOP: >= sm, MAX 7 ITEMS) */}
          <div className="hidden sm:flex items-center gap-1 sm:gap-1.5">
            {desktopPageItems.map((item, idx) => {
              if (item === "...") {
                return (
                  <span
                    key={`d-ellipsis-${idx}`}
                    className="flex h-10 w-5 sm:h-9 min-h-[40px] sm:min-h-[36px] select-none items-center justify-center text-xs font-bold text-text-muted sm:w-6"
                    aria-hidden="true"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = item === safeCurrentPage;

              return (
                <button
                  key={`d-page-${item}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPageChange(item)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`flex h-10 min-w-10 min-h-[40px] sm:h-9 sm:min-w-9 sm:min-h-[36px] items-center justify-center rounded-lg px-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isCurrent
                      ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-600"
                      : "border border-border bg-surface text-text-secondary hover:border-border hover:bg-surface-muted"
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
            className="flex h-10 min-w-10 min-h-[40px] sm:h-9 sm:min-w-9 sm:min-h-[36px] items-center justify-center gap-1 rounded-lg border border-border bg-surface px-2 sm:px-2.5 text-xs font-medium text-text-secondary shadow-2xs transition hover:bg-surface-muted hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="hidden 2xl:inline">Berikutnya</span>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0"
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

