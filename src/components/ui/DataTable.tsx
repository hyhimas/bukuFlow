"use client";

import { type ReactNode } from "react";
import Card from "./Card";
import Button from "./Button";
import { TableSkeleton } from "./Skeleton";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  sortKey?: string;
  isNumeric?: boolean;
  className?: string;
  headerClassName?: string;
  render?: (item: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
  rows?: T[];
  data?: T[];
  columns: DataTableColumn<T>[];
  keyExtractor?: (item: T, index: number) => string | number;
  emptyState?: ReactNode;
  loading?: boolean;
  loadingMessage?: string;
  sortBy?: string;
  order?: "asc" | "desc";
  sortOrder?: "asc" | "desc";
  onSortChange?: (sortKey: string) => void;
  onSort?: (sortKey: string) => void;
  rowActions?: (item: T, index: number) => ReactNode;
  renderMobileCard?: (item: T, index: number) => ReactNode;
  className?: string;
  tableClassName?: string;
  rowClassName?: (item: T, index: number) => string;
  mobileBreakpoint?: "lg" | "xl";
  cardGridClassName?: string;
}

export default function DataTable<T>({
  rows,
  data,
  columns,
  keyExtractor = (_item, idx) => idx,
  emptyState,
  loading = false,
  loadingMessage = "Memuat data...",
  sortBy,
  order,
  sortOrder,
  onSortChange,
  onSort,
  rowActions,
  renderMobileCard,
  className = "",
  tableClassName = "",
  rowClassName,
  mobileBreakpoint = "lg",
  cardGridClassName = "",
}: DataTableProps<T>) {
  const items = rows ?? data ?? [];
  const activeSortBy = sortBy;
  const activeOrder = order ?? sortOrder ?? "asc";
  const handleSort = onSortChange ?? onSort;

  // Initial loading with no items: show TableSkeleton
  if (loading && items.length === 0) {
    return (
      <Card className={`overflow-hidden ${className}`}>
        <TableSkeleton cols={columns.length} rows={5} />
      </Card>
    );
  }

  // Empty state with no loading
  if (items.length === 0 && !loading) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <Card className={`p-8 text-center text-text-muted text-sm ${className}`}>
        Tidak ada data ditemukan.
      </Card>
    );
  }

  const desktopDisplayClass =
    mobileBreakpoint === "xl" ? "hidden xl:block" : "hidden lg:block";
  const mobileDisplayClass =
    mobileBreakpoint === "xl" ? "xl:hidden" : "lg:hidden";

  return (
    <div className={`relative ${className}`}>
      {/* DESKTOP TABLE */}
      <div className={`relative overflow-x-auto rounded-t-xl ${desktopDisplayClass}`}>
        <table
          className={`w-full table-fixed text-left text-sm text-text-secondary ${tableClassName}`}
        >
          {/* COLGROUP */}
          <colgroup>
            {columns.map((col) => (
              <col
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={col.width ? undefined : "w-auto"}
              />
            ))}
            {rowActions && <col className="w-[60px]" />}
          </colgroup>

          {/* THEAD */}
          <thead className="border-b border-border bg-surface-subtle text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <tr>
              {columns.map((col) => {
                const alignClass =
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left";

                const numericClass = col.isNumeric ? "tabular-nums" : "";
                const headerPadding =
                  col.align === "center"
                    ? "px-2 py-3"
                    : col.align === "right"
                    ? "px-3 py-3"
                    : "px-3.5 py-3";

                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`${headerPadding} ${alignClass} ${numericClass} ${col.headerClassName || ""}`}
                  >
                    {col.sortable && handleSort ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort(col.sortKey || col.key)}
                        className={`group -ml-2 h-auto px-2 py-1 inline-flex items-center gap-1 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted hover:text-text-main transition-colors focus:outline-none ${
                          col.align === "right"
                            ? "justify-end ml-auto"
                            : col.align === "center"
                            ? "justify-center mx-auto"
                            : ""
                        }`}
                      >
                        <span>{col.header}</span>
                        <span
                          className={`inline-flex shrink-0 items-center justify-center text-xs ${
                            activeSortBy === (col.sortKey || col.key)
                              ? "text-blue-600 font-bold"
                              : "text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity"
                          }`}
                          aria-hidden="true"
                        >
                          {activeSortBy === (col.sortKey || col.key)
                            ? activeOrder === "asc"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>
                      </Button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
              {rowActions && (
                <th
                  scope="col"
                  className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-text-muted"
                >
                  Aksi
                </th>
              )}
            </tr>
          </thead>

          {/* TBODY */}
          <tbody className="divide-y divide-border-subtle bg-surface">
            {items.map((item, index) => {
              const rowKey = keyExtractor(item, index);
              const customRowClass = rowClassName ? rowClassName(item, index) : "";

              return (
                <tr
                  key={rowKey}
                  className={`transition hover:bg-surface-subtle/70 ${customRowClass}`}
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left";

                    const numericClass = col.isNumeric ? "tabular-nums" : "";
                    const cellPadding =
                      col.align === "center"
                        ? "px-2 py-3"
                        : col.align === "right"
                        ? "px-3 py-3"
                        : "px-3.5 py-3";

                    return (
                      <td
                        key={col.key}
                        className={`${cellPadding} ${alignClass} ${numericClass} ${col.className || ""}`}
                      >
                        {col.render
                          ? col.render(item, index)
                          : (item as Record<string, unknown>)[col.key] != null
                          ? String((item as Record<string, unknown>)[col.key])
                          : "-"}
                      </td>
                    );
                  })}
                  {rowActions && (
                    <td className="px-3.5 py-3 text-right align-middle whitespace-nowrap">
                      {rowActions(item, index)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* LOADING OVERLAY ON TABLE */}
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-surface/70 backdrop-blur-[1px] z-10"
            role="status"
            aria-live="polite"
            aria-label={loadingMessage}
          >
            <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-text-secondary shadow-sm flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span>{loadingMessage}</span>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE / TABLET CARDS */}
      {items.length > 0 && (
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${mobileDisplayClass} ${cardGridClassName}`}
        >
          {items.map((item, index) => {
            const rowKey = keyExtractor(item, index);
            if (renderMobileCard) {
              return (
                <div key={rowKey}>
                  {renderMobileCard(item, index)}
                </div>
              );
            }

            return (
              <Card key={rowKey} className="p-4 space-y-2.5">
                {columns.map((col) => {
                  if (col.key === "actions") return null;
                  return (
                    <div
                      key={col.key}
                      className="flex items-start justify-between gap-2 text-xs"
                    >
                      <span className="font-semibold text-text-muted shrink-0">
                        {col.header}
                      </span>
                      <div
                        className={`min-w-0 text-right ${
                          col.isNumeric ? "tabular-nums" : ""
                        }`}
                      >
                        {col.render
                          ? col.render(item, index)
                          : (item as Record<string, unknown>)[col.key] != null
                          ? String((item as Record<string, unknown>)[col.key])
                          : "-"}
                      </div>
                    </div>
                  );
                })}
                {rowActions && (
                  <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2.5">
                    <span className="text-xs font-medium text-text-muted">Pilihan Aksi</span>
                    {rowActions(item, index)}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
