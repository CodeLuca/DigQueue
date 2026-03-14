"use client";

import type { ReactNode } from "react";
import { CheckCheck, CheckCircle2, Loader2, Pause, Play, SkipBack } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  releaseReviewAdvanceLabel,
  trackReviewAdvanceLabel,
} from "@/lib/library-action-labels";

export function MiniPlayerTransportControls({
  currentLoaded,
  playing,
  onPlayPause,
  onPrevious,
  className,
  buttonClassName,
}: {
  currentLoaded: boolean;
  playing: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  className?: string;
  buttonClassName?: string;
}) {
  return (
    <div className={className}>
      <Button variant="ghost" size="sm" className={buttonClassName} onClick={onPrevious} aria-label="Previous">
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="h-9 w-9 rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] p-0 text-black hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0 sm:h-10 sm:w-10"
        onClick={onPlayPause}
        aria-label="Play Pause"
      >
        {!currentLoaded || playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </Button>
    </div>
  );
}

export function MiniPlayerReviewControls({
  currentTrackId,
  currentReleaseId,
  todoLoading,
  onMarkReviewed,
  onMarkReleaseReviewed,
  className,
  trackWrapper,
  releaseWrapper,
}: {
  currentTrackId?: number | null;
  currentReleaseId?: number | null;
  todoLoading: "reviewed" | "reviewed_release" | "saved" | null;
  onMarkReviewed: () => void;
  onMarkReleaseReviewed: () => void;
  className?: string;
  trackWrapper?: (button: ReactNode) => ReactNode;
  releaseWrapper?: (button: ReactNode) => ReactNode;
}) {
  const trackButton = (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="h-9 w-9 rounded-full border border-emerald-400/60 bg-emerald-500/28 p-0 text-emerald-50 hover:bg-emerald-500/38 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-0 sm:h-10 sm:w-10"
      onClick={onMarkReviewed}
      disabled={!currentTrackId || todoLoading !== null}
      title={trackReviewAdvanceLabel("current track")}
      aria-label={trackReviewAdvanceLabel("current track")}
    >
      {todoLoading === "reviewed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />}
    </Button>
  );

  const releaseButton = (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="h-9 w-9 rounded-full border border-amber-400/60 bg-amber-500/22 p-0 text-black hover:bg-amber-500/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-0 sm:h-10 sm:w-10"
      onClick={onMarkReleaseReviewed}
      disabled={!currentReleaseId || todoLoading !== null}
      title={releaseReviewAdvanceLabel()}
      aria-label={releaseReviewAdvanceLabel()}
    >
      {todoLoading === "reviewed_release" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCheck className="h-4 w-4 sm:h-5 sm:w-5" />
      )}
    </Button>
  );

  return (
    <div className={className}>
      {trackWrapper ? trackWrapper(trackButton) : trackButton}
      {releaseWrapper ? releaseWrapper(releaseButton) : releaseButton}
    </div>
  );
}
