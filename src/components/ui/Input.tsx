import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  helperText?: string;
};

export default function Input({
  label,
  error,
  helperText,
  id,
  className = "",
  ...props
}: InputProps) {
  const descriptionId = error
    ? `${id}-error`
    : helperText
      ? `${id}-help`
      : undefined;

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-app-text-muted"
      >
        {label}
      </label>

      <input
        id={id}
        {...props}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={descriptionId}
        className={`w-full rounded-app border px-4 py-3 text-sm text-app-text outline-none transition
          focus:border-brand
          focus:ring-2
          focus:ring-blue-100
          ${
            error
              ? "border-danger"
              : "border-app-border"
          }
          ${className}`}
      />

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
    </div>
  );
}
