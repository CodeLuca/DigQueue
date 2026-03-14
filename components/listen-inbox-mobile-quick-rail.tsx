"use client";

import { CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { ListenInboxAutoNextToggleButton } from "@/components/listen-inbox-mobile-controls";
import { Button } from "@/components/ui/button";
import {
  ListenInboxCurrentActionGrid,
  ListenInboxCurrentCollapsedPlay,
} from "@/components/listen-inbox-current-actions";
import type { ListenInboxCurrentRow } from "@/lib/listen-inbox-current-controls";

export function ListenInboxMobileQuickRail({
  activeCursor,
  canGoNextVisibleRow,
  canGoPrevVisibleRow,
  collapsed,
  current,
  currentCanPlay,
  currentDisabledReason,
  currentPlayHint,
  mobileAutoAdvancePlay,
  nextNeedsReviewCursor,
  playbackPendingTrackId,
  reviewingReleaseId,
  visibleRowsLength,
  onCollapse,
  onExpand,
  onGoNextVisibleRow,
  onGoPrevVisibleRow,
  onJumpToNextNeedsReview,
  onMarkCurrentListened,
  onMarkCurrentReleaseListened,
  onPlayCurrent,
  onSkipAndPlayNext,
  onToggleCurrentSaved,
  onToggleMobileAutoAdvancePlay,
}: {
  activeCursor: number;
  canGoNextVisibleRow: boolean;
  canGoPrevVisibleRow: boolean;
  collapsed: boolean;
  current: ListenInboxCurrentRow;
  currentCanPlay: boolean;
  currentDisabledReason: string | null;
  currentPlayHint: string | null;
  mobileAutoAdvancePlay: boolean;
  nextNeedsReviewCursor: number;
  playbackPendingTrackId: number | null;
  reviewingReleaseId: number | null;
  visibleRowsLength: number;
  onCollapse: () => void;
  onExpand: () => void;
  onGoNextVisibleRow: () => void;
  onGoPrevVisibleRow: () => void;
  onJumpToNextNeedsReview: () => void;
  onMarkCurrentListened: () => void;
  onMarkCurrentReleaseListened: () => void;
  onPlayCurrent: () => void;
  onSkipAndPlayNext: () => void;
  onToggleCurrentSaved: () => void;
  onToggleMobileAutoAdvancePlay: () => void;
}) {
  return (
    <div className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_88%,black_12%)] p-2 shadow-xl sm:hidden">
      {collapsed ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={onExpand}
            aria-label="Expand quick actions"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <p className="line-clamp-1 min-w-0 flex-1 text-[11px] font-medium text-[var(--color-text)]">
            {current.position} {current.trackTitle}
          </p>
          <ListenInboxCurrentCollapsedPlay
            onPlay={onPlayCurrent}
            disabled={!currentCanPlay || playbackPendingTrackId === current.trackId}
            loading={playbackPendingTrackId === current.trackId}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={onGoPrevVisibleRow}
              disabled={!canGoPrevVisibleRow}
              aria-label="Previous track in current view"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <p className="line-clamp-1 text-[11px] font-medium text-[var(--color-text)]">
                {current.position} {current.trackTitle}
              </p>
              <p className="line-clamp-1 text-[10px] text-[var(--color-muted)]">
                {activeCursor + 1}/{visibleRowsLength} • {current.labelName}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={onGoNextVisibleRow}
              disabled={!canGoNextVisibleRow}
              aria-label="Next track in current view"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="mt-1 flex justify-end">
            <div className="flex items-center gap-1.5">
              <ListenInboxAutoNextToggleButton
                enabled={mobileAutoAdvancePlay}
                compact
                onToggle={onToggleMobileAutoAdvancePlay}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px] text-[var(--color-muted)]"
                onClick={onCollapse}
                aria-label="Collapse quick actions"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Collapse
              </Button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 w-full justify-center"
              onClick={onJumpToNextNeedsReview}
              disabled={nextNeedsReviewCursor < 0}
              title="Jump to next played track that still needs review"
              aria-label="Jump to next track needing review"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Next needs review
            </Button>
            <ListenInboxCurrentActionGrid
              currentCanPlay={currentCanPlay}
              currentDisabledReason={currentDisabledReason}
              currentPlayHint={currentPlayHint}
              current={current}
              playbackPendingTrackId={playbackPendingTrackId}
              reviewingRelease={reviewingReleaseId === current.releaseId}
              onPlay={onPlayCurrent}
              onMarkTrackReviewed={onMarkCurrentListened}
              onToggleSaved={onToggleCurrentSaved}
              onMarkReleaseReviewed={onMarkCurrentReleaseListened}
              onSkipAndPlayNext={onSkipAndPlayNext}
              canSkipAndPlayNext={canGoNextVisibleRow}
            />
          </div>
        </>
      )}
    </div>
  );
}
