import type { ReactNode } from "react";

export type FieldProps = {
  id?: string;
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: ReactNode;
  className?: string;
};

export default function Field({
  id,
  label,
  required = false,
  error,
  helperText,
  children,
  className = "",
}: FieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-text-muted"
      >
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {error && (
        <p
          id={id ? `${id}-error` : undefined}
          role="alert"
          className="text-sm text-danger"
        >
          {error}
        </p>
      )}

      {!error && helperText && (
        <p
          id={id ? `${id}-help` : undefined}
          className="text-sm text-text-muted"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

