import { forwardRef, type InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  helperText?: string;
  endSlot?: React.ReactNode;
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    endSlot,
    id,
    className = "",
    required,
    ...props
  },
  ref
) {
  const descriptionId =
    id && (error || helperText)
      ? error
        ? `${id}-error`
        : `${id}-help`
      : undefined;

  return (
    <div className="space-y-1.5">
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

      <div className="relative">
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={descriptionId}
          className={`w-full h-11 rounded-lg border bg-input px-4 py-2.5 text-sm text-text-main placeholder:text-placeholder outline-none transition
            focus-visible:outline-none
            focus-visible:border-brand
            focus-visible:ring-2
            focus-visible:ring-brand/20
            ${
              error
                ? "border-danger focus-visible:border-danger focus-visible:ring-danger/20"
                : "border-border"
            }
            ${endSlot ? "pr-11" : ""}
            ${className}`}
          {...props}
        />
        {endSlot && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            {endSlot}
          </div>
        )}
      </div>

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
});

export default Input;