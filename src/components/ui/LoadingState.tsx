interface LoadingStateProps {
  label?: string;
  className?: string;
}

export default function LoadingState({
  label = "Memuat...",
  className = "",
}: LoadingStateProps) {
  return (
    <div
      className={`flex min-h-screen items-center justify-center bg-slate-50 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center text-center">
        {/* Loading Icon */}
        <div className="relative flex h-16 w-16 items-center justify-center">
          {/* Outer Spinner */}
          <div
            className="absolute inset-0 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600"
            aria-hidden="true"
          />

          {/* Book Logo Animation */}
          <div className="animate-pulse">
            <img
              src="/logo-icon.png"
              alt="BukuFlow Loading"
              className="h-8 w-8 object-contain"
            />
          </div>
        </div>

        {/* Loading Label */}
        <p className="mt-4 text-sm font-medium text-slate-700">
          {label}
        </p>

        {/* Loading Description */}
        <p className="mt-1 text-xs text-slate-400">
          Harap tunggu sebentar...
        </p>
      </div>
    </div>
  );
}