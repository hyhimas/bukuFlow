"use client";

import { useEffect, useId, useRef } from "react";

import Button from "@/components/ui/Button";

export type ConfirmationDialogTone = "primary" | "destructive";

export type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  tone?: ConfirmationDialogTone;
  id?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  loading = false,
  tone = "primary",
  id,
  onConfirm,
  onClose,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reactId = useId();
  const dialogId = id || `confirm-dialog-${reactId.replace(/[:]/g, "")}`;
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      id={dialogId}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={loading || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-text-main shadow-2xl backdrop:bg-overlay backdrop:backdrop-blur-xs z-50 animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-text-muted">
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={onClose}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "primary"}
            loading={loading}
            disabled={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
