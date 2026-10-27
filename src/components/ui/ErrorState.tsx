import React from "react";
import Button from "./Button";
import { getErrorMessage } from "@/lib/errors";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  nested?: boolean;
}

export default function ErrorState({
  title = "Gagal Memuat Data",
  message = "Terjadi kesalahan saat memuat data. Silakan coba lagi.",
  onRetry,
  retryLabel = "Coba Lagi",
  className = "",
  nested = false,
}: ErrorStateProps) {
  const safeMessage = getErrorMessage(
    message,
    "Terjadi kesalahan saat memuat data. Silakan coba lagi.",
  );
  const containerClasses = nested
    ? `rounded-xl border border-danger-border bg-danger-soft/60 p-6 text-center ${className}`
    : `rounded-2xl border border-danger-border bg-surface p-8 text-center shadow-xs sm:p-12 ${className}`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={containerClasses}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger sm:h-14 sm:w-14">
        <svg
          className="h-6 w-6 sm:h-7 sm:w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h2 className="mt-4 text-base font-semibold text-text-main sm:text-lg">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
        {safeMessage}
      </p>

      {onRetry && (
        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            onClick={onRetry}
            className="inline-flex items-center gap-2"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
            <span>{retryLabel}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

