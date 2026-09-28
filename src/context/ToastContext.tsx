"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

export type ToastTone = "success" | "warning" | "error" | "info";

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    custom: (item: Omit<ToastItem, "id">) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TONE_CONFIG: Record<
  ToastTone,
  {
    borderColor: string;
    iconBgColor: string;
    iconTextColor: string;
    icon: string;
    defaultTitle: string;
  }
> = {
  success: {
    borderColor: "border-green-200",
    iconBgColor: "bg-green-100",
    iconTextColor: "text-green-700",
    icon: "✓",
    defaultTitle: "Berhasil",
  },
  warning: {
    borderColor: "border-amber-200",
    iconBgColor: "bg-amber-100",
    iconTextColor: "text-amber-700",
    icon: "!",
    defaultTitle: "Perhatian",
  },
  error: {
    borderColor: "border-red-200",
    iconBgColor: "bg-red-100",
    iconTextColor: "text-red-700",
    icon: "✕",
    defaultTitle: "Terjadi Kesalahan",
  },
  info: {
    borderColor: "border-blue-200",
    iconBgColor: "bg-blue-100",
    iconTextColor: "text-blue-700",
    icon: "ℹ",
    defaultTitle: "Informasi",
  },
};

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

      const duration = item.duration ?? 3500;
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = {
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
      (message: string, title?: string) => {
        addToast({ tone: "error", message, title });
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
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}

      {/* Global Top-Right Toast Container */}
      <aside
        aria-label="Notifikasi sistem"
        className="fixed right-4 top-4 z-[9999] flex flex-col gap-2.5 w-[min(380px,calc(100vw-2rem))] pointer-events-none"
      >
        {toasts.map((item) => {
          const config = TONE_CONFIG[item.tone] || TONE_CONFIG.info;
          const title = item.title || config.defaultTitle;

          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              aria-live={item.tone === "error" ? "assertive" : "polite"}
              className="pointer-events-auto transition-all duration-300 transform translate-y-0"
            >
              <div
                className={`flex items-start gap-3 rounded-xl border ${config.borderColor} bg-white p-4 shadow-lg ring-1 ring-slate-900/5`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.iconBgColor} ${config.iconTextColor} font-bold text-sm`}
                  aria-hidden="true"
                >
                  {config.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="mt-1 text-sm leading-5 text-slate-500 break-words">
                    {item.message}
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Tutup notifikasi"
                  onClick={() => removeToast(item.id)}
                  className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </aside>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

