"use client";

import { useEffect } from "react";
import { subscribeRequestPlayerCurrent } from "@/lib/client-playback-events";
import {
  subscribeReleaseWishlistUpdated,
  subscribeTrackTodoUpdated,
} from "@/lib/client-library-events";
import { publishPlayerCurrent } from "@/lib/player-current-client-store";
import {
  applyReleaseWishlistToCurrentItem,
  applyTrackTodoToCurrentItem,
  buildPlayerCurrentDetail,
} from "@/lib/player-current-state";

type CurrentPlayerItem = {
  id: number;
  track?: {
    id: number;
    saved?: boolean;
    listened?: boolean;
  } | null;
  release?: {
    id?: number;
    wishlist?: boolean;
  } | null;
};

export function useMiniPlayerCurrentSync<TItem extends CurrentPlayerItem>(options: {
  current: TItem | null;
  currentRef: React.RefObject<TItem | null>;
  playing: boolean;
  setCurrent: React.Dispatch<React.SetStateAction<TItem | null>>;
}) {
  const { current, currentRef, playing, setCurrent } = options;

  useEffect(() => {
    publishPlayerCurrent(buildPlayerCurrentDetail(current, playing));
  }, [current, playing]);

  useEffect(() => {
    return subscribeRequestPlayerCurrent(() => {
      publishPlayerCurrent(buildPlayerCurrentDetail(currentRef.current, playing));
    });
  }, [currentRef, playing]);

  useEffect(() => {
    return subscribeTrackTodoUpdated(({ trackId, field, value }) => {
      setCurrent((prev) => applyTrackTodoToCurrentItem(prev, trackId, field, value));
    });
  }, [setCurrent]);

  useEffect(() => {
    return subscribeReleaseWishlistUpdated(({ releaseIds, value }) => {
      setCurrent((prev) => applyReleaseWishlistToCurrentItem(prev, releaseIds, value));
    });
  }, [setCurrent]);
}
