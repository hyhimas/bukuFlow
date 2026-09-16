"use client";

import { useEffect, useRef, useState } from "react";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  id?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  variant?: "default" | "badge";
}

export default function Dropdown({
  id,
  value,
  options,
  onChange,
  placeholder = "Pilih",
  disabled = false,
  ariaLabel,
  className = "",
  variant = "default",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!open) return;

      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSelect(option: DropdownOption) {
    onChange(option.value);
    setOpen(false);
  }

  if (variant === "badge") {
    return (
      <div ref={containerRef} className={`relative inline-flex ${className}`}>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 ${
            value === "AVAILABLE"
              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : value === "LOST"
                ? "bg-red-50 text-red-600 hover:bg-red-100"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>{selectedOption?.label ?? placeholder}</span>

          {!disabled && (
            <span
              className={`ml-1.5 text-[10px] leading-none text-slate-500 transition-transform ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            >
              ▾
            </span>
          )}
        </button>

        {open && !disabled && (
          <div
            role="listbox"
            aria-label={ariaLabel}
            className="absolute bottom-full right-0 z-50 mb-1 min-w-full overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option)}
                  className={`flex w-full whitespace-nowrap px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                    isSelected
                      ? "bg-blue-50 font-semibold text-blue-700"
                      : "text-slate-700"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{selectedOption?.label ?? placeholder}</span>

        <span
          className={`ml-3 shrink-0 text-xs text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option)}
                className={`flex w-full items-center px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                  isSelected
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-slate-700"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
