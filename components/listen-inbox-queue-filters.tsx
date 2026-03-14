"use client";

import type { ReactNode } from "react";
import { ListOrdered, Shuffle } from "lucide-react";
import { SegmentedControlButton } from "@/components/segmented-control-button";
import type {
  InboxFilterCounts,
  PlaybackMode,
  QueueStateView,
  SourceFilter,
  VideoFilter,
} from "@/lib/listen-inbox-control-types";

function FilterGroup({
  children,
  compact = false,
  label,
}: {
  children: ReactNode;
  compact?: boolean;
  label?: string;
}) {
  const className = compact
    ? "flex flex-nowrap items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    : "inline-flex flex-wrap items-center gap-1";

  return (
    <div className={className}>
      {label ? <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</span> : null}
      {children}
    </div>
  );
}

export function ListenInboxQueueFilterSets({
  advancedFiltersOpen,
  hasAdvancedFiltersActive,
  hideAlreadyPlayed,
  hideReviewed,
  playbackMode,
  queueFilterCounts,
  sourceFilter,
  sourceFilterCounts,
  stateView,
  videoFilter,
  videoFilterCounts,
  onSetAdvancedFiltersOpen,
  onSetHideAlreadyPlayed,
  onSetHideReviewed,
  onSetPlaybackMode,
  onSetSourceFilter,
  onSetStateView,
  onSetVideoFilter,
  compact = false,
}: {
  advancedFiltersOpen: boolean;
  hasAdvancedFiltersActive: boolean;
  hideAlreadyPlayed: boolean;
  hideReviewed: boolean;
  playbackMode: PlaybackMode;
  queueFilterCounts: InboxFilterCounts;
  sourceFilter: SourceFilter;
  sourceFilterCounts: InboxFilterCounts;
  stateView: QueueStateView;
  videoFilter: VideoFilter;
  videoFilterCounts: InboxFilterCounts;
  onSetAdvancedFiltersOpen: (next: boolean) => void;
  onSetHideAlreadyPlayed: (next: boolean) => void;
  onSetHideReviewed: (next: boolean) => void;
  onSetPlaybackMode: (mode: PlaybackMode) => void;
  onSetSourceFilter: (filter: SourceFilter) => void;
  onSetStateView: (view: QueueStateView) => void;
  onSetVideoFilter: (filter: VideoFilter) => void;
  compact?: boolean;
}) {
  const tone = compact ? "compact" : "default";

  return (
    <>
      <FilterGroup compact={compact} label={compact ? undefined : "View"}>
        <SegmentedControlButton active={stateView === "all"} tone={tone} onClick={() => onSetStateView("all")}>
          All ({queueFilterCounts.all})
        </SegmentedControlButton>
        <SegmentedControlButton active={stateView === "needs_review"} tone={tone} onClick={() => onSetStateView("needs_review")}>
          {compact ? "Needs Rev" : "Needs Review"} ({queueFilterCounts.needsReview ?? 0})
        </SegmentedControlButton>
        <SegmentedControlButton active={stateView === "reviewed"} tone={tone} onClick={() => onSetStateView("reviewed")}>
          Reviewed ({queueFilterCounts.reviewed ?? 0})
        </SegmentedControlButton>
        <SegmentedControlButton active={stateView === "played"} tone={tone} onClick={() => onSetStateView("played")}>
          Played ({queueFilterCounts.played ?? 0})
        </SegmentedControlButton>
      </FilterGroup>
      <FilterGroup compact={compact} label={compact ? undefined : "Exclude"}>
        <SegmentedControlButton active={hideReviewed} tone={tone} onClick={() => onSetHideReviewed(!hideReviewed)}>
          {compact ? "Hide reviewed" : `Reviewed (${queueFilterCounts.reviewed ?? 0})`}
        </SegmentedControlButton>
        <SegmentedControlButton active={hideAlreadyPlayed} tone={tone} onClick={() => onSetHideAlreadyPlayed(!hideAlreadyPlayed)}>
          {compact ? "Hide played" : `Played (${queueFilterCounts.played ?? 0})`}
        </SegmentedControlButton>
        {compact ? (
          <SegmentedControlButton active={advancedFiltersOpen} tone={tone} onClick={() => onSetAdvancedFiltersOpen(!advancedFiltersOpen)}>
            {advancedFiltersOpen ? "Hide" : "More"} filters
            {hasAdvancedFiltersActive ? " (active)" : ""}
          </SegmentedControlButton>
        ) : null}
      </FilterGroup>
      {!compact ? (
        <button
          type="button"
          onClick={() => onSetAdvancedFiltersOpen(!advancedFiltersOpen)}
          className="inline-flex min-h-9 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/45 px-3 py-1.5 text-sm text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
          aria-expanded={advancedFiltersOpen}
          title="Show source, video, and playback filters"
        >
          {advancedFiltersOpen ? "Hide" : "More"} filters
          {hasAdvancedFiltersActive ? " (active)" : ""}
        </button>
      ) : null}
      {advancedFiltersOpen ? (
        <div className={`${compact ? "space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2" : "w-full space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2"}`}>
          <FilterGroup compact={compact} label="Source">
            <SegmentedControlButton active={sourceFilter === "all"} tone={tone} onClick={() => onSetSourceFilter("all")}>
              All ({sourceFilterCounts.all})
            </SegmentedControlButton>
            <SegmentedControlButton active={sourceFilter === "saved"} tone={tone} onClick={() => onSetSourceFilter("saved")}>
              Saved ({sourceFilterCounts.saved ?? 0})
            </SegmentedControlButton>
            <SegmentedControlButton active={sourceFilter === "wishlisted"} tone={tone} onClick={() => onSetSourceFilter("wishlisted")}>
              Wishlisted ({sourceFilterCounts.wishlisted ?? 0})
            </SegmentedControlButton>
            {!compact ? (
              <SegmentedControlButton active={sourceFilter === "saved_or_wishlisted"} tone={tone} onClick={() => onSetSourceFilter("saved_or_wishlisted")}>
                Saved or Wishlisted ({sourceFilterCounts.savedOrWishlisted ?? 0})
              </SegmentedControlButton>
            ) : null}
          </FilterGroup>
          <FilterGroup compact={compact} label="Video">
            <SegmentedControlButton active={videoFilter === "all"} tone={tone} onClick={() => onSetVideoFilter("all")}>
              Any ({videoFilterCounts.all})
            </SegmentedControlButton>
            <SegmentedControlButton active={videoFilter === "playable"} tone={tone} onClick={() => onSetVideoFilter("playable")}>
              Playable ({videoFilterCounts.playable ?? 0})
            </SegmentedControlButton>
            <SegmentedControlButton active={videoFilter === "no_video_or_private"} tone={tone} onClick={() => onSetVideoFilter("no_video_or_private")}>
              {compact ? "No video" : "No video/private"} ({videoFilterCounts.noVideoOrPrivate ?? 0})
            </SegmentedControlButton>
          </FilterGroup>
          <FilterGroup compact={compact} label="Playback">
            <SegmentedControlButton active={playbackMode === "in_order"} tone={tone} onClick={() => onSetPlaybackMode("in_order")}>
              <ListOrdered className="mr-1 inline h-3 w-3" />
              In Order
            </SegmentedControlButton>
            <SegmentedControlButton active={playbackMode === "shuffle"} tone={tone} onClick={() => onSetPlaybackMode("shuffle")}>
              <Shuffle className="mr-1 inline h-3 w-3" />
              Shuffle
            </SegmentedControlButton>
          </FilterGroup>
        </div>
      ) : null}
    </>
  );
}
