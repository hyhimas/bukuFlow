"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export interface DatePickerProps {
  id?: string;
  label?: string;
  value?: string; // Format "YYYY-MM-DD"
  onChange?: (value: string) => void;
  min?: string; // Format "YYYY-MM-DD"
  max?: string; // Format "YYYY-MM-DD"
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  helperText?: string;
  placeholder?: string;
  className?: string;
  showClearButton?: boolean;
}

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const WEEKDAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function emptySubscribe() {
  return () => {};
}

function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

function parseYYYYMMDD(str?: string): Date | null {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
}

function formatYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(str?: string): string {
  const date = parseYYYYMMDD(str);
  if (!date) return "";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function getFullDateLabel(
  dateStr: string,
  isToday: boolean,
  isSelected: boolean,
  isDisabled: boolean,
): string {
  const date = parseYYYYMMDD(dateStr);
  if (!date) return dateStr;
  const d = date.getDate();
  const m = MONTHS_ID[date.getMonth()];
  const y = date.getFullYear();
  const parts = [`${d} ${m} ${y}`];
  if (isSelected) parts.push("terpilih");
  if (isToday) parts.push("hari ini");
  if (isDisabled) parts.push("tidak tersedia");
  return parts.join(", ");
}

export default function DatePicker({
  id,
  label,
  value = "",
  onChange,
  min,
  max,
  minDate,
  maxDate,
  disabled = false,
  required = false,
  error,
  helperText,
  placeholder = "Pilih tanggal",
  className = "",
  showClearButton = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useIsMounted();

  const effectiveMin = minDate || min || "";
  const effectiveMax = maxDate || max || "";

  const selectedDate = parseYYYYMMDD(value);
  const today = new Date();
  const todayStr = formatYYYYMMDD(today);
  const initialDate = constrainDate(selectedDate || today);

  // View state for month/year navigation inside calendar
  const [viewDate, setViewDate] = useState<Date>(() => {
    return initialDate;
  });

  const [focusedDate, setFocusedDate] = useState<string>(() => {
    return formatYYYYMMDD(initialDate);
  });

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    const nextDate = constrainDate(selectedDate || today);
    setViewDate(nextDate);
    setFocusedDate(formatYYYYMMDD(nextDate));
  }

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const focusedDateButtonRef = useRef<HTMLButtonElement>(null);
  const shouldFocusDateRef = useRef(false);

  const [popoverPos, setPopoverPos] = useState({
    top: 0,
    left: 0,
    width: 336,
    placement: "bottom" as "bottom" | "top",
  });

  // Position calculation
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverHeight = 400;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement: "bottom" | "top" = "bottom";
    let top = rect.bottom + 6;

    if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      placement = "top";
      top = rect.top - popoverHeight - 6;
    }

    let left = rect.left;
    const maxAvailable = Math.max(280, window.innerWidth - 24);
    const width = Math.min(Math.max(rect.width, 336), maxAvailable);

    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12;
    }
    if (left < 12) {
      left = 12;
    }

    setPopoverPos({ top, left, width, placement });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  // Click outside and keydown listeners
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return;
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !shouldFocusDateRef.current) return;
    shouldFocusDateRef.current = false;
    focusedDateButtonRef.current?.focus();
  }, [isOpen, focusedDate]);

  function toggleOpen() {
    if (disabled) return;
    if (!isOpen) {
      const availableDate = constrainDate(selectedDate || today);
      setViewDate(availableDate);
      setFocusedDate(formatYYYYMMDD(availableDate));
      shouldFocusDateRef.current = true;
    }
    setIsOpen((prev) => !prev);
  }

  function handleSelectDate(dateStr: string) {
    if (disabled) return;
    onChange?.(dateStr);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleClear(e: ReactMouseEvent | ReactKeyboardEvent) {
    e.stopPropagation();
    onChange?.("");
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handlePrevMonth() {
    setViewDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      const availableDate = constrainDate(next);
      setFocusedDate(formatYYYYMMDD(availableDate));
      return new Date(availableDate.getFullYear(), availableDate.getMonth(), 1);
    });
  }

  function handleNextMonth() {
    setViewDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      const availableDate = constrainDate(next);
      setFocusedDate(formatYYYYMMDD(availableDate));
      return new Date(availableDate.getFullYear(), availableDate.getMonth(), 1);
    });
  }

  function isDateDisabled(dateStr: string): boolean {
    if (effectiveMin && dateStr < effectiveMin) return true;
    if (effectiveMax && dateStr > effectiveMax) return true;
    return false;
  }

  function constrainDate(date: Date): Date {
    const dateStr = formatYYYYMMDD(date);
    if (effectiveMin && dateStr < effectiveMin) {
      return parseYYYYMMDD(effectiveMin) || date;
    }
    if (effectiveMax && dateStr > effectiveMax) {
      return parseYYYYMMDD(effectiveMax) || date;
    }
    return date;
  }

  function shiftMonth(date: Date, amount: number): Date {
    const monthStart = new Date(
      date.getFullYear(),
      date.getMonth() + amount,
      1,
    );
    const lastDay = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
    ).getDate();
    return new Date(
      monthStart.getFullYear(),
      monthStart.getMonth(),
      Math.min(date.getDate(), lastDay),
    );
  }

  function handleGridKeyDown(
    e: ReactKeyboardEvent<HTMLButtonElement>,
    cellDateStr: string,
  ) {
    let targetDate = parseYYYYMMDD(cellDateStr);
    if (!targetDate) return;

    let handled = false;

    switch (e.key) {
      case "ArrowLeft":
        targetDate.setDate(targetDate.getDate() - 1);
        handled = true;
        break;
      case "ArrowRight":
        targetDate.setDate(targetDate.getDate() + 1);
        handled = true;
        break;
      case "ArrowUp":
        targetDate.setDate(targetDate.getDate() - 7);
        handled = true;
        break;
      case "ArrowDown":
        targetDate.setDate(targetDate.getDate() + 7);
        handled = true;
        break;
      case "PageUp":
        targetDate = shiftMonth(targetDate, e.shiftKey ? -12 : -1);
        handled = true;
        break;
      case "PageDown":
        targetDate = shiftMonth(targetDate, e.shiftKey ? 12 : 1);
        handled = true;
        break;
      case "Home":
        targetDate.setDate(targetDate.getDate() - targetDate.getDay());
        handled = true;
        break;
      case "End":
        targetDate.setDate(targetDate.getDate() + (6 - targetDate.getDay()));
        handled = true;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!isDateDisabled(cellDateStr)) {
          handleSelectDate(cellDateStr);
        }
        return;
      default:
        break;
    }

    if (handled) {
      e.preventDefault();
      targetDate = constrainDate(targetDate);
      const nextStr = formatYYYYMMDD(targetDate);
      shouldFocusDateRef.current = true;
      setFocusedDate(nextStr);
      if (
        targetDate.getFullYear() !== viewDate.getFullYear() ||
        targetDate.getMonth() !== viewDate.getMonth()
      ) {
        setViewDate(
          new Date(targetDate.getFullYear(), targetDate.getMonth(), 1),
        );
      }
    }
  }

  // Calendar Grid Builder
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const calendarDays: Array<{
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isDisabled: boolean;
    isSelected: boolean;
    isToday: boolean;
  }> = [];

  // Previous month trailing days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const d = new Date(year, month - 1, dayNum);
    const dateStr = formatYYYYMMDD(d);
    calendarDays.push({
      dateStr,
      dayNum,
      isCurrentMonth: false,
      isDisabled: isDateDisabled(dateStr),
      isSelected: dateStr === value,
      isToday: dateStr === todayStr,
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    const dateStr = formatYYYYMMDD(d);
    calendarDays.push({
      dateStr,
      dayNum: i,
      isCurrentMonth: true,
      isDisabled: isDateDisabled(dateStr),
      isSelected: dateStr === value,
      isToday: dateStr === todayStr,
    });
  }

  // Next month leading days (fill 42 cells)
  const remainingCells = 42 - calendarDays.length;
  for (let i = 1; i <= remainingCells; i++) {
    const d = new Date(year, month + 1, i);
    const dateStr = formatYYYYMMDD(d);
    calendarDays.push({
      dateStr,
      dayNum: i,
      isCurrentMonth: false,
      isDisabled: isDateDisabled(dateStr),
      isSelected: dateStr === value,
      isToday: dateStr === todayStr,
    });
  }

  const descriptionId = id
    ? error
      ? `${id}-error`
      : helperText
        ? `${id}-help`
        : undefined
    : undefined;

  const displayString = formatDisplayDate(value);

  const popoverContent = isOpen && mounted && (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label={label ? `Pilih tanggal, ${label}` : "Pilih tanggal"}
      style={{
        position: "fixed",
        top: `${popoverPos.top}px`,
        left: `${popoverPos.left}px`,
        width: `${popoverPos.width}px`,
        zIndex: 9000,
      }}
      className="rounded-xl border border-border bg-surface p-4 shadow-dropdown ring-1 ring-slate-900/5 animate-in fade-in-50 zoom-in-95"
    >
      {/* Header: Month & Year Nav */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <button
          type="button"
          onClick={handlePrevMonth}
          aria-label="Bulan sebelumnya"
          className="flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text-main transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-sm font-semibold text-text-main">
          {MONTHS_ID[month]} {year}
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
          aria-label="Bulan berikutnya"
          className="flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text-main transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekdays Header */}
      <div
        aria-hidden="true"
        className="mt-3 grid text-center"
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        {WEEKDAYS_ID.map((day) => (
          <span
            key={day}
            className="py-1 text-xs font-semibold text-text-muted"
          >
            {day}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div
        role="grid"
        aria-label="Kalender hari"
        className="mt-1 grid gap-1 text-center"
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        {calendarDays.map((cell, idx) => {
          const isFocused = cell.dateStr === focusedDate;
          return (
            <button
              key={`${cell.dateStr}-${idx}`}
              ref={isFocused ? focusedDateButtonRef : undefined}
              type="button"
              data-date={cell.dateStr}
              tabIndex={isFocused ? 0 : -1}
              disabled={cell.isDisabled}
              aria-label={getFullDateLabel(
                cell.dateStr,
                cell.isToday,
                cell.isSelected,
                cell.isDisabled,
              )}
              aria-pressed={cell.isSelected}
              aria-current={cell.isToday ? "date" : undefined}
              onClick={() => handleSelectDate(cell.dateStr)}
              onKeyDown={(e) => handleGridKeyDown(e, cell.dateStr)}
              className={`flex h-10 w-10 min-h-[40px] min-w-[40px] mx-auto items-center justify-center rounded-lg text-xs font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${
                cell.isSelected
                  ? "bg-brand text-white font-semibold shadow-sm focus:ring-2 focus:ring-brand/30"
                  : cell.isToday
                    ? "border border-brand text-brand font-semibold hover:bg-info-surface focus:bg-info-surface focus:ring-2 focus:ring-brand/20"
                    : cell.isDisabled
                      ? "text-text-subtle cursor-not-allowed opacity-40"
                      : cell.isCurrentMonth
                        ? "text-text-secondary hover:bg-surface-muted focus:bg-surface-muted"
                        : "text-text-subtle hover:bg-surface-muted focus:bg-surface-muted"
              }`}
            >
              {cell.dayNum}
            </button>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3 text-xs font-medium">
        <button
          type="button"
          onClick={() => {
            if (!isDateDisabled(todayStr)) {
              handleSelectDate(todayStr);
            }
          }}
          disabled={isDateDisabled(todayStr)}
          className="text-brand hover:text-brand-strong disabled:opacity-40 disabled:cursor-not-allowed rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Hari Ini
        </button>

        {showClearButton && value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-text-muted hover:text-text-secondary rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Bersihkan
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-text-muted"
        >
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          onClick={toggleOpen}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-describedby={descriptionId}
          className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-sm outline-none transition text-left bg-surface
            ${showClearButton && value && !disabled ? "pr-16" : "pr-10"}
            ${
              disabled
                ? "bg-surface-muted cursor-not-allowed opacity-60 text-text-subtle"
                : "cursor-pointer text-text-main hover:border-border-strong"
            }
            ${
              isOpen
                ? "border-brand ring-2 ring-brand/20"
                : error
                  ? "border-danger"
                  : "border-border"
            }
            focus:border-brand focus:ring-2 focus:ring-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
        >
          <span className={displayString ? "font-medium text-text-main" : "text-text-subtle"}>
            {displayString || placeholder}
          </span>
        </button>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-text-subtle">
          {showClearButton && value && !disabled && (
            <button
              type="button"
              aria-label="Bersihkan tanggal"
              onClick={handleClear}
              className="p-1 text-text-subtle hover:text-text-secondary rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <svg
            className="h-5 w-5 pointer-events-none text-text-subtle shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p id={`${id}-help`} className="text-sm text-text-muted">
          {helperText}
        </p>
      )}

      {mounted && popoverContent && createPortal(popoverContent, document.body)}
    </div>
  );
}

