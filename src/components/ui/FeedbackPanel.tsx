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
    error: "border-danger-border bg-danger-surface text-danger",
    success: "border-success-border bg-success-surface text-success",
    info: "border-neutral-border bg-neutral-surface text-app-text",
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
