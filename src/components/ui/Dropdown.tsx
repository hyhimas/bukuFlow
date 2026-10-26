"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  id?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  className?: string;
  variant?: "default" | "badge";
  size?: "sm" | "md";
}

export default function Dropdown({
  id,
  value,
  options,
  onChange,
  label,
  error,
  helperText,
  placeholder = "Pilih",
  disabled = false,
  required = false,
  ariaLabel,
  className = "",
  variant = "default",
  size = "md",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const reactId = useId();
  const dropdownId = id || `dropdown-${reactId.replace(/[:]/g, "")}`;
  const errorId = error ? `${dropdownId}-error` : undefined;
  const helperId = !error && helperText ? `${dropdownId}-help` : undefined;
  const describedBy = errorId || helperId;

  const selectedOption = options.find((option) => option.value === value);

  function openDropdown() {
    setOpen(true);
    const selectedIdx = options.findIndex((opt) => opt.value === value);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }

  function closeDropdown() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function toggleDropdown() {
    if (open) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (open && activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.querySelector<HTMLElement>(
        `#${dropdownId}-opt-${activeIndex}`
      );
      activeEl?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex, dropdownId]);

  function handleSelect(option: DropdownOption) {
    onChange(option.value);
    closeDropdown();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openDropdown();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
      return;
    }

    if (event.key === "Tab") {
      closeDropdown();
      return;
    }

    if (options.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1 < options.length ? prev + 1 : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : options.length - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (activeIndex >= 0 && activeIndex < options.length) {
        handleSelect(options[activeIndex]);
      }
    }
  }

  if (variant === "badge") {
    return (
      <div ref={containerRef} className={`relative inline-flex ${className}`}>
        <button
          id={dropdownId}
          type="button"
          role="combobox"
          disabled={disabled}
          aria-label={ariaLabel || label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? `${dropdownId}-listbox` : undefined}
          aria-activedescendant={
            open && activeIndex >= 0 ? `${dropdownId}-opt-${activeIndex}` : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onClick={toggleDropdown}
          onKeyDown={handleKeyDown}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 ${
            value === "AVAILABLE"
              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : value === "LOST"
                ? "bg-red-50 text-red-600 hover:bg-red-100"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>{selectedOption?.label ?? placeholder}</span>

          {!disabled && (
            <svg
              aria-hidden="true"
              className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </button>

        {open && !disabled && (
          <div
            ref={listboxRef}
            role="listbox"
            id={`${dropdownId}-listbox`}
            aria-label={ariaLabel || label}
            className="absolute bottom-full right-0 z-50 mb-1 max-h-60 min-w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = activeIndex === index;

              return (
                <button
                  key={option.value}
                  id={`${dropdownId}-opt-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-center justify-between whitespace-nowrap rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                    isSelected
                      ? "bg-blue-50 font-semibold text-blue-700"
                      : isHighlighted
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{option.label}</span>
                  {isSelected && (
                    <svg
                      aria-hidden="true"
                      className="ml-2 h-3.5 w-3.5 shrink-0 text-blue-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const heightClass = size === "sm" ? "h-9 text-xs" : "h-11 text-sm";

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={dropdownId}
          className="block text-sm font-medium text-slate-700"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div ref={containerRef} className="relative">
        <button
          id={dropdownId}
          type="button"
          role="combobox"
          disabled={disabled}
          aria-label={ariaLabel || label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? `${dropdownId}-listbox` : undefined}
          aria-activedescendant={
            open && activeIndex >= 0 ? `${dropdownId}-opt-${activeIndex}` : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onClick={toggleDropdown}
          onKeyDown={handleKeyDown}
          className={`flex w-full items-center justify-between rounded-xl border bg-white px-3.5 text-left text-slate-800 outline-none transition ${heightClass} ${
            error
              ? "border-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              : open
                ? "border-blue-600 ring-2 ring-blue-100"
                : "border-slate-300 hover:border-slate-400 focus-visible:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
          } ${disabled ? "cursor-not-allowed bg-slate-100 text-slate-400 opacity-75" : ""}`}
        >
          <span className={`truncate ${!selectedOption && placeholder ? "text-slate-400" : ""}`}>
            {selectedOption?.label ?? placeholder}
          </span>

          <svg
            aria-hidden="true"
            className={`ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
              open ? "rotate-180 text-blue-600" : ""
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && !disabled && (
          <div
            ref={listboxRef}
            role="listbox"
            id={`${dropdownId}-listbox`}
            aria-label={ariaLabel || label}
            className="absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95 duration-100"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = activeIndex === index;

              return (
                <button
                  key={option.value}
                  id={`${dropdownId}-opt-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    isSelected
                      ? "bg-blue-50 font-semibold text-blue-700"
                      : isHighlighted
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <svg
                      aria-hidden="true"
                      className="ml-2 h-4 w-4 shrink-0 text-blue-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p id={errorId} className="text-xs text-red-600 font-medium">{error}</p>
      )}

      {!error && helperText && (
        <p id={helperId} className="text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
}
