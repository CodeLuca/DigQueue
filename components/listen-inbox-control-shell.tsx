"use client";

import { ListenInboxDesktopFilterShell } from "@/components/listen-inbox-desktop-filter-shell";
import { ListenInboxMobileFilterShell } from "@/components/listen-inbox-mobile-filter-shell";
import { ListenInboxWishlistSourceFilter } from "@/components/listen-inbox-wishlist-source-filter";
import type {
  InboxFilterCounts,
  PlaybackMode,
  QueueStateView,
  SourceFilter,
  VideoFilter,
  WishlistSourceCounts,
  WishlistSourceFilterValue,
} from "@/lib/listen-inbox-control-types";

export function ListenInboxControlShell({
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
  showWishlistSourceFilter,
  sourceFilter,
  sourceFilterCounts,
  stateView,
  videoFilter,
  videoFilterCounts,
  visibleCount,
  visibleNeedsReviewCount,
  wishlistSourceCounts,
  wishlistSourceFilter,
  onApplyCommuteMode,
  onBulkMarkVisiblePlayedReviewed,
  onBulkSetSelectedListened,
  onBulkSetSelectedSavedFalse,
  onBulkSetSelectedSavedTrue,
  onClearSelectedTracks,
  onResetCommuteMode,
  onSelectVisibleTracks,
  onSetAdvancedFiltersOpen,
  onSetCompactMobileRows,
  onSetHideAlreadyPlayed,
  onSetHideReviewed,
  onSetMobileAutoAdvancePlay,
  onSetPlaybackMode,
  onSetSourceFilter,
  onSetStateView,
  onSetVideoFilter,
  onSetWishlistSourceFilter,
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
  showWishlistSourceFilter: boolean;
  sourceFilter: SourceFilter;
  sourceFilterCounts: InboxFilterCounts;
  stateView: QueueStateView;
  videoFilter: VideoFilter;
  videoFilterCounts: InboxFilterCounts;
  visibleCount: number;
  visibleNeedsReviewCount: number;
  wishlistSourceCounts: WishlistSourceCounts;
  wishlistSourceFilter: WishlistSourceFilterValue;
  onApplyCommuteMode: () => void;
  onBulkMarkVisiblePlayedReviewed: () => void;
  onBulkSetSelectedListened: () => void;
  onBulkSetSelectedSavedFalse: () => void;
  onBulkSetSelectedSavedTrue: () => void;
  onClearSelectedTracks: () => void;
  onResetCommuteMode: () => void;
  onSelectVisibleTracks: () => void;
  onSetAdvancedFiltersOpen: (next: boolean) => void;
  onSetCompactMobileRows: (next: boolean) => void;
  onSetHideAlreadyPlayed: (next: boolean) => void;
  onSetHideReviewed: (next: boolean) => void;
  onSetMobileAutoAdvancePlay: (next: boolean) => void;
  onSetPlaybackMode: (mode: PlaybackMode) => void;
  onSetSourceFilter: (filter: SourceFilter) => void;
  onSetStateView: (view: QueueStateView) => void;
  onSetVideoFilter: (filter: VideoFilter) => void;
  onSetWishlistSourceFilter: (next: WishlistSourceFilterValue) => void;
}) {
  return (
    <>
      {showWishlistSourceFilter ? (
        <ListenInboxWishlistSourceFilter
          counts={wishlistSourceCounts}
          value={wishlistSourceFilter}
          onChange={onSetWishlistSourceFilter}
        />
      ) : null}

      <ListenInboxMobileFilterShell
        advancedFiltersOpen={advancedFiltersOpen}
        commuteModeActive={commuteModeActive}
        compactMobileRows={compactMobileRows}
        hasAdvancedFiltersActive={hasAdvancedFiltersActive}
        hideAlreadyPlayed={hideAlreadyPlayed}
        hideReviewed={hideReviewed}
        mobileAutoAdvancePlay={mobileAutoAdvancePlay}
        playbackMode={playbackMode}
        queueFilterCounts={queueFilterCounts}
        selectedCount={selectedCount}
        showQueueFilters={showQueueFilters}
        sourceFilter={sourceFilter}
        sourceFilterCounts={sourceFilterCounts}
        stateView={stateView}
        videoFilter={videoFilter}
        videoFilterCounts={videoFilterCounts}
        visibleCount={visibleCount}
        visibleNeedsReviewCount={visibleNeedsReviewCount}
        onApplyCommuteMode={onApplyCommuteMode}
        onBulkMarkVisiblePlayedReviewed={onBulkMarkVisiblePlayedReviewed}
        onBulkSetSelectedListened={onBulkSetSelectedListened}
        onBulkSetSelectedSavedFalse={onBulkSetSelectedSavedFalse}
        onBulkSetSelectedSavedTrue={onBulkSetSelectedSavedTrue}
        onClearSelectedTracks={onClearSelectedTracks}
        onResetCommuteMode={onResetCommuteMode}
        onSelectVisibleTracks={onSelectVisibleTracks}
        onSetAdvancedFiltersOpen={onSetAdvancedFiltersOpen}
        onSetHideAlreadyPlayed={onSetHideAlreadyPlayed}
        onSetHideReviewed={onSetHideReviewed}
        onSetPlaybackMode={onSetPlaybackMode}
        onSetSourceFilter={onSetSourceFilter}
        onSetStateView={onSetStateView}
        onSetVideoFilter={onSetVideoFilter}
        onToggleCompactRows={() => onSetCompactMobileRows(!compactMobileRows)}
        onToggleMobileAutoAdvancePlay={() => onSetMobileAutoAdvancePlay(!mobileAutoAdvancePlay)}
      />

      {!showQueueFilters ? (
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          This view combines saved tracks and wishlisted-record tracks. Use filters to split them.
        </p>
      ) : null}

      <ListenInboxDesktopFilterShell
        advancedFiltersOpen={advancedFiltersOpen}
        hasAdvancedFiltersActive={hasAdvancedFiltersActive}
        hideAlreadyPlayed={hideAlreadyPlayed}
        hideReviewed={hideReviewed}
        playbackMode={playbackMode}
        queueFilterCounts={queueFilterCounts}
        selectedCount={selectedCount}
        showQueueFilters={showQueueFilters}
        sourceFilter={sourceFilter}
        sourceFilterCounts={sourceFilterCounts}
        stateView={stateView}
        videoFilter={videoFilter}
        videoFilterCounts={videoFilterCounts}
        visibleCount={visibleCount}
        visibleNeedsReviewCount={visibleNeedsReviewCount}
        onBulkMarkVisiblePlayedReviewed={onBulkMarkVisiblePlayedReviewed}
        onBulkSetSelectedListened={onBulkSetSelectedListened}
        onBulkSetSelectedSavedFalse={onBulkSetSelectedSavedFalse}
        onBulkSetSelectedSavedTrue={onBulkSetSelectedSavedTrue}
        onClearSelectedTracks={onClearSelectedTracks}
        onSelectVisibleTracks={onSelectVisibleTracks}
        onSetAdvancedFiltersOpen={onSetAdvancedFiltersOpen}
        onSetHideAlreadyPlayed={onSetHideAlreadyPlayed}
        onSetHideReviewed={onSetHideReviewed}
        onSetPlaybackMode={onSetPlaybackMode}
        onSetSourceFilter={onSetSourceFilter}
        onSetStateView={onSetStateView}
        onSetVideoFilter={onSetVideoFilter}
      />
    </>
  );
}
