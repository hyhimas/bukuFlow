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
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <input
        id={id}
        {...props}
        className={`w-full rounded-lg border px-4 py-3 text-sm text-slate-900 outline-none transition
          focus:border-blue-500
          focus:ring-2
          focus:ring-blue-100
          ${
            error
              ? "border-red-400"
              : "border-slate-300"
          }
          ${className}`}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p className="text-sm text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
}