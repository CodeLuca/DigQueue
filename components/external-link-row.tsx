"use client";

import type { ReactNode } from "react";
import { CompactResultRow } from "@/components/compact-result-row";

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
    <CompactResultRow
      href={href}
      meta={meta}
      metaClassName={metaClassName ?? "text-xs text-[var(--color-muted)]"}
      title={title}
      titleClassName={titleAccent ? "text-sm text-[var(--color-accent)] hover:underline" : "text-sm font-medium"}
    />
  );
}
