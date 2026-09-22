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

  // View state for month/year navigation inside calendar
  const [viewDate, setViewDate] = useState<Date>(() => {
    return selectedDate || today;
  });

  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
    }
  }, [value]);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [popoverPos, setPopoverPos] = useState({
    top: 0,
    left: 0,
    width: 280,
    placement: "bottom" as "bottom" | "top",
  });

  // Position calculation
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverHeight = 340;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement: "bottom" | "top" = "bottom";
    let top = rect.bottom + 6;

    if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      placement = "top";
      top = rect.top - popoverHeight - 6;
    }

    let left = rect.left;
    const width = Math.max(rect.width, 280);

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

  function toggleOpen() {
    if (disabled) return;
    if (!isOpen && selectedDate) {
      setViewDate(selectedDate);
    }
    setIsOpen((prev) => !prev);
  }

  function handleSelectDate(dateStr: string) {
    if (disabled) return;
    onChange?.(dateStr);
    setIsOpen(false);
  }

  function handleClear(e: ReactMouseEvent | ReactKeyboardEvent) {
    e.stopPropagation();
    onChange?.("");
    setIsOpen(false);
  }

  function handlePrevMonth() {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  }

  function handleNextMonth() {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  }

  function isDateDisabled(dateStr: string): boolean {
    if (effectiveMin && dateStr < effectiveMin) return true;
    if (effectiveMax && dateStr > effectiveMax) return true;
    return false;
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

  const descriptionId = error
    ? `${id}-error`
    : helperText
      ? `${id}-help`
      : undefined;

  const displayString = formatDisplayDate(value);

  const popoverContent = isOpen && mounted && (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: `${popoverPos.top}px`,
        left: `${popoverPos.left}px`,
        width: `${popoverPos.width}px`,
        zIndex: 100000,
      }}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-slate-900/5 animate-in fade-in-50 zoom-in-95"
    >
      {/* Header: Month & Year Nav */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <button
          type="button"
          onClick={handlePrevMonth}
          aria-label="Bulan sebelumnya"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-sm font-semibold text-slate-800">
          {MONTHS_ID[month]} {year}
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
          aria-label="Bulan berikutnya"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekdays Header */}
      <div
        className="mt-3 grid text-center"
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        {WEEKDAYS_ID.map((day) => (
          <span
            key={day}
            className="py-1 text-xs font-semibold text-slate-400"
          >
            {day}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div
        className="mt-1 grid gap-1 text-center"
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        {calendarDays.map((cell, idx) => {
          return (
            <button
              key={`${cell.dateStr}-${idx}`}
              type="button"
              disabled={cell.isDisabled}
              onClick={() => handleSelectDate(cell.dateStr)}
              className={`flex h-8 w-8 mx-auto items-center justify-center rounded-lg text-xs font-medium transition ${
                cell.isSelected
                  ? "bg-brand text-white font-semibold shadow-sm"
                  : cell.isToday
                    ? "border border-brand text-brand font-semibold hover:bg-blue-50"
                    : cell.isDisabled
                      ? "text-slate-300 cursor-not-allowed opacity-40"
                      : cell.isCurrentMonth
                        ? "text-slate-700 hover:bg-slate-100"
                        : "text-slate-300 hover:bg-slate-50"
              }`}
            >
              {cell.dayNum}
            </button>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-medium">
        <button
          type="button"
          onClick={() => {
            if (!isDateDisabled(todayStr)) {
              handleSelectDate(todayStr);
            }
          }}
          disabled={isDateDisabled(todayStr)}
          className="text-brand hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Hari Ini
        </button>

        {showClearButton && value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-500 hover:text-slate-700"
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
          className="block text-sm font-medium text-app-text-muted"
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
          className={`w-full flex items-center justify-between rounded-app border px-4 py-3 text-sm outline-none transition text-left bg-white
            ${
              disabled
                ? "bg-slate-100 cursor-not-allowed opacity-60 text-slate-400"
                : "cursor-pointer text-app-text hover:border-slate-400"
            }
            ${
              isOpen
                ? "border-brand ring-2 ring-blue-100"
                : error
                  ? "border-danger"
                  : "border-app-border"
            }
            focus:border-brand focus:ring-2 focus:ring-blue-100`}
        >
          <span className={displayString ? "font-medium text-app-text" : "text-slate-400"}>
            {displayString || placeholder}
          </span>

          <div className="flex items-center gap-1.5 ml-2 text-slate-400">
            {showClearButton && value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Bersihkan tanggal"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClear(e);
                  }
                }}
                className="p-0.5 hover:text-slate-600 rounded transition"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            )}

            <svg
              className="h-5 w-5 text-slate-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </button>
      </div>

      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p id={`${id}-help`} className="text-sm text-app-text-muted">
          {helperText}
        </p>
      )}

      {mounted && popoverContent && createPortal(popoverContent, document.body)}
    </div>
  );
}

