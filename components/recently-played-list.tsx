"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toDiscogsWebUrl } from "@/lib/discogs-links";

type RecentlyPlayedItem = {
  id: number;
  trackId: number | null;
  track?: { id: number; title: string; artistsText?: string | null; listened: boolean; saved: boolean } | null;
  release?: { id?: number; title: string; artist?: string | null; discogsUrl?: string | null; thumbUrl?: string | null; wishlist?: boolean } | null;
  label?: { id?: number; name: string } | null;
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
  if (body?.reason === "no_match") {
    throw new Error("NO_MATCH");
  }
  if (body?.reason === "youtube_quota_exceeded") {
    throw new Error("YOUTUBE_QUOTA_EXCEEDED");
  }
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || "Unable to queue track.");
  }
  if (!body.item) throw new Error("Queued track not found.");
  return body.item;
}

export function RecentlyPlayedList({ items }: { items: RecentlyPlayedItem[] }) {
  const [filter, setFilter] = useState<"all" | "wantlist" | "reviewed-no-wantlist">("all");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const filterButtonClass = (active: boolean) =>
    `rounded-md border px-2 py-1 font-medium transition ${
      active
        ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_24%,var(--color-surface2)_76%)] text-[var(--color-text)] shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_45%,transparent)]"
        : "border-[var(--color-border)] text-[var(--color-muted)] opacity-70 hover:opacity-100 hover:bg-[var(--color-surface)]"
    }`;

  const counts = useMemo(() => {
    let wantlist = 0;
    let reviewedNoWantlist = 0;
    for (const item of items) {
      const isInWantlist = Boolean(item.track?.saved || item.release?.wishlist);
      if (isInWantlist) wantlist += 1;
      if (item.track?.listened && !isInWantlist) reviewedNoWantlist += 1;
    }
    return {
      all: items.length,
      wantlist,
      reviewedNoWantlist,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "wantlist") {
      return items.filter((item) => Boolean(item.track?.saved || item.release?.wishlist));
    }
    return items.filter((item) => {
      const isInWantlist = Boolean(item.track?.saved || item.release?.wishlist);
      return Boolean(item.track?.listened) && !isInWantlist;
    });
  }, [filter, items]);

  const playAgain = useCallback(async (item: RecentlyPlayedItem) => {
    if (!item.trackId) {
      setFeedback("Track unavailable for replay.");
      return;
    }
    setLoadingId(item.id);
    try {
      const queued = await enqueueTrack(item.trackId, "next");
      window.dispatchEvent(new CustomEvent("digqueue:play-item", { detail: queued }));
      setFeedback("Playing again.");
    } catch (error) {
      if (error instanceof Error && error.message === "NO_MATCH") {
        setFeedback("No playable video match found for this track.");
      } else if (error instanceof Error && error.message === "YOUTUBE_QUOTA_EXCEEDED") {
        window.dispatchEvent(new CustomEvent("digqueue:youtube-quota-exceeded"));
        setFeedback("YouTube quota reached. Replay is temporarily disabled.");
      } else {
        setFeedback(error instanceof Error ? error.message : "Unable to play track.");
      }
    } finally {
      setLoadingId(null);
    }
  }, []);

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Recently Played ({filteredItems.length})</p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            className={filterButtonClass(filter === "all")}
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            className={filterButtonClass(filter === "wantlist")}
            onClick={() => setFilter("wantlist")}
            aria-pressed={filter === "wantlist"}
          >
            Added to Want List ({counts.wantlist})
          </button>
          <button
            type="button"
            className={filterButtonClass(filter === "reviewed-no-wantlist")}
            onClick={() => setFilter("reviewed-no-wantlist")}
            aria-pressed={filter === "reviewed-no-wantlist"}
          >
            Reviewed Not Added ({counts.reviewedNoWantlist})
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {filteredItems.map((item) => {
          const trackTitle = item.track?.title || item.release?.title || "Unknown track";
          const trackArtist = item.track?.artistsText || item.release?.artist || "Unknown artist";
          const releaseTitle = item.release?.title || "Unknown release";
          const labelName = item.label?.name || "Unknown label";
          const discogsHref = toDiscogsWebUrl(item.release?.discogsUrl ?? "", item.release?.id ? `/release/${item.release.id}` : "");
          return (
            <div key={item.id} className="rounded-md border border-[var(--color-border)] px-2 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  {item.release?.thumbUrl ? (
                    <img
                      src={item.release.thumbUrl}
                      alt={`${releaseTitle} artwork`}
                      className="h-10 w-10 shrink-0 rounded border border-[var(--color-border)] object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm">{trackTitle}</p>
                    <p className="line-clamp-1 text-xs text-[var(--color-muted)]">
                      {trackArtist}
                      {" • "}
                      {labelName}
                      {" • "}
                      {releaseTitle}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!item.trackId || loadingId === item.id}
                    onClick={() => void playAgain(item)}
                    title="Play this track now in the mini-player"
                  >
                    {loadingId === item.id ? "..." : "Play Again"}
                  </Button>
                  {item.release?.id ? (
                    <Link
                      href={`/releases/${item.release.id}`}
                      className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs hover:bg-[var(--color-surface)]"
                    >
                      Release
                    </Link>
                  ) : null}
                  <a
                    className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                    href={discogsHref}
                    target="_blank"
                    rel="noreferrer"
                    title="Open on Discogs"
                    aria-label="Open on Discogs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No played items in this filter yet.</p> : null}
      </div>
      {feedback ? <p className="mt-2 text-xs text-[var(--color-muted)]">{feedback}</p> : null}
    </div>
  );
}
