"use client";

import type { ReactNode } from "react";
import Image from "next/image";

export function RecommendationCardShell({
  artworkAlt,
  artworkUrl,
  children,
  meta,
  reason,
  score,
  title,
}: {
  artworkAlt: string;
  artworkUrl?: string | null;
  children: ReactNode;
  meta: ReactNode;
  reason?: ReactNode;
  score: number;
  title: string;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] p-3">
      <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          {artworkUrl ? (
            <Image
              src={artworkUrl}
              alt={artworkAlt}
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded border border-[var(--color-border)] object-cover"
            />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-medium">{title}</p>
            <p className="line-clamp-1 text-xs text-[var(--color-muted)]">{meta}</p>
          </div>
        </div>
        <p className="text-[11px] text-[var(--color-muted)]">Score {score.toFixed(1)}</p>
      </div>
      {reason ? <p className="mt-1 text-xs text-[var(--color-muted)]">{reason}</p> : null}
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
        {children}
      </div>
    </div>
  );
}
