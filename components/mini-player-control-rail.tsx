"use client";

import { HoverTooltip } from "@/components/hover-tooltip";
import {
  MiniPlayerReviewControls,
  MiniPlayerTransportControls,
} from "@/components/mini-player-primary-controls";

export function MiniPlayerControlRail({
  mode,
  currentLoaded,
  playing,
  currentTrackId,
  currentReleaseId,
  todoLoading,
  iconButtonClass,
  tooltipClass,
  onPrevious,
  onPlayPause,
  onMarkReviewed,
  onMarkReleaseReviewed,
  trackReviewLabel,
  releaseReviewLabel,
}: {
  mode: "mobile" | "desktop";
  currentLoaded: boolean;
  playing: boolean;
  currentTrackId?: number | null;
  currentReleaseId?: number | null;
  todoLoading: "reviewed" | "reviewed_release" | "saved" | null;
  iconButtonClass: string;
  tooltipClass: string;
  onPrevious: () => void;
  onPlayPause: () => void;
  onMarkReviewed: () => void;
  onMarkReleaseReviewed: () => void;
  trackReviewLabel: string;
  releaseReviewLabel: string;
}) {
  if (mode === "mobile") {
    return (
      <div className="grid grid-cols-4 gap-2">
        <MiniPlayerTransportControls
          currentLoaded={currentLoaded}
          playing={playing}
          onPrevious={onPrevious}
          onPlayPause={onPlayPause}
          className="contents"
          buttonClassName="h-10 w-full rounded-md border border-[var(--color-border)]"
        />
        <MiniPlayerReviewControls
          currentTrackId={currentTrackId}
          currentReleaseId={currentReleaseId}
          todoLoading={todoLoading}
          onMarkReviewed={onMarkReviewed}
          onMarkReleaseReviewed={onMarkReleaseReviewed}
          className="contents"
        />
      </div>
    );
  }

  return (
    <>
      <MiniPlayerTransportControls
        currentLoaded={currentLoaded}
        playing={playing}
        onPrevious={onPrevious}
        onPlayPause={onPlayPause}
        className="hidden shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-1 shadow-[0_6px_20px_rgba(0,0,0,0.25)] md:flex"
        buttonClassName={iconButtonClass}
      />
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] p-1">
        <MiniPlayerReviewControls
          currentTrackId={currentTrackId}
          currentReleaseId={currentReleaseId}
          todoLoading={todoLoading}
          onMarkReviewed={onMarkReviewed}
          onMarkReleaseReviewed={onMarkReleaseReviewed}
          className="contents"
          trackWrapper={(button) => (
            <HoverTooltip content={trackReviewLabel} tooltipClassName={tooltipClass}>
              {button}
            </HoverTooltip>
          )}
          releaseWrapper={(button) => (
            <HoverTooltip content={releaseReviewLabel} tooltipClassName={tooltipClass}>
              {button}
            </HoverTooltip>
          )}
        />
      </div>
    </>
  );
}
