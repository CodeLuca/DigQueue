"use client";

import { CheckCheck, CheckCircle2, CheckSquare, Heart, HeartOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTrackSaveActionLabels } from "@/lib/library-action-labels";

export function ListenInboxBulkActions({
  onBulkMarkVisiblePlayedReviewed,
  onBulkSetSelectedListened,
  onBulkSetSelectedSavedFalse,
  onBulkSetSelectedSavedTrue,
  onClearSelectedTracks,
  onSelectVisibleTracks,
  selectedCount,
  showQueueFilters,
  visibleCount,
  visibleNeedsReviewCount,
  compact = false,
}: {
  onBulkMarkVisiblePlayedReviewed: () => void;
  onBulkSetSelectedListened: () => void;
  onBulkSetSelectedSavedFalse: () => void;
  onBulkSetSelectedSavedTrue: () => void;
  onClearSelectedTracks: () => void;
  onSelectVisibleTracks: () => void;
  selectedCount: number;
  showQueueFilters: boolean;
  visibleCount: number;
  visibleNeedsReviewCount: number;
  compact?: boolean;
}) {
  const selectClass = compact ? "w-full justify-center" : "w-full justify-center sm:w-auto sm:justify-start";
  const selectedTextClass = compact ? "col-span-2 text-[var(--color-muted)]" : "col-span-2 text-[var(--color-muted)] sm:col-auto";
  const reviewedClass = compact
    ? "col-span-2 w-full justify-center"
    : "col-span-2 w-full justify-center sm:col-auto sm:w-auto sm:justify-start";
  const secondaryClass = compact ? "w-full justify-center" : "w-full justify-center sm:w-auto sm:justify-start";
  const saveLabels = getTrackSaveActionLabels(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={selectClass}
        onClick={onSelectVisibleTracks}
        disabled={visibleCount === 0}
        title="Select every track currently visible"
      >
        <CheckSquare className="h-3.5 w-3.5" />
        Select all
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={selectClass}
        onClick={onClearSelectedTracks}
        disabled={selectedCount === 0}
        title="Clear all selected tracks"
      >
        <X className="h-3.5 w-3.5" />
        {compact ? "Clear" : "Clear selection"}
      </Button>
      {!compact ? <span className={selectedTextClass}>{selectedCount} selected</span> : null}
      {showQueueFilters && selectedCount > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={reviewedClass}
          onClick={onBulkSetSelectedListened}
          disabled={selectedCount === 0}
          title="Mark selected tracks as reviewed"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Mark selected reviewed
        </Button>
      ) : null}
      {showQueueFilters && visibleNeedsReviewCount > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={secondaryClass}
          onClick={onBulkMarkVisiblePlayedReviewed}
          disabled={visibleNeedsReviewCount === 0}
          title="Mark all played tracks in this view as reviewed"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all played reviewed ({visibleNeedsReviewCount})
        </Button>
      ) : null}
      {selectedCount > 0 ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={secondaryClass}
            onClick={onBulkSetSelectedSavedTrue}
            disabled={selectedCount === 0}
            title={saveLabels.title}
            aria-label={saveLabels.ariaLabel}
          >
            <Heart className="h-3.5 w-3.5" />
            Save selected
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={secondaryClass}
            onClick={onBulkSetSelectedSavedFalse}
            disabled={selectedCount === 0}
            title="Remove selected tracks from local saved list"
          >
            <HeartOff className="h-3.5 w-3.5" />
            Unsave selected
          </Button>
        </>
      ) : null}
    </>
  );
}
