"use client";

import { BookmarkPlus, HeartPlus, Plus, Play, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { DiscogsLink } from "@/components/discogs-link";
import { EmptyStateNote } from "@/components/empty-state-note";
import { getInsetPanelClassName, SectionKicker } from "@/components/inset-panel";
import { RecommendationActionButton } from "@/components/recommendation-action-button";
import { RecommendationCardShell } from "@/components/recommendation-card-shell";
import { ResponsiveLabel } from "@/components/responsive-label";
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
    return <EmptyStateNote title="No fresh finds right now. Scan more focused sources or play a few more tracks." />;
  }

  return (
    <div className="space-y-4">
      <div className={getInsetPanelClassName("surface")}>
        <SectionKicker>Discovery Lanes</SectionKicker>
        <div className="mt-2 flex flex-wrap gap-2">
          <SegmentedControlButton active={view === "all"} onClick={() => setView("all")}>
            All ({items.length + externalItems.length})
          </SegmentedControlButton>
          <SegmentedControlButton active={view === "in_library"} onClick={() => setView("in_library")}>
            From Library ({items.length})
          </SegmentedControlButton>
          <SegmentedControlButton active={view === "outside_library"} onClick={() => setView("outside_library")}>
            New Records ({externalItems.length})
          </SegmentedControlButton>
        </div>
      </div>
      {visibleLibraryItems.length > 0 ? <SectionKicker size="sm">From Library</SectionKicker> : null}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {visibleLibraryItems.map((track) => (
          <LibraryRecommendationCard key={track.id} track={track} setItems={setItems} />
        ))}
      </div>

      {visibleExternalItems.length > 0 ? <SectionKicker size="sm">New Records</SectionKicker> : null}
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
        <EmptyStateNote title="No finds in this lane." />
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
      <RecommendationActionButton
        variant="secondary"
        fullSpan
        disabled={loading || playbackDisabled}
        onClick={() => void playNow()}
        title={playNowInMiniPlayerLabel()}
        ariaLabel={playNowAriaLabel()}
        pending={playbackPending}
        pendingChildren="..."
      >
        <Play className="h-3.5 w-3.5" />
        <ResponsiveLabel compact="Play" full="Play Now" />
      </RecommendationActionButton>
      <RecommendationActionButton
        variant="outline"
        disabled={loading || playbackDisabled}
        onClick={() => void queueNext()}
        title={queueTrackNextTitle()}
        ariaLabel={queueTrackNextLabel()}
        pending={playbackPending}
        pendingChildren="..."
        message={feedback}
      >
        <ResponsiveLabel compact="Queue" full="Queue Next" />
      </RecommendationActionButton>
        <RecommendationActionButton
          variant="outline"
          disabled={loading}
          onClick={() => void onReviewed()}
          title={recommendationReviewLabel()}
          pending={reviewedPending}
          pendingChildren="..."
          message={reviewMessage}
        >
          <ResponsiveLabel compact="Review" full="Reviewed" />
        </RecommendationActionButton>
        <RecommendationActionButton
          variant={track.saved ? "secondary" : "outline"}
          disabled={loading || Boolean(track.saved)}
          onClick={() => void onSave()}
          title={trackSaveLabels.title}
          ariaLabel={trackSaveLabels.ariaLabel}
          pending={savePending}
          pendingChildren="..."
          message={saveMessage}
        >
          <HeartPlus className="h-3.5 w-3.5" />
          <ResponsiveLabel compact="Save" full={trackSaveLabels.buttonLabel} />
        </RecommendationActionButton>
        <RecommendationActionButton
          variant={release.wishlist ? "secondary" : "outline"}
          disabled={loading || Boolean(release.wishlist)}
          onClick={() => void onAddRecordWishlist()}
          title={wishlistLabels.title}
          ariaLabel={wishlistLabels.ariaLabel}
          pending={wishlistPending}
          pendingChildren="..."
          message={wishlistMessage}
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          <ResponsiveLabel compact="Wishlist" full={wishlistLabels.buttonLabel} />
        </RecommendationActionButton>
        <RecommendationActionButton
          variant="ghost"
          fullSpan
          disabled={loading}
          onClick={() => void onDismissTrack()}
          title={recommendationDismissLabel()}
          ariaLabel={recommendationDismissLabel()}
          pending={dismissPending}
          pendingChildren="..."
          message={dismissMessage}
        >
          <X className="h-3.5 w-3.5" />
          <ResponsiveLabel compact="Dismiss" full="Dismiss" />
        </RecommendationActionButton>
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
      <RecommendationActionButton
        variant="outline"
        disabled={loading}
        onClick={() => void onAddLabel()}
        title={addSourceLabels.title}
        ariaLabel={addSourceLabels.ariaLabel}
        pending={addLabelPending}
        pendingChildren="..."
        message={addLabelMessage}
      >
        <Plus className="h-3.5 w-3.5" />
        <ResponsiveLabel compact="Add" full={addSourceLabels.buttonLabel} />
      </RecommendationActionButton>
      <RecommendationActionButton
        variant="outline"
        disabled={loading}
        onClick={() => void onWant()}
        title={wishlistLabels.title}
        ariaLabel={wishlistLabels.ariaLabel}
        pending={wantPending}
        pendingChildren="..."
        message={wantMessage}
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        <ResponsiveLabel compact="Wishlist" full={wishlistLabels.buttonLabel} />
      </RecommendationActionButton>
      <DiscogsLink discogsUrl={item.discogsUrl} title={releaseDiscogsLinkTitle()} variant="textButton" />
      <RecommendationActionButton
        variant="ghost"
        fullSpan
        disabled={loading}
        onClick={() => void onDismiss()}
        title={recommendationDismissLabel()}
        ariaLabel={recommendationDismissLabel()}
        pending={dismissPending}
        pendingChildren="..."
        message={dismissMessage}
      >
        <X className="h-3.5 w-3.5" />
        <ResponsiveLabel compact="Dismiss" full="Dismiss" />
      </RecommendationActionButton>
    </RecommendationCardShell>
  );
}
