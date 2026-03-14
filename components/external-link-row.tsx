"use client";

import type { ReactNode } from "react";

export function ExternalLinkRow({
  href,
  meta,
  metaClassName,
  title,
  titleAccent = false,
}: {
  href: string;
  meta: ReactNode;
  metaClassName?: string;
  title: ReactNode;
  titleAccent?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block rounded-md border border-[var(--color-border)] p-2 hover:bg-[var(--color-surface)]"
    >
      <p className={`line-clamp-1 text-sm ${titleAccent ? "text-[var(--color-accent)] hover:underline" : "font-medium"}`}>{title}</p>
      <p className={metaClassName ?? "text-xs text-[var(--color-muted)]"}>{meta}</p>
    </a>
  );
}
