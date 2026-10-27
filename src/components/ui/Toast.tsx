"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getErrorMessage, isHtmlString, isJsonString, isRawAxiosNoise } from "@/lib/errors";

export type ToastTone = "success" | "warning" | "error" | "info";

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title?: string;
  message: string;
  duration?: number;
}

export interface ToastContextValue {
  toast: {
    success: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    error: (message: unknown, title?: string) => void;
    info: (message: string, title?: string) => void;
    custom: (item: Omit<ToastItem, "id">) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Observer pattern: allows calling `toast.success(...)` directly from anywhere
type ToastListener = (item: Omit<ToastItem, "id">) => void;
const listeners = new Set<ToastListener>();
const pendingQueue: Omit<ToastItem, "id">[] = [];

function emitToast(item: Omit<ToastItem, "id">) {
  if (listeners.size === 0) {
    pendingQueue.push(item);
    return;
  }
  listeners.forEach((listener) => listener(item));
}

/**
 * Global toast object that can be imported and called directly without needing hooks:
 * ```ts
 * import { toast } from "@/components/ui/Toast";
 * toast.success("Data berhasil disimpan.");
 * toast.error(err);
 * ```
 */
export const toast = {
  success: (message: string, title?: string) => {
    emitToast({ tone: "success", message, title });
  },
  warning: (message: string, title?: string) => {
    emitToast({ tone: "warning", message, title });
  },
  error: (message: unknown, title?: string) => {
    const safeMessage =
      typeof message === "string" &&
      !isRawAxiosNoise(message) &&
      !isHtmlString(message) &&
      !isJsonString(message)
        ? message
        : getErrorMessage(message, "Terjadi kesalahan pada sistem.");
    emitToast({ tone: "error", message: safeMessage, title });
  },
  info: (message: string, title?: string) => {
    emitToast({ tone: "info", message, title });
  },
  custom: (item: Omit<ToastItem, "id">) => {
    emitToast(item);
  },
};

const TONE_CONFIG: Record<
  ToastTone,
  {
    borderColor: string;
    iconBgColor: string;
    iconTextColor: string;
    icon: React.ReactNode;
    defaultTitle: string;
  }
> = {
  success: {
    borderColor: "border-success-border",
    iconBgColor: "bg-success-soft",
    iconTextColor: "text-success-text",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    defaultTitle: "Berhasil",
  },
  warning: {
    borderColor: "border-warning-border",
    iconBgColor: "bg-warning-soft",
    iconTextColor: "text-warning-text",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    defaultTitle: "Perhatian",
  },
  error: {
    borderColor: "border-danger-border",
    iconBgColor: "bg-danger-soft",
    iconTextColor: "text-danger-text",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    defaultTitle: "Terjadi Kesalahan",
  },
  info: {
    borderColor: "border-brand-border",
    iconBgColor: "bg-brand-soft",
    iconTextColor: "text-brand-text",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    defaultTitle: "Informasi",
  },
};

function ToastMessage({
  item,
  onRemove,
}: {
  item: ToastItem;
  onRemove: (id: string) => void;
}) {
  const duration = item.duration ?? 3500;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const remainingRef = useRef<number>(duration);
  const startTimeRef = useRef<number>(0);

  const startTimer = useCallback(() => {
    if (duration <= 0 || remainingRef.current <= 0) return;
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onRemove(item.id);
    }, remainingRef.current);
  }, [duration, item.id, onRemove]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    }
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startTimer]);

  const config = TONE_CONFIG[item.tone] || TONE_CONFIG.info;
  const title = item.title || config.defaultTitle;

  return (
    <div
      role="status"
      aria-live={item.tone === "error" ? "assertive" : "polite"}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      className="pointer-events-auto transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-top-2"
    >
      <div
        className={`flex items-start gap-3 rounded-xl border ${config.borderColor} bg-surface p-4 shadow-dropdown ring-1 ring-border`}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.iconBgColor} ${config.iconTextColor} font-bold text-sm`}
          aria-hidden="true"
        >
          {config.icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-main">{title}</p>
          <p className="mt-1 text-sm leading-5 text-text-muted break-words">
            {item.message}
          </p>
        </div>

        <button
          type="button"
          aria-label="Tutup notifikasi"
          onClick={() => onRemove(item.id)}
          className="flex h-8 w-8 min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-md p-1 text-text-subtle transition hover:bg-surface-muted hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (item: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { ...item, id };

      setToasts((prev) => [...prev, newToast]);
    },
    []
  );

  // Connect global toast calls to this provider
  useEffect(() => {
    const listener: ToastListener = (item) => {
      addToast(item);
    };
    listeners.add(listener);

    // Flush any pending toasts that were called before the provider mounted
    if (pendingQueue.length > 0) {
      const items = pendingQueue.splice(0);
      items.forEach((it) => addToast(it));
    }

    return () => {
      listeners.delete(listener);
    };
  }, [addToast]);

  const contextToast = {
    success: useCallback(
      (message: string, title?: string) => {
        addToast({ tone: "success", message, title });
      },
      [addToast]
    ),
    warning: useCallback(
      (message: string, title?: string) => {
        addToast({ tone: "warning", message, title });
      },
      [addToast]
    ),
    error: useCallback(
      (message: unknown, title?: string) => {
        const safeMessage =
          typeof message === "string" &&
          !isRawAxiosNoise(message) &&
          !isHtmlString(message) &&
          !isJsonString(message)
            ? message
            : getErrorMessage(message, "Terjadi kesalahan pada sistem.");
        addToast({ tone: "error", message: safeMessage, title });
      },
      [addToast]
    ),
    info: useCallback(
      (message: string, title?: string) => {
        addToast({ tone: "info", message, title });
      },
      [addToast]
    ),
    custom: addToast,
  };

  return (
    <ToastContext.Provider value={{ toast: contextToast, removeToast }}>
      {children}

      {/* Global Top-Right Toast Container */}
      <aside
        aria-label="Notifikasi sistem"
        className="fixed right-4 top-20 z-[9999] flex flex-col gap-2.5 w-[min(380px,calc(100vw-2rem))] pointer-events-none"
      >
        {toasts.map((item) => (
          <ToastMessage key={item.id} item={item} onRemove={removeToast} />
        ))}
      </aside>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // If used outside provider, return the global toast object safely
    return {
      toast,
      removeToast: () => {},
    };
  }
  return context;
}

export default toast;

