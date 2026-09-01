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
      className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:text-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}
