"use client";

import { ExternalLink, Youtube } from "lucide-react";
import { MiniPlayerReleaseWishlistControl, MiniPlayerTrackSaveControl } from "@/components/mini-player-library-controls";
import { MiniPlayerDetailsQueueControls, MiniPlayerPlaybackModeControls } from "@/components/mini-player-secondary-controls";
import {
  MiniPlayerExternalIconControl,
  MiniPlayerIconButtonControl,
} from "@/components/mini-player-utility-controls";

type MiniPlayerAuxControlsProps = {
  mode: "compact" | "desktop";
  currentLoaded: boolean;
  currentTrackSaved: boolean;
  currentReleaseWishlisted: boolean;
  currentTrackId?: number | null;
  currentReleaseId?: number | null;
  currentYoutubeVideoId?: string | null;
  currentYoutubeAppUrl?: string | null;
  isIOS: boolean;
  todoLoading: "reviewed" | "reviewed_release" | "saved" | null;
  wishlistLoading: boolean;
  expandedOpen: boolean;
  queueOpen: boolean;
  playbackMode: "in_order" | "shuffle";
  iconButtonClass: string;
  tooltipClass?: string;
  onToggleSaved: () => void;
  onToggleWishlist: () => void;
  onOpenYouTubeApp: () => void;
  onSetPlaybackMode: (mode: "in_order" | "shuffle") => void;
  onToggleExpanded: () => void;
  onToggleQueue: () => void;
};

export function MiniPlayerAuxControls({
  mode,
  currentLoaded,
  currentTrackSaved,
  currentReleaseWishlisted,
  currentTrackId,
  currentReleaseId,
  currentYoutubeVideoId,
  currentYoutubeAppUrl,
  isIOS,
  todoLoading,
  wishlistLoading,
  expandedOpen,
  queueOpen,
  playbackMode,
  iconButtonClass,
  tooltipClass,
  onToggleSaved,
  onToggleWishlist,
  onOpenYouTubeApp,
  onSetPlaybackMode,
  onToggleExpanded,
  onToggleQueue,
}: MiniPlayerAuxControlsProps) {
  if (mode === "compact") {
    return (
      <>
        <div className="grid grid-cols-4 gap-1">
          <MiniPlayerDetailsQueueControls
            currentLoaded={currentLoaded}
            expandedOpen={expandedOpen}
            queueOpen={queueOpen}
            onToggleExpanded={onToggleExpanded}
            onToggleQueue={onToggleQueue}
            className="contents"
            buttonClassName={iconButtonClass}
          />
          <MiniPlayerTrackSaveControl
            saved={currentTrackSaved}
            disabled={!currentTrackId || todoLoading !== null}
            loading={todoLoading === "saved"}
            onClick={onToggleSaved}
            className={iconButtonClass}
          />
          <MiniPlayerReleaseWishlistControl
            wishlisted={currentReleaseWishlisted}
            disabled={!currentReleaseId || wishlistLoading}
            loading={wishlistLoading}
            onClick={onToggleWishlist}
            className={iconButtonClass}
          />
          {currentYoutubeVideoId ? (
            <a
              href={`https://www.youtube.com/watch?v=${currentYoutubeVideoId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_88%,black_12%)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]"
              title="Open on YouTube"
              aria-label="Open on YouTube"
            >
              <Youtube className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
        <MiniPlayerPlaybackModeControls
          playbackMode={playbackMode}
          onSetPlaybackMode={onSetPlaybackMode}
          className="mt-1.5 grid grid-cols-2 gap-1"
          buttonClassName="h-9 w-full justify-center text-xs"
        />
      </>
    );
  }

  return (
    <>
      {currentYoutubeVideoId ? (
        <MiniPlayerExternalIconControl
          href={`https://www.youtube.com/watch?v=${currentYoutubeVideoId}`}
          title="Open on YouTube"
          ariaLabel="Open on YouTube"
          tooltip="Open on YouTube"
          tooltipClassName={tooltipClass ?? ""}
          wrapperClassName="hidden shrink-0 md:inline-flex"
        >
          <Youtube className="h-3.5 w-3.5" />
        </MiniPlayerExternalIconControl>
      ) : null}
      {currentYoutubeAppUrl && isIOS ? (
        <MiniPlayerIconButtonControl
          className={iconButtonClass}
          onClick={onOpenYouTubeApp}
          title="Open in YouTube app for background playback"
          ariaLabel="Open in YouTube app for background playback"
          tooltip="Open in YouTube app (best for background play)"
          tooltipClassName={tooltipClass ?? ""}
          wrapperClassName="hidden shrink-0 md:inline-flex"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </MiniPlayerIconButtonControl>
      ) : null}
      <div className="hidden shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] p-1 md:flex">
        <MiniPlayerTrackSaveControl
          saved={currentTrackSaved}
          disabled={!currentTrackId || todoLoading !== null}
          loading={todoLoading === "saved"}
          onClick={onToggleSaved}
          className={iconButtonClass}
          tooltip
          wrapperClassName="hidden md:inline-flex"
          tooltipClassName={tooltipClass}
        />
        <MiniPlayerReleaseWishlistControl
          wishlisted={currentReleaseWishlisted}
          disabled={!currentReleaseId || wishlistLoading}
          loading={wishlistLoading}
          onClick={onToggleWishlist}
          className={iconButtonClass}
          tooltip
          wrapperClassName="hidden md:inline-flex"
          tooltipClassName={tooltipClass}
        />
      </div>
      <MiniPlayerPlaybackModeControls
        playbackMode={playbackMode}
        onSetPlaybackMode={onSetPlaybackMode}
        className="hidden shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_84%,black_16%)] p-1 md:flex"
        buttonClassName="h-8 px-2 text-xs"
      />
      <MiniPlayerDetailsQueueControls
        currentLoaded={currentLoaded}
        expandedOpen={expandedOpen}
        queueOpen={queueOpen}
        onToggleExpanded={onToggleExpanded}
        onToggleQueue={onToggleQueue}
        className="hidden shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_85%,black_15%)] p-1 md:flex"
        buttonClassName={iconButtonClass}
        tooltipClassName={tooltipClass}
      />
    </>
  );
}
