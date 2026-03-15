"use client";

import type { ReactNode } from "react";
import Image from "next/image";

type MediaActionRowProps = {
  artworkAlt: string;
  artworkUrl?: string | null;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  size?: "sm" | "md" | "lg";
};

export function MediaActionRow({
  artworkAlt,
  artworkUrl,
  title,
  meta,
  actions,
  size = "md",
}: MediaActionRowProps) {
  const imageClass = size === "sm"
    ? "h-9 w-9 rounded border border-[var(--color-border)] object-cover"
    : size === "lg"
      ? "h-12 w-12 rounded border border-[var(--color-border)] object-cover"
      : "h-10 w-10 rounded-md border border-[var(--color-border)] object-cover";
  const fallbackClass = size === "sm"
    ? "h-9 w-9 rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
    : size === "lg"
      ? "h-12 w-12 rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
      : "h-10 w-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]";
  const titleClass = size === "lg" ? "line-clamp-1 text-sm font-medium" : "line-clamp-1 text-xs font-medium";

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        {artworkUrl ? (
          <Image
            src={artworkUrl}
            alt={artworkAlt}
            width={40}
            height={40}
            className={imageClass}
          />
        ) : (
          <div className={fallbackClass} aria-hidden />
        )}
        <div className="min-w-0">
          <p className={titleClass}>{title}</p>
          {meta ? <div className="line-clamp-2 text-xs text-[var(--color-muted)]">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
