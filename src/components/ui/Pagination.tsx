import type { ReactElement } from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
  disabled?: boolean;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className = "",
  disabled = false,
}: PaginationProps): ReactElement | null {
  if (totalPages <= 1) return null;

  // Safe page clamping
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Calculate pages with ellipses for desktop & tablet
  function getPageItems(): (number | "...")[] {
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

  return (
    <nav
      aria-label="Navigasi Halaman"
      className={`flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5 ${className}`}
    >
      {/* =========================================================
          INFO TEKS (RESPONSIF MOBILE / TABLET / DESKTOP)
      ========================================================= */}
      <div className="flex items-center justify-between text-xs text-slate-500 sm:justify-start sm:text-sm">
        {totalItems !== undefined && startItem && endItem ? (
          <p className="leading-5">
            Menampilkan <span className="font-semibold text-slate-700">{startItem}</span> -{" "}
            <span className="font-semibold text-slate-700">{endItem}</span> dari{" "}
            <span className="font-semibold text-slate-700">{totalItems}</span> data
          </p>
        ) : (
          <p className="leading-5">
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
          KONTROL TOMBOL NAVIGASI
      ========================================================= */}
      <div className="flex items-center justify-between gap-1.5 sm:justify-end sm:gap-1">
        {/* TOMBOL SEBELUMNYA */}
        <button
          type="button"
          disabled={safeCurrentPage <= 1 || disabled}
          onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
          aria-label="Halaman sebelumnya"
          className="flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:px-2.5"
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

        {/* NOMOR HALAMAN (TABLET & DESKTOP + COMPACT DI MOBILE) */}
        <div className="flex items-center gap-1">
          {pageItems.map((item, idx) => {
            if (item === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="flex h-9 w-6 select-none items-center justify-center text-xs font-bold text-slate-400 sm:h-8 sm:w-7"
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
                className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:h-8 sm:min-w-8 ${
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
          className="flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:px-2.5"
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
    </nav>
  );
}

