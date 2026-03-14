"use client";

import { ListenInboxRowActionShell } from "@/components/listen-inbox-row-action-shell";
import { ListenInboxRowSummary } from "@/components/listen-inbox-row-summary";
import { getTrackSaveActionLabels } from "@/lib/library-action-labels";
import { getListenInboxPlaybackState } from "@/lib/listen-inbox-playback-state";
import type { ListenRow } from "@/lib/listen-inbox-types";

export function ListenInboxRow({
  active,
  activeLabelIds,
  adding,
  added,
  checked,
  isPlaying,
  item,
  mobileCompactRow,
  playbackDisabledNotice,
  playbackPendingTrackId,
  reviewingReleaseId,
  showMobileQuickRail,
  showQueueFilters,
  youtubeQuotaExceeded,
  wishlistReleaseIdLoading,
  onAdd,
  onHover,
  onPlay,
  onReviewRelease,
  onReviewTrack,
  onSelect,
  onToggleSaved,
  onToggleWishlist,
}: {
  active: boolean;
  activeLabelIds: Set<number>;
  adding: boolean;
  added: boolean;
  checked: boolean;
  isPlaying: boolean;
  item: ListenRow;
  mobileCompactRow: boolean;
  playbackDisabledNotice: string;
  playbackPendingTrackId: number | null;
  reviewingReleaseId: number | null;
  showMobileQuickRail: boolean;
  showQueueFilters: boolean;
  youtubeQuotaExceeded: boolean;
  wishlistReleaseIdLoading: number | null;
  onAdd: () => void;
  onHover: () => void;
  onPlay: () => void;
  onReviewRelease: () => void;
  onReviewTrack: () => void;
  onSelect: (checked: boolean) => void;
  onToggleSaved: () => void;
  onToggleWishlist: () => void;
}) {
  const isUpNext = Boolean(item.isUpNext) && !isPlaying;
  const playedCount = item.playedCount ?? (item.wasPlayed ? 1 : 0);
  const hasPlayedHistory = playedCount > 0;
  const needsMark = hasPlayedHistory && !item.listened;
  const wasPlayed = hasPlayedHistory && !needsMark;
  const labelIsActive = Boolean(item.labelActive) || activeLabelIds.has(item.labelId);
  const { canPlay, disabledReason, hint } = getListenInboxPlaybackState(item, {
    disabledNotice: playbackDisabledNotice,
    quotaExceeded: youtubeQuotaExceeded,
  });
  const loading = playbackPendingTrackId === item.trackId;
  const trackSaveLabels = getTrackSaveActionLabels(item.saved);

  return (
    <div
      className={`rounded-lg border ${mobileCompactRow ? "p-2.5 sm:p-3" : "p-3"} ${
        isPlaying
          ? "border-emerald-500/70 bg-emerald-500/10"
          : active
            ? "border-[var(--color-accent)] bg-[var(--color-surface2)]"
            : "border-[var(--color-border)]"
      }`}
      onMouseEnter={onHover}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className={`flex min-w-0 items-center ${mobileCompactRow ? "gap-2" : "gap-3"}`}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onSelect(event.target.checked)}
            aria-label={`Select ${item.trackTitle}`}
          />
          <ListenInboxRowSummary
            isPlaying={isPlaying}
            isUpNext={isUpNext}
            item={{
              duration: item.duration,
              labelName: item.labelName,
              listened: item.listened,
              position: item.position,
              releaseCatno: item.releaseCatno,
              releaseDiscogsUrl: item.releaseDiscogsUrl,
              releaseId: item.releaseId,
              releaseThumbUrl: item.releaseThumbUrl,
              releaseTitle: item.releaseTitle,
              releaseWishlist: item.releaseWishlist,
              saved: item.saved,
              trackArtists: item.trackArtists || item.releaseArtist,
              trackTitle: item.trackTitle,
            }}
            mobileCompactRow={mobileCompactRow}
            needsMark={needsMark}
            playedCount={playedCount}
            showWishlistAction={!mobileCompactRow}
            toggleWishlistLoading={wishlistReleaseIdLoading === item.releaseId}
            wasPlayed={wasPlayed}
            onToggleWishlist={onToggleWishlist}
          />
        </div>
        <ListenInboxRowActionShell
          adding={adding}
          added={added}
          canPlay={canPlay}
          disabledReason={disabledReason}
          discogsUrl={item.releaseDiscogsUrl}
          hint={hint}
          iconReviewLoading={reviewingReleaseId === item.releaseId}
          labelIsActive={labelIsActive}
          loading={loading}
          releaseReviewLoading={reviewingReleaseId === item.releaseId}
          saved={item.saved}
          saveAriaLabel={trackSaveLabels.ariaLabel}
          saveTitle={trackSaveLabels.title}
          showMobileQuickRail={showMobileQuickRail}
          showQueueFilters={showQueueFilters}
          onAdd={onAdd}
          onPlay={onPlay}
          onReviewRelease={onReviewRelease}
          onReviewTrack={onReviewTrack}
          onToggleSaved={onToggleSaved}
        />
      </div>
    </div>
  );
}
