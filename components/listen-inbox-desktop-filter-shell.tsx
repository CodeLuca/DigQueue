"use client";

import { ListenInboxBulkActions } from "@/components/listen-inbox-bulk-actions";
import { ListenInboxQueueFilterSets } from "@/components/listen-inbox-queue-filters";
import type {
  InboxFilterCounts,
  PlaybackMode,
  QueueStateView,
  SourceFilter,
  VideoFilter,
} from "@/lib/listen-inbox-control-types";

export function ListenInboxDesktopFilterShell({
  advancedFiltersOpen,
  hasAdvancedFiltersActive,
  hideAlreadyPlayed,
  hideReviewed,
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
  onBulkMarkVisiblePlayedReviewed,
  onBulkSetSelectedListened,
  onBulkSetSelectedSavedFalse,
  onBulkSetSelectedSavedTrue,
  onClearSelectedTracks,
  onSelectVisibleTracks,
  onSetAdvancedFiltersOpen,
  onSetHideAlreadyPlayed,
  onSetHideReviewed,
  onSetPlaybackMode,
  onSetSourceFilter,
  onSetStateView,
  onSetVideoFilter,
}: {
  advancedFiltersOpen: boolean;
  hasAdvancedFiltersActive: boolean;
  hideAlreadyPlayed: boolean;
  hideReviewed: boolean;
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
  onBulkMarkVisiblePlayedReviewed: () => void;
  onBulkSetSelectedListened: () => void;
  onBulkSetSelectedSavedFalse: () => void;
  onBulkSetSelectedSavedTrue: () => void;
  onClearSelectedTracks: () => void;
  onSelectVisibleTracks: () => void;
  onSetAdvancedFiltersOpen: (next: boolean) => void;
  onSetHideAlreadyPlayed: (next: boolean) => void;
  onSetHideReviewed: (next: boolean) => void;
  onSetPlaybackMode: (mode: PlaybackMode) => void;
  onSetSourceFilter: (filter: SourceFilter) => void;
  onSetStateView: (view: QueueStateView) => void;
  onSetVideoFilter: (filter: VideoFilter) => void;
}) {
  return (
    <>
      {showQueueFilters ? (
        <div className="hidden flex-wrap items-center gap-2 text-xs sm:flex">
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
          />
        </div>
      ) : null}
      <div className="mt-1.5 hidden text-xs sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
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
        />
      </div>
    </>
  );
}
