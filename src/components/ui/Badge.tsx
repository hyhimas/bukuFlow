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
    success: "bg-success-surface text-success border-success-border",
    warning: "bg-warning-surface text-warning border-warning-border",
    danger: "bg-danger-surface text-danger border-danger-border",
    neutral: "bg-neutral-surface text-app-text-muted border-neutral-border",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
