import type { ReactNode } from "react";

export type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "info";

export type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export default function Badge({
  children,
  variant = "neutral",
  className = "",
}: BadgeProps) {
  const styles = {
    success: "bg-success-surface text-success border-success-border",
    warning: "bg-warning-surface text-warning border-warning-border",
    danger: "bg-danger-surface text-danger border-danger-border",
    neutral: "bg-neutral-surface text-app-text-muted border-neutral-border",
    info: "bg-info-surface text-info border-info-border",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
