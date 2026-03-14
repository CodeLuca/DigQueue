"use client";

import type { MutableRefObject } from "react";
import { ListenInboxEmptyStateCard } from "@/components/listen-inbox-empty-state";
import { ListenInboxRow } from "./listen-inbox-row";
import type { ListenInboxEmptyState, ListenRow } from "@/lib/listen-inbox-types";

export function ListenInboxListShell({
  activeCursor,
  activeLabelIds,
  addedLabelReleaseIds,
  addingLabelReleaseId,
  compactMobileRows,
  emptyState,
  playbackDisabledNotice,
  playbackPendingTrackId,
  playerIsPlaying,
  playingTrackId,
  reviewingReleaseId,
  rowRefs,
  selectedSet,
  showMobileQuickRail,
  showQueueFilters,
  visibleRows,
  wishlistReleaseIdLoading,
  youtubeQuotaExceeded,
  onAddRowLabel,
  onHoverRow,
  onPlayRow,
  onReviewRelease,
  onReviewTrack,
  onSelectCursor,
  onSelectTrack,
  onToggleRowSaved,
  onToggleRowWishlist,
}: {
  activeCursor: number;
  activeLabelIds: Set<number>;
  addedLabelReleaseIds: number[];
  addingLabelReleaseId: number | null;
  compactMobileRows: boolean;
  emptyState?: ListenInboxEmptyState;
  playbackDisabledNotice: string;
  playbackPendingTrackId: number | null;
  playerIsPlaying: boolean;
  playingTrackId: number | null;
  reviewingReleaseId: number | null;
  rowRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  selectedSet: Set<number>;
  showMobileQuickRail: boolean;
  showQueueFilters: boolean;
  visibleRows: ListenRow[];
  wishlistReleaseIdLoading: number | null;
  youtubeQuotaExceeded: boolean;
  onAddRowLabel: (releaseId: number) => void;
  onHoverRow: (index: number) => void;
  onPlayRow: (trackId: number) => void;
  onReviewRelease: (releaseId: number, trackId: number, releaseDiscogsUrl: string) => void;
  onReviewTrack: (trackId: number) => void;
  onSelectCursor: (index: number) => void;
  onSelectTrack: (trackId: number, checked: boolean) => void;
  onToggleRowSaved: (trackId: number) => void;
  onToggleRowWishlist: (releaseId: number) => void;
}) {
  return (
    <div className="space-y-2 outline-none">
      {visibleRows.map((item, index) => (
        <div
          key={item.trackId}
          ref={(node) => {
            rowRefs.current[item.trackId] = node;
          }}
          onClick={() => onSelectCursor(index)}
        >
          <ListenInboxRow
            active={index === activeCursor}
            activeLabelIds={activeLabelIds}
            adding={addingLabelReleaseId === item.releaseId}
            added={addedLabelReleaseIds.includes(item.releaseId)}
            checked={selectedSet.has(item.trackId)}
            isPlaying={item.trackId === playingTrackId && playerIsPlaying}
            item={item}
            mobileCompactRow={compactMobileRows && showQueueFilters}
            playbackDisabledNotice={playbackDisabledNotice}
            playbackPendingTrackId={playbackPendingTrackId}
            reviewingReleaseId={reviewingReleaseId}
            showMobileQuickRail={showMobileQuickRail}
            showQueueFilters={showQueueFilters}
            youtubeQuotaExceeded={youtubeQuotaExceeded}
            wishlistReleaseIdLoading={wishlistReleaseIdLoading}
            onAdd={() => onAddRowLabel(item.releaseId)}
            onHover={() => onHoverRow(index)}
            onPlay={() => onPlayRow(item.trackId)}
            onReviewRelease={() => onReviewRelease(item.releaseId, item.trackId, item.releaseDiscogsUrl)}
            onReviewTrack={() => onReviewTrack(item.trackId)}
            onSelect={(checked: boolean) => onSelectTrack(item.trackId, checked)}
            onToggleSaved={() => onToggleRowSaved(item.trackId)}
            onToggleWishlist={() => onToggleRowWishlist(item.releaseId)}
          />
        </div>
      ))}
      {visibleRows.length === 0 ? <ListenInboxEmptyStateCard emptyState={emptyState} /> : null}
    </div>
  );
}
