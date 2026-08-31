import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "success" | "warning" | "danger" | "neutral";
};

export default function Badge({
  children,
  variant = "neutral",
}: BadgeProps) {
  const styles = {
    success: "bg-green-50 text-green-700 border-green-200",
    warning: "bg-yellow-50 text-yellow-700 border-yellow-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    neutral: "bg-slate-50 text-slate-700 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}