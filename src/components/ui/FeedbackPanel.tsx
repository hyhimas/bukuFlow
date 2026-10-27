import type { ReactNode } from "react";

type FeedbackPanelProps = {
  children: ReactNode;
  tone?: "error" | "success" | "info";
  className?: string;
};

export default function FeedbackPanel({
  children,
  tone = "info",
  className = "",
}: FeedbackPanelProps) {
  const styles = {
    error: "border-danger-border bg-danger-soft text-danger-text",
    success: "border-success-border bg-success-soft text-success-text",
    info: "border-border bg-surface-muted text-text-main",
  };

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-xl border p-4 text-sm ${styles[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
