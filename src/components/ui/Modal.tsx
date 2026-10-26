"use client";

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

export type ModalSize =
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "full";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  className?: string;
  overlayClassName?: string;
  contentClassName?: string;
  showCloseButton?: boolean;
  raw?: boolean;
};

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  full: "max-w-5xl",
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "lg",
  closeOnEscape = true,
  closeOnBackdrop = true,
  initialFocusRef,
  ariaLabelledBy,
  ariaDescribedBy,
  className = "",
  overlayClassName,
  contentClassName = "",
  showCloseButton = true,
  raw = false,
}: ModalProps) {
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const reactId = useId();
  const defaultTitleId = `modal-title-${reactId.replace(/[:]/g, "")}`;
  const defaultDescId = `modal-desc-${reactId.replace(/[:]/g, "")}`;

  const titleId = ariaLabelledBy || (title ? defaultTitleId : undefined);
  const descId = ariaDescribedBy || (description ? defaultDescId : undefined);

  // Lock body scroll & focus management
  useEffect(() => {
    if (!open) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Set initial focus: coba langsung dan pastikan di frame berikutnya
    const setFocus = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);

        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    };

    setFocus();
    const rafId = requestAnimationFrame(setFocus);

    return () => {
      cancelAnimationFrame(rafId);
      document.body.style.overflow = originalOverflow;
      if (previousActiveElementRef.current?.focus) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [open, initialFocusRef]);

  // Handle Escape key & Focus Trap
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab" && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);

        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        // Jika fokus berada di luar modal atau pada kontainer modal itu sendiri
        if (!modalRef.current.contains(document.activeElement) || document.activeElement === modalRef.current) {
          event.preventDefault();
          if (event.shiftKey) {
            last.focus();
          } else {
            first.focus();
          }
          return;
        }

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeOnEscape, onClose]);

  if (!open || !isMounted) {
    return null;
  }

  const defaultOverlayClass = "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4";
  const defaultDialogClass = `w-full max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${SIZE_CLASSES[size]}`;

  const modalContent = (
    <div
      className={overlayClassName || defaultOverlayClass}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && closeOnBackdrop) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={raw ? (className || defaultDialogClass) : `${defaultDialogClass} ${className}`}
      >
        {raw ? (
          children
        ) : (
          <>
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                  {title && (
                    <h3 id={titleId} className="text-lg font-semibold text-slate-900">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p id={descId} className="mt-1 text-sm text-slate-500">
                      {description}
                    </p>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    aria-label="Tutup modal"
                    onClick={onClose}
                    className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            )}

            <div className={contentClassName || "p-5"}>{children}</div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
