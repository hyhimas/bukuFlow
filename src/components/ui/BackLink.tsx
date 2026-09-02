import Link from "next/link";
import type { ComponentProps } from "react";

type BackLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  children?: string;
};

export default function BackLink({
  children = "Kembali ke dashboard",
  ...props
}: BackLinkProps) {
  return (
    <Link
      {...props}
      className="inline-flex min-h-11 items-center gap-2 rounded-app border border-app-border bg-app-surface px-3 py-2 text-sm font-semibold text-app-text transition hover:bg-neutral-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      <span aria-hidden="true" className="text-base leading-none">
        ←
      </span>
      <span>{children}</span>
    </Link>
  );
}