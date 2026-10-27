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
    success: "bg-success-soft text-success-text border-success-border",
    warning: "bg-warning-soft text-warning-text border-warning-border",
    danger: "bg-danger-soft text-danger-text border-danger-border",
    neutral: "bg-surface-muted text-text-secondary border-border",
    info: "bg-info-soft text-info-text border-info-border",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
