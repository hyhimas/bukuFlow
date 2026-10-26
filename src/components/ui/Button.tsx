import type {
  ButtonHTMLAttributes,
  ReactNode,
  Ref,
} from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin shrink-0 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled,
  children,
  className = "",
  ref,
  ...props
}: ButtonProps) {
  const variantClass = {
    primary:
      "bg-brand text-white hover:bg-brand-strong",

    secondary:
      "border border-app-border bg-app-surface text-app-text-muted hover:bg-neutral-surface",

    destructive:
      "bg-danger text-white hover:bg-danger-strong",

    ghost:
      "bg-transparent text-app-text-muted hover:bg-neutral-surface hover:text-app-text",
  };

  const sizeClass = {
    sm: "min-h-8 px-3 py-1.5 text-xs rounded-lg gap-1.5",
    md: "min-h-11 px-4 py-2.5 text-sm rounded-lg gap-2",
    lg: "min-h-12 px-5 py-3 text-base rounded-lg gap-2.5",
  };

  return (
    <button
      {...props}
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center font-semibold transition
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-brand
        focus-visible:ring-offset-2
        disabled:cursor-not-allowed
        disabled:opacity-60
        ${sizeClass[size]}
        ${variantClass[variant]}
        ${className}`}
    >
      {loading && <Spinner className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {!loading && icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
}