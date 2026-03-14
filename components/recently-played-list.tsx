"use client";

import { useMemo, useState } from "react";
import { DiscogsLink } from "@/components/discogs-link";
import { MediaActionRow } from "@/components/media-action-row";
import { MutationActionButton } from "@/components/mutation-action-button";
import { SegmentedControlButton } from "@/components/segmented-control-button";
import {
  replayTrackAriaLabel,
  replayTrackTitle,
} from "@/lib/library-action-labels";
import { useReplayTrackButtonAction } from "@/lib/use-playback-button-actions";

type RecentlyPlayedItem = {
  id: number;
  trackId: number | null;
  track?: { id: number; title: string; artistsText?: string | null; listened: boolean; saved: boolean } | null;
  release?: { id?: number; title: string; artist?: string | null; discogsUrl?: string | null; thumbUrl?: string | null; wishlist?: boolean } | null;
  label?: { id?: number; name: string } | null;
};

export function RecentlyPlayedList({ items }: { items: RecentlyPlayedItem[] }) {
  const [filter, setFilter] = useState<"all" | "wantlist" | "reviewed-no-wantlist">("all");
  const { disabled: replayDisabled, feedback, isPending, replay } = useReplayTrackButtonAction();

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

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] p-3">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm font-medium">Recently Played ({filteredItems.length})</p>
        <div className="grid w-full grid-cols-1 gap-1.5 text-xs sm:flex sm:w-auto sm:flex-wrap">
          <SegmentedControlButton active={filter === "all"} onClick={() => setFilter("all")} tone="compact" className="justify-center sm:justify-start">
            All ({counts.all})
          </SegmentedControlButton>
          <SegmentedControlButton active={filter === "wantlist"} onClick={() => setFilter("wantlist")} tone="compact" className="justify-center sm:justify-start">
            Added to Want List ({counts.wantlist})
          </SegmentedControlButton>
          <SegmentedControlButton active={filter === "reviewed-no-wantlist"} onClick={() => setFilter("reviewed-no-wantlist")} tone="compact" className="justify-center sm:justify-start">
            Reviewed Not Added ({counts.reviewedNoWantlist})
          </SegmentedControlButton>
        </div>
      </div>
      <div className="space-y-2">
        {filteredItems.map((item) => {
          const trackTitle = item.track?.title || item.release?.title || "Unknown track";
          const trackArtist = item.track?.artistsText || item.release?.artist || "Unknown artist";
          const releaseTitle = item.release?.title || "Unknown release";
          const labelName = item.label?.name || "Unknown label";
          return (
            <div key={item.id} className="rounded-md border border-[var(--color-border)] px-2 py-1.5">
              <MediaActionRow
                artworkAlt={`${releaseTitle} artwork`}
                artworkUrl={item.release?.thumbUrl}
                title={trackTitle}
                meta={
                  <>
                    {trackArtist}
                    {" • "}
                    {labelName}
                    {" • "}
                    {releaseTitle}
                  </>
                }
                actions={<div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                  <MutationActionButton
                    preset="playback"
                    size="sm"
                    variant="outline"
                    className="w-full justify-center sm:w-auto sm:justify-start"
                    disabled={!item.trackId || replayDisabled}
                    onClick={() => void replay(item.id, item.trackId)}
                    title={replayTrackTitle()}
                    ariaLabel={replayTrackAriaLabel()}
                    pending={isPending(item.id)}
                    pendingChildren="..."
                  >
                    Play Again
                  </MutationActionButton>
                  <DiscogsLink discogsUrl={item.release?.discogsUrl ?? ""} />
                </div>}
              />
            </div>
          );
        })}
        {filteredItems.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No played items in this filter yet.</p> : null}
      </div>
      {feedback ? <p className="mt-2 text-xs text-[var(--color-muted)]">{feedback}</p> : null}
    </div>
  );
}
