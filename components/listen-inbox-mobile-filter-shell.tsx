"use client";

import { ListenInboxBulkActions } from "@/components/listen-inbox-bulk-actions";
import { ListenInboxMobilePresetControls } from "@/components/listen-inbox-mobile-controls";
import { ListenInboxQueueFilterSets } from "@/components/listen-inbox-queue-filters";
import type {
  InboxFilterCounts,
  PlaybackMode,
  QueueStateView,
  SourceFilter,
  VideoFilter,
} from "@/lib/listen-inbox-control-types";

export function ListenInboxMobileFilterShell({
  advancedFiltersOpen,
  commuteModeActive,
  compactMobileRows,
  hasAdvancedFiltersActive,
  hideAlreadyPlayed,
  hideReviewed,
  mobileAutoAdvancePlay,
  playbackMode,
  queueFilterCounts,
  selectedCount,
  showQueueFilters,
  sourceFilter,
  sourceFilterCounts,
  stateView,
  videoFilter,
  videoFilterCounts,
  visibleCount,
  visibleNeedsReviewCount,
  onApplyCommuteMode,
  onBulkMarkVisiblePlayedReviewed,
  onBulkSetSelectedListened,
  onBulkSetSelectedSavedFalse,
  onBulkSetSelectedSavedTrue,
  onClearSelectedTracks,
  onResetCommuteMode,
  onSelectVisibleTracks,
  onSetAdvancedFiltersOpen,
  onSetHideAlreadyPlayed,
  onSetHideReviewed,
  onSetPlaybackMode,
  onSetSourceFilter,
  onSetStateView,
  onSetVideoFilter,
  onToggleCompactRows,
  onToggleMobileAutoAdvancePlay,
}: {
  advancedFiltersOpen: boolean;
  commuteModeActive: boolean;
  compactMobileRows: boolean;
  hasAdvancedFiltersActive: boolean;
  hideAlreadyPlayed: boolean;
  hideReviewed: boolean;
  mobileAutoAdvancePlay: boolean;
  playbackMode: PlaybackMode;
  queueFilterCounts: InboxFilterCounts;
  selectedCount: number;
  showQueueFilters: boolean;
  sourceFilter: SourceFilter;
  sourceFilterCounts: InboxFilterCounts;
  stateView: QueueStateView;
  videoFilter: VideoFilter;
  videoFilterCounts: InboxFilterCounts;
  visibleCount: number;
  visibleNeedsReviewCount: number;
  onApplyCommuteMode: () => void;
  onBulkMarkVisiblePlayedReviewed: () => void;
  onBulkSetSelectedListened: () => void;
  onBulkSetSelectedSavedFalse: () => void;
  onBulkSetSelectedSavedTrue: () => void;
  onClearSelectedTracks: () => void;
  onResetCommuteMode: () => void;
  onSelectVisibleTracks: () => void;
  onSetAdvancedFiltersOpen: (next: boolean) => void;
  onSetHideAlreadyPlayed: (next: boolean) => void;
  onSetHideReviewed: (next: boolean) => void;
  onSetPlaybackMode: (mode: PlaybackMode) => void;
  onSetSourceFilter: (filter: SourceFilter) => void;
  onSetStateView: (view: QueueStateView) => void;
  onSetVideoFilter: (filter: VideoFilter) => void;
  onToggleCompactRows: () => void;
  onToggleMobileAutoAdvancePlay: () => void;
}) {
  if (!showQueueFilters) return null;

  return (
    <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2 sm:hidden">
      <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Filters & Bulk
      </summary>
      <div className="mt-2 space-y-2">
        <ListenInboxMobilePresetControls
          commuteModeActive={commuteModeActive}
          compactMobileRows={compactMobileRows}
          mobileAutoAdvancePlay={mobileAutoAdvancePlay}
          onApplyCommuteMode={onApplyCommuteMode}
          onResetCommuteMode={onResetCommuteMode}
          onToggleCompactRows={onToggleCompactRows}
          onToggleMobileAutoAdvancePlay={onToggleMobileAutoAdvancePlay}
        />
        <ListenInboxQueueFilterSets
          advancedFiltersOpen={advancedFiltersOpen}
          hasAdvancedFiltersActive={hasAdvancedFiltersActive}
          hideAlreadyPlayed={hideAlreadyPlayed}
          hideReviewed={hideReviewed}
          playbackMode={playbackMode}
          queueFilterCounts={queueFilterCounts}
          sourceFilter={sourceFilter}
          sourceFilterCounts={sourceFilterCounts}
          stateView={stateView}
          videoFilter={videoFilter}
          videoFilterCounts={videoFilterCounts}
          onSetAdvancedFiltersOpen={onSetAdvancedFiltersOpen}
          onSetHideAlreadyPlayed={onSetHideAlreadyPlayed}
          onSetHideReviewed={onSetHideReviewed}
          onSetPlaybackMode={onSetPlaybackMode}
          onSetSourceFilter={onSetSourceFilter}
          onSetStateView={onSetStateView}
          onSetVideoFilter={onSetVideoFilter}
          compact
        />
        <div className="grid grid-cols-2 gap-1.5">
          <ListenInboxBulkActions
            onBulkMarkVisiblePlayedReviewed={onBulkMarkVisiblePlayedReviewed}
            onBulkSetSelectedListened={onBulkSetSelectedListened}
            onBulkSetSelectedSavedFalse={onBulkSetSelectedSavedFalse}
            onBulkSetSelectedSavedTrue={onBulkSetSelectedSavedTrue}
            onClearSelectedTracks={onClearSelectedTracks}
            onSelectVisibleTracks={onSelectVisibleTracks}
            selectedCount={selectedCount}
            showQueueFilters={showQueueFilters}
            visibleCount={visibleCount}
            visibleNeedsReviewCount={visibleNeedsReviewCount}
            compact
          />
        </div>
      </div>
    </details>
  );
}
