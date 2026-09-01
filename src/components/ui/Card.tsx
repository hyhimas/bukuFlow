import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export default function Card({
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={`rounded-app border border-app-border bg-app-surface shadow-app ${className}`}
    >
      {children}
    </div>
  );
}
