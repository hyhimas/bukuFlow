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
            className="absolute inset-0 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
            aria-hidden="true"
          />

          {/* Book Animation */}
          <div className="animate-[bookPulse_1.8s_ease-in-out_infinite]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-7 w-7 text-blue-600"
              aria-hidden="true"
            >
              {/* Left Page */}
              <path
                d="M4 5.5C4 4.67 4.67 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Right Page */}
              <path
                d="M20 5.5C20 4.67 19.33 4 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Book Spine */}
              <path
                d="M11 4h2v16h-2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
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