interface LogoSpinnerProps {
  label?: string;
  className?: string;
}

export default function LogoSpinner({
  label,
  className = "",
}: LogoSpinnerProps) {
  return (
    <div
      className={`flex flex-col items-center text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        {/* Outer Spinner Ring */}
        <div
          className="absolute inset-0 animate-spin rounded-full border-2 border-brand-soft border-t-brand"
          aria-hidden="true"
        />

        {/* Pulsing Logo Icon */}
        <div className="animate-pulse">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-icon.png"
            alt="BukuFlow Loading"
            className="h-8 w-8 object-contain"
          />
        </div>
      </div>

      {label && (
        <p className="mt-3 text-xs font-medium text-text-muted">{label}</p>
      )}
    </div>
  );
}
