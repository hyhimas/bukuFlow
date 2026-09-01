import type { ButtonHTMLAttributes } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

export default function Button({
  variant = "primary",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const variantClass = {
    primary: "bg-brand text-white hover:bg-brand-strong",
    secondary:
      "border border-app-border bg-app-surface text-app-text-muted hover:bg-neutral-surface",
    destructive:
      "bg-danger text-white hover:bg-red-800",
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`min-h-11 rounded-lg px-4 py-3 text-sm font-semibold transition
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-brand
        focus-visible:ring-offset-2
        disabled:cursor-not-allowed
        disabled:opacity-60
        ${variantClass[variant]}
        ${className}`}
    >
      {loading ? "Memproses..." : children}
    </button>
  );
}
