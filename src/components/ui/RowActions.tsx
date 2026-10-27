"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

export interface RowActionItem {
  key?: string;
  label: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "destructive" | "success" | "warning";
  disabled?: boolean;
}

export interface RowActionsProps {
  actions: RowActionItem[];
  trigger?: ReactNode;
  align?: "left" | "right";
  direction?: "auto" | "down" | "up";
  ariaLabel?: string;
  className?: string;
}

export default function RowActions({
  actions,
  trigger,
  align = "right",
  direction = "auto",
  ariaLabel = "Menu aksi",
  className = "",
}: RowActionsProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasNoActions = !actions || actions.length === 0;

  // Close on outside click & Escape
  useEffect(() => {
    if (!open || hasNoActions) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, hasNoActions]);

  if (hasNoActions) {
    return <span className="text-text-muted text-xs">-</span>;
  }

  // Keyboard navigation within menu
  const handleMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!open) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const menu = menuRef.current;
      if (!menu) return;

      const items = Array.from(
        menu.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>(
          'button:not([disabled]), a[href]:not([disabled])'
        )
      );
      if (items.length === 0) return;

      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      let nextIndex = 0;

      if (e.key === "ArrowDown") {
        nextIndex = currentIndex + 1 < items.length ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : items.length - 1;
      }

      items[nextIndex]?.focus();
    }
  };

  const getToneClasses = (tone?: "default" | "destructive" | "success" | "warning") => {
    switch (tone) {
      case "destructive":
        return "text-danger hover:bg-danger-soft hover:text-danger-hover focus-visible:bg-danger-soft";
      case "success":
        return "text-success hover:bg-success-soft hover:text-success-hover focus-visible:bg-success-soft";
      case "warning":
        return "text-warning hover:bg-warning-soft hover:text-warning-hover focus-visible:bg-warning-soft";
      case "default":
      default:
        return "text-text-secondary hover:bg-surface-muted hover:text-text-main focus-visible:bg-surface-muted";
    }
  };

  const handleToggle = () => {
    if (!open && containerRef.current) {
      if (direction === "up") {
        setOpenUpward(true);
      } else if (direction === "down") {
        setOpenUpward(false);
      } else {
        const buttonRect = containerRef.current.getBoundingClientRect();
        const viewportSpaceBelow = window.innerHeight - buttonRect.bottom;

        let scrollParentSpaceBelow = Infinity;
        let parent = containerRef.current.parentElement;
        while (parent && parent !== document.body) {
          const style = window.getComputedStyle(parent);
          const hasOverflow =
            style.overflowY === "auto" ||
            style.overflowY === "scroll" ||
            style.overflowY === "hidden" ||
            style.overflowX === "auto" ||
            style.overflowX === "scroll" ||
            style.overflowX === "hidden";

          if (hasOverflow) {
            const parentRect = parent.getBoundingClientRect();
            scrollParentSpaceBelow = parentRect.bottom - buttonRect.bottom;
            break;
          }
          parent = parent.parentElement;
        }

        const spaceBelow = Math.min(viewportSpaceBelow, scrollParentSpaceBelow);
        const shouldOpenUp = spaceBelow < 210 && buttonRect.top > 180;
        setOpenUpward(shouldOpenUp);
      }
    }
    setOpen((prev) => !prev);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
    >
      {trigger ? (
        <div onClick={handleToggle}>
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={ariaLabel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary shadow-2xs transition hover:border-border-strong hover:bg-surface-muted hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      )}

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={handleMenuKeyDown}
          className={`absolute z-40 min-w-[150px] max-w-[240px] rounded-xl border border-border bg-surface p-1 shadow-dropdown animate-in fade-in-50 zoom-in-95 ${
            openUpward
              ? "bottom-full mb-1.5 origin-bottom-right"
              : "top-full mt-1.5 origin-top-right"
          } ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {actions.map((action, index) => {
            const toneClasses = getToneClasses(action.tone);
            const itemKey = action.key || `action-${index}`;

            if (action.href) {
              return (
                <Link
                  key={itemKey}
                  href={action.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${toneClasses} ${
                    action.disabled ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  {action.icon && (
                    <span className="shrink-0 text-current">{action.icon}</span>
                  )}
                  <span className="truncate">{action.label}</span>
                </Link>
              );
            }

            return (
              <button
                key={itemKey}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onClick?.();
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-left transition ${toneClasses} disabled:opacity-50 disabled:pointer-events-none`}
              >
                {action.icon && (
                  <span className="shrink-0 text-current">{action.icon}</span>
                )}
                <span className="truncate">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

