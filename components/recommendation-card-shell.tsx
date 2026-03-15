"use client";

import type { ReactNode } from "react";
import { MediaActionRow } from "@/components/media-action-row";

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
      <MediaActionRow
        size="lg"
        artworkAlt={artworkAlt}
        artworkUrl={artworkUrl}
        title={title}
        meta={meta}
        actions={<p className="text-[11px] text-[var(--color-muted)]">Score {score.toFixed(1)}</p>}
      />
      {reason ? <p className="mt-1 text-xs text-[var(--color-muted)]">{reason}</p> : null}
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
        {children}
      </div>
    </div>
  );
}
