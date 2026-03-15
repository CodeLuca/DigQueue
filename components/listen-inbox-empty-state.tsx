"use client";

import { EmptyStateNote } from "@/components/empty-state-note";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ListenInboxEmptyState } from "@/lib/listen-inbox-types";

export function ListenInboxEmptyStateCard({
  emptyState,
}: {
  emptyState?: ListenInboxEmptyState;
}) {
  if (!emptyState) {
    return <EmptyStateNote title="Nothing pending for this view." />;
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
      <p className="text-sm font-medium">{emptyState.title}</p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{emptyState.detail}</p>
      {emptyState.actionHref && emptyState.actionLabel ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={emptyState.actionHref}>
            <Button type="button" size="sm" variant="outline">
              {emptyState.actionLabel}
            </Button>
          </Link>
          {emptyState.secondaryActionHref && emptyState.secondaryActionLabel ? (
            <Link href={emptyState.secondaryActionHref}>
              <Button type="button" size="sm" variant="ghost">
                {emptyState.secondaryActionLabel}
              </Button>
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
