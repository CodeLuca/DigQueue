"use client";

import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { ListenInboxControlShell } from "@/components/listen-inbox-control-shell";
import { DiscogsLink } from "@/components/discogs-link";
import { Button } from "@/components/ui/button";
import type {
  InboxFilterCounts,
  ListenInboxLabelOption,
  PlaybackMode,
  QueueStateView,
  SourceFilter,
  VideoFilter,
  WishlistSourceCounts,
  WishlistSourceFilterValue,
} from "@/lib/listen-inbox-control-types";

export function ListenInboxHeaderShell({
  activeLabelDiscogsUrl,
  activeLabelId,
  activeLabelIndex,
  advancedFiltersOpen,
  commuteModeActive,
  compactMobileRows,
  effectiveLabelOptions,
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
  onMoveLabel,
  onResetCommuteMode,
  onSelectVisibleTracks,
  onSetActiveLabelId,
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
  activeLabelDiscogsUrl?: string | null;
  activeLabelId: number | null;
  activeLabelIndex: number;
  advancedFiltersOpen: boolean;
  commuteModeActive: boolean;
  compactMobileRows: boolean;
  effectiveLabelOptions: ListenInboxLabelOption[];
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
  onMoveLabel: (direction: -1 | 1) => void;
  onResetCommuteMode: () => void;
  onSelectVisibleTracks: () => void;
  onSetActiveLabelId: (next: number | null) => void;
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
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-2.5">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[color-mix(in_oklab,var(--color-accent)_35%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-surface)_70%,var(--color-surface2)_30%)] p-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onMoveLabel(-1)}
            disabled={effectiveLabelOptions.length === 0}
            title="Select previous label"
            className="h-10 shrink-0 border-[color-mix(in_oklab,var(--color-accent)_38%,var(--color-border-soft))] bg-[var(--color-surface)] px-4 text-sm font-semibold"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev label
          </Button>
          <select
            value={activeLabelId === null ? "" : String(activeLabelId)}
            onChange={(event) => onSetActiveLabelId(event.target.value ? Number(event.target.value) : null)}
            className="h-10 min-w-[220px] flex-1 rounded-md border border-[color-mix(in_oklab,var(--color-accent)_35%,var(--color-border))] bg-[var(--color-surface)] px-4 text-base font-medium"
            title="Filter tracks by label"
            aria-label="Filter tracks by label"
          >
            <option value="">All sources</option>
            {effectiveLabelOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onMoveLabel(1)}
            disabled={effectiveLabelOptions.length === 0}
            title="Select next label"
            className="h-10 shrink-0 border-[color-mix(in_oklab,var(--color-accent)_38%,var(--color-border-soft))] bg-[var(--color-surface)] px-4 text-sm font-semibold"
          >
            <ChevronRight className="h-3.5 w-3.5" />
            Next label
          </Button>
          {activeLabelDiscogsUrl ? (
            <DiscogsLink
              className="rounded-md p-2"
              discogsUrl={activeLabelDiscogsUrl}
              title="Open selected label on Discogs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </DiscogsLink>
          ) : null}
          {activeLabelIndex >= 0 ? (
            <span className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--color-text)]">
              {activeLabelIndex + 1}/{effectiveLabelOptions.length}
            </span>
          ) : null}
        </div>
        <ListenInboxControlShell
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
          showWishlistSourceFilter={showWishlistSourceFilter}
          sourceFilter={sourceFilter}
          sourceFilterCounts={sourceFilterCounts}
          stateView={stateView}
          videoFilter={videoFilter}
          videoFilterCounts={videoFilterCounts}
          visibleCount={visibleCount}
          visibleNeedsReviewCount={visibleNeedsReviewCount}
          wishlistSourceCounts={wishlistSourceCounts}
          wishlistSourceFilter={wishlistSourceFilter}
          onApplyCommuteMode={onApplyCommuteMode}
          onBulkMarkVisiblePlayedReviewed={onBulkMarkVisiblePlayedReviewed}
          onBulkSetSelectedListened={onBulkSetSelectedListened}
          onBulkSetSelectedSavedFalse={onBulkSetSelectedSavedFalse}
          onBulkSetSelectedSavedTrue={onBulkSetSelectedSavedTrue}
          onClearSelectedTracks={onClearSelectedTracks}
          onResetCommuteMode={onResetCommuteMode}
          onSelectVisibleTracks={onSelectVisibleTracks}
          onSetAdvancedFiltersOpen={onSetAdvancedFiltersOpen}
          onSetCompactMobileRows={onSetCompactMobileRows}
          onSetHideAlreadyPlayed={onSetHideAlreadyPlayed}
          onSetHideReviewed={onSetHideReviewed}
          onSetMobileAutoAdvancePlay={onSetMobileAutoAdvancePlay}
          onSetPlaybackMode={onSetPlaybackMode}
          onSetSourceFilter={onSetSourceFilter}
          onSetStateView={onSetStateView}
          onSetVideoFilter={onSetVideoFilter}
          onSetWishlistSourceFilter={onSetWishlistSourceFilter}
        />
      </div>
    </div>
  );
}
