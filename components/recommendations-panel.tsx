"use client";

import { BookmarkPlus, HeartPlus, Plus, Play, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { DiscogsLink } from "@/components/discogs-link";
import { MutationActionButton } from "@/components/mutation-action-button";
import { RecommendationCardShell } from "@/components/recommendation-card-shell";
import { SegmentedControlButton } from "@/components/segmented-control-button";
import {
  getAddSourceFromReleaseActionLabels,
  getDiscogsWishlistActionLabels,
  getTrackSaveActionLabels,
  playNowInMiniPlayerLabel,
  playNowAriaLabel,
  queueTrackNextLabel,
  queueTrackNextTitle,
  releaseDiscogsLinkTitle,
  recommendationDismissLabel,
  recommendationReviewLabel,
} from "@/lib/library-action-labels";
import {
  useExternalRecommendationActions,
  useLibraryRecommendationActions,
} from "@/lib/use-recommendation-actions";
import { useRecommendationFeedState } from "@/lib/use-recommendation-feed-state";

type RecommendationItem = {
  id: number;
  title: string;
  releaseId: number;
  score: number;
  reason?: string;
  playable?: boolean;
  saved?: boolean;
  release?: Record<string, unknown> | null;
};

type ExternalRecommendationItem = {
  releaseId: number;
  title: string;
  artist: string;
  labelName: string | null;
  year: number | null;
  catno: string | null;
  thumbUrl: string | null;
  discogsUrl: string;
  score: number;
  reason: string;
};

export function RecommendationsPanel({
  initialItems,
  externalItems: initialExternalItems,
}: {
  initialItems: RecommendationItem[];
  externalItems: ExternalRecommendationItem[];
}) {
  const {
    canShow,
    externalItems,
    items,
    setExternalItems,
    setItems,
    setView,
    view,
    visibleExternalItems,
    visibleLibraryItems,
  } = useRecommendationFeedState(initialItems, initialExternalItems);
  if (!canShow) {
    return <p className="text-sm text-[var(--color-muted)]">No fresh recommendations right now. Process more labels or play more tracks.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">Views</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <SegmentedControlButton active={view === "all"} onClick={() => setView("all")}>
            All ({items.length + externalItems.length})
          </SegmentedControlButton>
          <SegmentedControlButton active={view === "in_library"} onClick={() => setView("in_library")}>
            In Library ({items.length})
          </SegmentedControlButton>
          <SegmentedControlButton active={view === "outside_library"} onClick={() => setView("outside_library")}>
            Outside Library ({externalItems.length})
          </SegmentedControlButton>
        </div>
      </div>
      {visibleLibraryItems.length > 0 ? <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">In Library</p> : null}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {visibleLibraryItems.map((track) => (
          <LibraryRecommendationCard key={track.id} track={track} setItems={setItems} />
        ))}
      </div>

      {visibleExternalItems.length > 0 ? <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Outside Library</p> : null}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {visibleExternalItems.map((item) => (
          <ExternalRecommendationCard
            key={item.releaseId}
            item={item}
            setExternalItems={setExternalItems}
          />
        ))}
      </div>
      {visibleLibraryItems.length === 0 && visibleExternalItems.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No recommendations in this view.</p>
      ) : null}
    </div>
  );
}

function LibraryRecommendationCard({
  track,
  setItems,
}: {
  track: RecommendationItem;
  setItems: Dispatch<SetStateAction<RecommendationItem[]>>;
}) {
  const {
    dismissMessage,
    dismissPending,
    loading,
    onAddRecordWishlist,
    onDismissTrack,
    onReviewed,
    onSave,
    playbackDisabled,
    playbackFeedback: feedback,
    playbackPending,
    playNow,
    queueNext,
    reviewMessage,
    reviewedPending,
    saveMessage,
    savePending,
    wishlistMessage,
    wishlistPending,
  } = useLibraryRecommendationActions(track, setItems);
  const release = (track.release ?? {}) as {
    title?: string | null;
    artist?: string | null;
    thumbUrl?: string | null;
    wishlist?: boolean | null;
    label?: { name?: string | null } | null;
  };
  const trackSaveLabels = getTrackSaveActionLabels(Boolean(track.saved));
  const wishlistLabels = getDiscogsWishlistActionLabels(Boolean(release.wishlist));

  return (
    <RecommendationCardShell
      artworkAlt={`${release.title ?? track.title} artwork`}
      artworkUrl={release.thumbUrl}
      title={track.title}
      meta={
        <>
          {release.artist ?? "Unknown artist"} • {release.label?.name ?? "Unknown label"} • {release.title ?? `Release #${track.releaseId}`}
        </>
      }
      score={track.score}
      reason={track.reason}
    >
      <MutationActionButton
        preset="playback"
        size="sm"
        variant="secondary"
        className="col-span-2 w-full justify-center sm:col-auto sm:w-auto sm:justify-start"
        disabled={loading || playbackDisabled}
        onClick={() => void playNow()}
        title={playNowInMiniPlayerLabel()}
        ariaLabel={playNowAriaLabel()}
        pending={playbackPending}
        pendingChildren="..."
      >
        <Play className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Play Now</span>
        <span className="sm:hidden">Play</span>
      </MutationActionButton>
      <MutationActionButton
        preset="playback"
        size="sm"
        variant="outline"
        className="w-full justify-center sm:w-auto sm:justify-start"
        disabled={loading || playbackDisabled}
        onClick={() => void queueNext()}
        title={queueTrackNextTitle()}
        ariaLabel={queueTrackNextLabel()}
        pending={playbackPending}
        pendingChildren="..."
        message={feedback}
      >
        <span className="hidden sm:inline">Queue Next</span>
        <span className="sm:hidden">Queue</span>
      </MutationActionButton>
        <MutationActionButton
          preset="recommendation"
          size="sm"
          variant="outline"
          className="w-full justify-center sm:w-auto sm:justify-start"
          disabled={loading}
          onClick={() => void onReviewed()}
          title={recommendationReviewLabel()}
          pending={reviewedPending}
          pendingChildren="..."
          message={reviewMessage}
        >
          <span className="hidden sm:inline">Reviewed</span>
          <span className="sm:hidden">Review</span>
        </MutationActionButton>
        <MutationActionButton
          preset="recommendation"
          size="sm"
          variant={track.saved ? "secondary" : "outline"}
          className="w-full justify-center sm:w-auto sm:justify-start"
          disabled={loading || Boolean(track.saved)}
          onClick={() => void onSave()}
          title={trackSaveLabels.title}
          ariaLabel={trackSaveLabels.ariaLabel}
          pending={savePending}
          pendingChildren="..."
          message={saveMessage}
        >
          <HeartPlus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{trackSaveLabels.buttonLabel}</span>
        </MutationActionButton>
        <MutationActionButton
          preset="recommendation"
          size="sm"
          variant={release.wishlist ? "secondary" : "outline"}
          className="w-full justify-center sm:w-auto sm:justify-start"
          disabled={loading || Boolean(release.wishlist)}
          onClick={() => void onAddRecordWishlist()}
          title={wishlistLabels.title}
          ariaLabel={wishlistLabels.ariaLabel}
          pending={wishlistPending}
          pendingChildren="..."
          message={wishlistMessage}
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{wishlistLabels.buttonLabel}</span>
        </MutationActionButton>
        <MutationActionButton
          preset="recommendation"
          size="sm"
          variant="ghost"
          className="col-span-2 w-full justify-center sm:col-auto sm:w-auto sm:justify-start"
          disabled={loading}
          onClick={() => void onDismissTrack()}
          title={recommendationDismissLabel()}
          ariaLabel={recommendationDismissLabel()}
          pending={dismissPending}
          pendingChildren="..."
          message={dismissMessage}
        >
          <X className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Dismiss</span>
        </MutationActionButton>
    </RecommendationCardShell>
  );
}

function ExternalRecommendationCard({
  item,
  setExternalItems,
}: {
  item: ExternalRecommendationItem;
  setExternalItems: Dispatch<SetStateAction<ExternalRecommendationItem[]>>;
}) {
  const {
    addLabelMessage,
    addLabelPending,
    dismissMessage,
    dismissPending,
    loading,
    onAddLabel,
    onDismiss,
    onWant,
    wantMessage,
    wantPending,
  } = useExternalRecommendationActions(item, setExternalItems);
  const addSourceLabels = getAddSourceFromReleaseActionLabels();
  const wishlistLabels = getDiscogsWishlistActionLabels(false);

  return (
    <RecommendationCardShell
      artworkAlt={`${item.title} artwork`}
      artworkUrl={item.thumbUrl}
      title={item.title}
      meta={
        <>
          {item.artist} • {item.labelName ?? "Unknown label"}
          {typeof item.year === "number" ? ` • ${item.year}` : ""}
        </>
      }
      score={item.score}
      reason={item.reason}
    >
      <MutationActionButton
        preset="recommendation"
        size="sm"
        variant="outline"
        className="w-full justify-center sm:w-auto sm:justify-start"
        disabled={loading}
        onClick={() => void onAddLabel()}
        title={addSourceLabels.title}
        ariaLabel={addSourceLabels.ariaLabel}
        pending={addLabelPending}
        pendingChildren="..."
        message={addLabelMessage}
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{addSourceLabels.buttonLabel}</span>
      </MutationActionButton>
      <MutationActionButton
        preset="recommendation"
        size="sm"
        variant="outline"
        className="w-full justify-center sm:w-auto sm:justify-start"
        disabled={loading}
        onClick={() => void onWant()}
        title={wishlistLabels.title}
        ariaLabel={wishlistLabels.ariaLabel}
        pending={wantPending}
        pendingChildren="..."
        message={wantMessage}
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{wishlistLabels.buttonLabel}</span>
      </MutationActionButton>
      <DiscogsLink discogsUrl={item.discogsUrl} title={releaseDiscogsLinkTitle()} variant="textButton" />
      <MutationActionButton
        preset="recommendation"
        size="sm"
        variant="ghost"
        className="col-span-2 w-full justify-center sm:col-auto sm:w-auto sm:justify-start"
        disabled={loading}
        onClick={() => void onDismiss()}
        title={recommendationDismissLabel()}
        ariaLabel={recommendationDismissLabel()}
        pending={dismissPending}
        pendingChildren="..."
        message={dismissMessage}
      >
        <X className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Dismiss</span>
      </MutationActionButton>
    </RecommendationCardShell>
  );
}
