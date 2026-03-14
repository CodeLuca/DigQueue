import type { PlayerCurrentEventDetail } from "@/lib/client-playback-events";
import { createAffectedReleaseIdSet } from "@/lib/client-release-wishlist-state";
import { applyTrackTodoToTrackState } from "@/lib/client-track-todo-state";

type PlayerTrackState = {
  id: number;
  saved?: boolean;
  listened?: boolean;
};

type PlayerReleaseState = {
  id?: number;
  wishlist?: boolean;
};

type CurrentPlayerItem = {
  id: number;
  track?: PlayerTrackState | null;
  release?: PlayerReleaseState | null;
};

export function buildPlayerCurrentDetail<TItem extends CurrentPlayerItem>(
  item: TItem | null | undefined,
  playing: boolean,
): PlayerCurrentEventDetail {
  return {
    trackId: item?.track?.id ?? null,
    queueItemId: item?.id ?? null,
    saved: typeof item?.track?.saved === "boolean" ? item.track.saved : null,
    listened: typeof item?.track?.listened === "boolean" ? item.track.listened : null,
    playing,
  };
}

export function applyTrackTodoToCurrentItem<TItem extends CurrentPlayerItem>(
  item: TItem | null | undefined,
  trackId: number,
  field: "saved" | "listened",
  value: boolean,
) {
  if (!item?.track || item.track.id !== trackId) return item ?? null;
  return {
    ...item,
    track: applyTrackTodoToTrackState(item.track, field, value),
  };
}

export function applyReleaseWishlistToCurrentItem<TItem extends CurrentPlayerItem>(
  item: TItem | null | undefined,
  releaseIds: number[],
  value: boolean,
) {
  if (!item?.release) return item ?? null;
  const affectedReleaseIds = createAffectedReleaseIdSet(releaseIds);
  if (!affectedReleaseIds.has(item.release.id ?? -1)) return item;
  return {
    ...item,
    release: {
      ...item.release,
      wishlist: value,
    },
  };
}
