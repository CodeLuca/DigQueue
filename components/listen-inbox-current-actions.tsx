"use client";

import { ChevronRight, Play, RefreshCcw } from "lucide-react";
import { DiscogsLink } from "@/components/discogs-link";
import { Button } from "@/components/ui/button";
import {
  ListenInboxPlayAction,
  ListenInboxReleaseReviewAction,
  ListenInboxSaveTrackAction,
  ListenInboxTrackReviewAction,
} from "@/components/listen-inbox-row-actions";
import {
  getListenInboxCurrentTrackSaveProps,
  type ListenInboxCurrentRow,
} from "@/lib/listen-inbox-current-controls";

export function ListenInboxCurrentCollapsedPlay({
  disabled,
  loading,
  onPlay,
}: {
  disabled: boolean;
  loading: boolean;
  onPlay: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="h-8 px-2"
      onClick={onPlay}
      disabled={disabled}
      aria-label="Play current track"
    >
      {loading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
    </Button>
  );
}

export function ListenInboxCurrentActionGrid({
  currentCanPlay,
  currentDisabledReason,
  currentPlayHint,
  current,
  playbackPendingTrackId,
  reviewingRelease,
  onPlay,
  onMarkTrackReviewed,
  onToggleSaved,
  onMarkReleaseReviewed,
  onSkipAndPlayNext,
  canSkipAndPlayNext,
}: {
  currentCanPlay: boolean;
  currentDisabledReason: string | null;
  currentPlayHint: string | null;
  current: ListenInboxCurrentRow;
  playbackPendingTrackId: number | null;
  reviewingRelease: boolean;
  onPlay: () => void;
  onMarkTrackReviewed: () => void;
  onToggleSaved: () => void;
  onMarkReleaseReviewed: () => void;
  onSkipAndPlayNext?: () => void;
  canSkipAndPlayNext?: boolean;
}) {
  const { saveAriaLabel, saveTitle } = getListenInboxCurrentTrackSaveProps(current.saved);

  return (
    <>
      <DiscogsLink
        className="inline-flex h-10 w-full items-center justify-center"
        discogsUrl={current.releaseDiscogsUrl}
        label="Discogs"
        title="Open current release on Discogs"
      />
      <ListenInboxPlayAction
        canPlay={currentCanPlay}
        disabledReason={currentDisabledReason}
        loading={playbackPendingTrackId === current.trackId}
        onPlay={onPlay}
        hint={currentCanPlay ? currentPlayHint : null}
        className="h-10 w-full"
      />
      <ListenInboxTrackReviewAction onReview={onMarkTrackReviewed} />
      <ListenInboxSaveTrackAction
        saved={current.saved}
        title={saveTitle}
        ariaLabel={saveAriaLabel}
        onToggle={onToggleSaved}
        className="h-10"
      />
      <ListenInboxReleaseReviewAction
        loading={reviewingRelease}
        onReview={onMarkReleaseReviewed}
      />
      {onSkipAndPlayNext ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-10 w-full justify-center"
          onClick={onSkipAndPlayNext}
          disabled={!canSkipAndPlayNext || !currentCanPlay}
          title="Skip current track and play the next one"
          aria-label="Skip current track and play next"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          Skip + play next
        </Button>
      ) : null}
    </>
  );
}
