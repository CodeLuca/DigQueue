"use client";

import { useCallback, useEffect } from "react";
import {
  subscribePlaybackNext,
  subscribePlaybackPlayPause,
  subscribePlaybackPrev,
  subscribePlayItem,
  subscribeReviewedCurrent,
} from "@/lib/client-playback-events";

type MiniPlayerControlOptions<TItem> = {
  current: TItem | null;
  ready: boolean;
  playing: boolean;
  ensurePlaybackOwnership: () => boolean;
  pausePlayback: () => void;
  resumePlayback: () => void;
  loadNext: (action?: "played" | "listened" | null) => Promise<boolean>;
  loadPrev: () => void;
  loadSpecific: (item: TItem) => Promise<void>;
  markReviewed: () => Promise<void>;
};

export function useMiniPlayerPlaybackControls<TItem>({
  current,
  ready,
  playing,
  ensurePlaybackOwnership,
  pausePlayback,
  resumePlayback,
  loadNext,
  loadPrev,
  loadSpecific,
  markReviewed,
}: MiniPlayerControlOptions<TItem>) {
  const playPause = useCallback(() => {
    if (!ready) return;
    if (!current) {
      void loadNext();
      return;
    }
    if (playing) {
      pausePlayback();
    } else {
      if (!ensurePlaybackOwnership()) return;
      resumePlayback();
    }
  }, [current, ensurePlaybackOwnership, loadNext, pausePlayback, playing, ready, resumePlayback]);

  const next = useCallback(() => {
    void loadNext("played");
  }, [loadNext]);

  const prev = useCallback(() => {
    loadPrev();
  }, [loadPrev]);

  const playItem = useCallback((item: TItem) => {
    void loadSpecific(item);
  }, [loadSpecific]);

  const reviewedCurrent = useCallback(() => {
    void markReviewed();
  }, [markReviewed]);

  useEffect(() => {
    const unsubscribePlayItem = subscribePlayItem<TItem>(playItem);
    const unsubscribePlayPause = subscribePlaybackPlayPause(playPause);
    const unsubscribeNext = subscribePlaybackNext(next);
    const unsubscribePrev = subscribePlaybackPrev(prev);
    const unsubscribeReviewed = subscribeReviewedCurrent(reviewedCurrent);

    return () => {
      unsubscribePlayPause();
      unsubscribeNext();
      unsubscribePrev();
      unsubscribeReviewed();
      unsubscribePlayItem();
    };
  }, [next, playItem, playPause, prev, reviewedCurrent]);

  return { next, playItem, playPause, prev };
}
