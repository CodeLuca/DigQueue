"use client";

import type { ReactNode } from "react";
import { MediaActionRow } from "@/components/media-action-row";
import { SupportText } from "@/components/support-text";

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
        actions={<SupportText size="11">Score {score.toFixed(1)}</SupportText>}
      />
      {reason ? <SupportText className="mt-1">{reason}</SupportText> : null}
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
        {children}
      </div>
    </div>
  );
}
