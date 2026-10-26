import type { ReactNode } from "react";
import BackLink from "./BackLink";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backLink?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  actions,
  backLink,
  badge,
  className = "",
}: PageHeaderProps) {
  const renderedBackLink =
    typeof backLink === "string" ? (
      <BackLink href={backLink} />
    ) : (
      backLink
    );

  return (
    <div
      className={`flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ${className}`}
    >
      <div className="min-w-0 flex-1">
        {renderedBackLink && <div className="mb-2">{renderedBackLink}</div>}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1 text-sm text-slate-500 leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="w-full lg:w-auto lg:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
