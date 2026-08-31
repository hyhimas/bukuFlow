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
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary:
      "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    destructive:
      "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`rounded-lg px-4 py-3 text-sm font-semibold transition
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-blue-500
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