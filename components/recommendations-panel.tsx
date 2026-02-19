"use client";

import { useMemo, useState } from "react";
import { BookmarkPlus, HeartPlus, Plus, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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

type QueueApiItem = {
  id: number;
  youtubeVideoId: string;
  track?: { id: number; title: string } | null;
  release?: { title: string } | null;
  label?: { name: string } | null;
};

async function enqueueTrack(trackId: number, queueMode: "normal" | "next" = "normal") {
  const response = await fetch("/api/queue/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackId, queueMode }),
  });
  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; item?: QueueApiItem | null; error?: string; reason?: string }
    | null;
  if (body?.reason === "no_match") throw new Error("NO_MATCH");
  if (body?.reason === "youtube_quota_exceeded") throw new Error("YOUTUBE_QUOTA");
  if (!response.ok || !body?.ok || !body.item) throw new Error(body?.error || "Unable to queue track.");
  return body.item;
}

async function markReviewed(trackId: number) {
  const response = await fetch("/api/tracks/todo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackIds: [trackId], field: "listened", mode: "set", value: true }),
  });
  if (!response.ok) throw new Error("Unable to mark reviewed.");
}

async function toggleTrackSaved(trackId: number) {
  const response = await fetch("/api/tracks/todo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackIds: [trackId], field: "saved", mode: "toggle" }),
  });
  if (!response.ok) throw new Error("Unable to save track.");
}

async function toggleReleaseWishlist(releaseId: number) {
  const response = await fetch("/api/releases/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ releaseId, mode: "toggle" }),
  });
  if (!response.ok) throw new Error("Unable to update record wishlist.");
  const body = (await response.json().catch(() => null)) as { wishlist?: boolean } | null;
  return Boolean(body?.wishlist);
}

async function addLabelFromRelease(releaseId: number) {
  const response = await fetch("/api/labels/from-release", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ releaseId }),
  });
  if (!response.ok) throw new Error("Unable to add label from release.");
}

async function addDiscogsWant(releaseId: number) {
  const response = await fetch("/api/releases/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ releaseId, mode: "set", value: true }),
  });
  if (!response.ok) throw new Error("Unable to add record to Discogs wishlist.");
}

async function dismissRecommendation(input: { trackId?: number; releaseId?: number }) {
  const response = await fetch("/api/recommendations/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType: "dismiss", ...input }),
  });
  if (!response.ok) throw new Error("Unable to dismiss recommendation.");
}

export function RecommendationsPanel({
  initialItems,
  externalItems: initialExternalItems,
}: {
  initialItems: RecommendationItem[];
  externalItems: ExternalRecommendationItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [externalItems, setExternalItems] = useState(initialExternalItems);
  const [loadingTrackId, setLoadingTrackId] = useState<number | null>(null);
  const [loadingReleaseId, setLoadingReleaseId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const canShow = useMemo(() => items.length > 0 || externalItems.length > 0, [externalItems.length, items.length]);

  const removeItem = (trackId: number) => setItems((prev) => prev.filter((item) => item.id !== trackId));
  const removeExternalItem = (releaseId: number) => setExternalItems((prev) => prev.filter((item) => item.releaseId !== releaseId));

  const onQueue = async (trackId: number, playNow: boolean) => {
    setLoadingTrackId(trackId);
    setFeedback(null);
    try {
      const queued = await enqueueTrack(trackId, "next");
      if (playNow) {
        // Always route through bottom mini-player and replace current playback.
        window.dispatchEvent(new CustomEvent("digqueue:play-item", { detail: queued }));
      }
      removeItem(trackId);
      setFeedback(playNow ? "Playing in bottom player." : "Queued next.");
    } catch (error) {
      if (error instanceof Error && error.message === "NO_MATCH") {
        setFeedback("No playable match available yet. Open release and run matching.");
      } else {
        setFeedback(error instanceof Error ? error.message : "Unable to queue recommendation.");
      }
    } finally {
      setLoadingTrackId(null);
    }
  };

  const onReviewed = async (trackId: number) => {
    setLoadingTrackId(trackId);
    setFeedback(null);
    try {
      await markReviewed(trackId);
      removeItem(trackId);
      setFeedback("Marked as reviewed.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to mark reviewed.");
    } finally {
      setLoadingTrackId(null);
    }
  };

  const onSave = async (trackId: number) => {
    setLoadingTrackId(trackId);
    setFeedback(null);
    try {
      await toggleTrackSaved(trackId);
      setItems((prev) => prev.map((item) => (item.id === trackId ? { ...item, saved: !Boolean(item.saved) } : item)));
      setFeedback("Track saved.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to save track.");
    } finally {
      setLoadingTrackId(null);
    }
  };

  const onAddRecordWishlist = async (trackId: number, releaseId: number) => {
    setLoadingTrackId(trackId);
    setFeedback(null);
    try {
      const nextWishlist = await toggleReleaseWishlist(releaseId);
      setItems((prev) =>
        prev.map((item) =>
          item.id === trackId
            ? {
                ...item,
                release: {
                  ...(item.release ?? {}),
                  wishlist: nextWishlist,
                },
              }
            : item,
        ),
      );
      setFeedback(nextWishlist ? "Added to Discogs wishlist." : "Unable to add to Discogs wishlist.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to update record wishlist.");
    } finally {
      setLoadingTrackId(null);
    }
  };

  const onDismissTrack = async (trackId: number, releaseId: number) => {
    setLoadingTrackId(trackId);
    setFeedback(null);
    try {
      await dismissRecommendation({ trackId, releaseId });
      removeItem(trackId);
      setFeedback("Dismissed.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to dismiss recommendation.");
    } finally {
      setLoadingTrackId(null);
    }
  };

  const onExternalAddLabel = async (releaseId: number) => {
    setLoadingReleaseId(releaseId);
    setFeedback(null);
    try {
      await addLabelFromRelease(releaseId);
      removeExternalItem(releaseId);
      setFeedback("Label added and activated.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to add label.");
    } finally {
      setLoadingReleaseId(null);
    }
  };

  const onExternalWant = async (releaseId: number) => {
    setLoadingReleaseId(releaseId);
    setFeedback(null);
    try {
      await addDiscogsWant(releaseId);
      removeExternalItem(releaseId);
      setFeedback("Added to Discogs wishlist.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to add record to Discogs wishlist.");
    } finally {
      setLoadingReleaseId(null);
    }
  };

  const onExternalDismiss = async (releaseId: number) => {
    setLoadingReleaseId(releaseId);
    setFeedback(null);
    try {
      await dismissRecommendation({ releaseId });
      removeExternalItem(releaseId);
      setFeedback("Dismissed.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to dismiss recommendation.");
    } finally {
      setLoadingReleaseId(null);
    }
  };

  if (!canShow) {
    return <p className="text-sm text-[var(--color-muted)]">No fresh recommendations right now. Process more labels or play more tracks.</p>;
  }

  return (
    <div className="space-y-4">
      {items.length > 0 ? <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">In Library</p> : null}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {items.map((track) => {
        const loading = loadingTrackId === track.id;
        const release = (track.release ?? {}) as {
          title?: string | null;
          artist?: string | null;
          thumbUrl?: string | null;
          wishlist?: boolean | null;
          label?: { name?: string | null } | null;
        };
        return (
          <div key={track.id} className="rounded-md border border-[var(--color-border)] p-3">
            <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                {release.thumbUrl ? (
                  <img
                    src={release.thumbUrl}
                    alt={`${release.title ?? track.title} artwork`}
                    className="h-12 w-12 shrink-0 rounded border border-[var(--color-border)] object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-medium">{track.title}</p>
                  <p className="line-clamp-1 text-xs text-[var(--color-muted)]">
                    {release.artist ?? "Unknown artist"} • {release.label?.name ?? "Unknown label"} • {release.title ?? `Release #${track.releaseId}`}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-[var(--color-muted)]">Score {track.score.toFixed(1)}</p>
            </div>
            {track.reason ? <p className="mt-1 text-xs text-[var(--color-muted)]">{track.reason}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={loading}
                onClick={() => void onQueue(track.id, true)}
                title="Play this recommended track now"
                aria-label="Play track now"
              >
                <Play className="h-3.5 w-3.5" />
                Play Now
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => void onQueue(track.id, false)}
                title="Add this track to the front of your queue"
                aria-label="Queue track next"
              >
                Queue Next
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void onReviewed(track.id)} title="Mark this track as reviewed">
                Reviewed
              </Button>
              <Button
                type="button"
                size="sm"
                variant={track.saved ? "secondary" : "outline"}
                disabled={loading || Boolean(track.saved)}
                onClick={() => void onSave(track.id)}
                title="Save track locally (not Discogs wantlist)"
                aria-label={track.saved ? "Track saved locally" : "Save track locally"}
              >
                <HeartPlus className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={release.wishlist ? "secondary" : "outline"}
                disabled={loading || Boolean(release.wishlist)}
                onClick={() => void onAddRecordWishlist(track.id, track.releaseId)}
                title="Add release to Discogs wishlist"
                aria-label={release.wishlist ? "Already in Discogs wishlist" : "Add to Discogs wishlist"}
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={loading}
                onClick={() => void onDismissTrack(track.id, track.releaseId)}
                title="Dismiss recommendation"
                aria-label="Dismiss recommendation"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
      </div>

      {externalItems.length > 0 ? <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Outside Library</p> : null}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {externalItems.map((item) => {
          const loading = loadingReleaseId === item.releaseId;
          return (
            <div key={item.releaseId} className="rounded-md border border-[var(--color-border)] p-3">
            <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  {item.thumbUrl ? (
                    <img
                      src={item.thumbUrl}
                      alt={`${item.title} artwork`}
                      className="h-12 w-12 shrink-0 rounded border border-[var(--color-border)] object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                    <p className="line-clamp-1 text-xs text-[var(--color-muted)]">
                      {item.artist} • {item.labelName ?? "Unknown label"}
                      {typeof item.year === "number" ? ` • ${item.year}` : ""}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--color-muted)]">Score {item.score.toFixed(1)}</p>
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{item.reason}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => void onExternalAddLabel(item.releaseId)}
                  title="Create and activate label from this release"
                  aria-label="Add label from release"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => void onExternalWant(item.releaseId)}
                  title="Add record to Discogs wishlist"
                  aria-label="Add record to Discogs wishlist"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                </Button>
                <a
                  href={item.discogsUrl}
                  target="_blank"
                  rel="noreferrer"
                className="inline-flex h-8 items-center justify-center rounded-md px-2.5 text-xs text-[var(--color-text)] transition-colors duration-150 hover:bg-[var(--color-surface2)]/80"
                title="Open release on Discogs"
                aria-label="Open release on Discogs"
              >
                Discogs
              </a>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => void onExternalDismiss(item.releaseId)}
                  title="Dismiss recommendation"
                  aria-label="Dismiss recommendation"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {feedback ? <p className="text-xs text-[var(--color-muted)]">{feedback}</p> : null}
    </div>
  );
}
