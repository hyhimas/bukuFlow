import LogoSpinner from "./LogoSpinner";

interface LoadingStateProps {
  label?: string;
  className?: string;
  nested?: boolean;
}

export default function LoadingState({
  label = "Memuat...",
  className = "",
  nested = false,
}: LoadingStateProps) {
  const containerClasses = nested
    ? `flex items-center justify-center py-12 ${className}`
    : `flex min-h-screen items-center justify-center bg-canvas ${className}`;

  return (
    <div
      className={containerClasses}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center text-center">
        <LogoSpinner />

        {/* Loading Label */}
        <p className="mt-4 text-sm font-medium text-text-main">
          {label}
        </p>

        {/* Loading Description */}
        <p className="mt-1 text-xs text-text-muted">
          Harap tunggu sebentar...
        </p>
      </div>
    </div>
  );
}