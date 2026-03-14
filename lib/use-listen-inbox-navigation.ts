"use client";

import { useCallback, useEffect, useMemo } from "react";
import { getListenInboxPlaybackState } from "@/lib/listen-inbox-playback-state";
import { PLAYBACK_DISABLED_NOTICE, QUEUE_END_REACHED_NOTICE } from "@/lib/playback-action-notices";
import type { ListenRow } from "@/lib/listen-inbox-types";

export function useListenInboxNavigation({
  cursor,
  rowRefs,
  setCursor,
  setFeedback,
  playRow,
  showQueueFilters,
  visibleRows,
  youtubeQuotaExceeded,
}: {
  cursor: number;
  rowRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  setCursor: React.Dispatch<React.SetStateAction<number>>;
  setFeedback: React.Dispatch<React.SetStateAction<string | null>>;
  playRow: (trackId: number) => Promise<void>;
  showQueueFilters: boolean;
  visibleRows: ListenRow[];
  youtubeQuotaExceeded: boolean;
}) {
  const activeCursor = Math.max(0, Math.min(cursor, Math.max(0, visibleRows.length - 1)));
  const current = visibleRows[activeCursor] ?? null;
  const currentPlaybackState = useMemo(
    () =>
      current
        ? getListenInboxPlaybackState(current, {
            disabledNotice: PLAYBACK_DISABLED_NOTICE,
            quotaExceeded: youtubeQuotaExceeded,
          })
        : null,
    [current, youtubeQuotaExceeded],
  );
  const currentCanPlay = currentPlaybackState?.canPlay ?? false;
  const currentPlayHint = currentPlaybackState?.hint ?? null;
  const currentDisabledReason = currentPlaybackState?.disabledReason ?? null;
  const showMobileQuickRail = showQueueFilters && Boolean(current);

  const goPrevVisibleRow = useCallback(() => {
    setCursor((prev) => Math.max(0, prev - 1));
  }, [setCursor]);

  const goNextVisibleRow = useCallback(() => {
    setCursor((prev) => Math.min(Math.max(0, visibleRows.length - 1), prev + 1));
  }, [setCursor, visibleRows.length]);

  const canGoPrevVisibleRow = activeCursor > 0;
  const canGoNextVisibleRow = activeCursor < Math.max(0, visibleRows.length - 1);

  const nextNeedsReviewCursor = useMemo(() => {
    if (visibleRows.length === 0) return -1;
    for (let idx = activeCursor + 1; idx < visibleRows.length; idx += 1) {
      const row = visibleRows[idx];
      const alreadyPlayed = (row.playedCount ?? 0) > 0 || Boolean(row.wasPlayed);
      if (alreadyPlayed && !row.listened) return idx;
    }
    return -1;
  }, [activeCursor, visibleRows]);

  const jumpToNextNeedsReview = useCallback(() => {
    if (nextNeedsReviewCursor < 0) return;
    setCursor(nextNeedsReviewCursor);
  }, [nextNeedsReviewCursor, setCursor]);

  useEffect(() => {
    if (!showMobileQuickRail || !current) return;
    const rowEl = rowRefs.current[current.trackId];
    if (!rowEl) return;
    rowEl.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeCursor, current, rowRefs, showMobileQuickRail]);

  const skipAndPlayNext = useCallback(() => {
    const nextTrackId = visibleRows[activeCursor + 1]?.trackId ?? null;
    if (!nextTrackId) {
      setFeedback(QUEUE_END_REACHED_NOTICE);
      return;
    }
    setCursor(activeCursor + 1);
    if (currentCanPlay) {
      void playRow(nextTrackId);
    }
  }, [activeCursor, currentCanPlay, playRow, setCursor, setFeedback, visibleRows]);

  return {
    activeCursor,
    current,
    currentCanPlay,
    currentDisabledReason,
    currentPlayHint,
    showMobileQuickRail,
    goPrevVisibleRow,
    goNextVisibleRow,
    canGoPrevVisibleRow,
    canGoNextVisibleRow,
    nextNeedsReviewCursor,
    jumpToNextNeedsReview,
    skipAndPlayNext,
  };
}
