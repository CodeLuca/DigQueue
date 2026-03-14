"use client";

import { useCallback } from "react";
import { dispatchPlayItemEvent } from "@/lib/client-playback-events";
import { clearUpNextByTrackId } from "@/lib/client-listen-row-state";
import {
  LISTENING_STATION_PLAYBACK_DISABLED_NOTICE,
  TRACK_QUEUE_ERROR_NOTICE,
  TRACK_QUEUE_NO_MATCH_NOTICE,
  playbackStartedNotice,
} from "@/lib/playback-action-notices";
import {
  clearYouTubeQuotaExceededInSession,
  setYouTubeQuotaExceededInSession,
} from "@/lib/youtube-quota-client";
import type { ListenRow } from "@/lib/listen-inbox-types";
import {
  createOptimisticPlaybackQueueItem,
  type PlaybackQueueItem,
} from "@/lib/playback-queue-item";
import type {
  TrackPlaybackActionInput,
  TrackPlaybackAttemptResult,
} from "@/lib/use-playback-runner";

const ENQUEUE_TIMEOUT_MS = 6000;

type RunPlayback = <TItem>(
  input: TrackPlaybackActionInput<number>,
  messages?: {
    noMatchMessage?: string | null;
    quotaMessage?: string | null;
    errorMessage?: string;
    successMessage?: string | null;
  },
) => Promise<TrackPlaybackAttemptResult<TItem> | null>;

export function useListenInboxPlayback({
  rows,
  runPlayback,
  setBaseRows,
  setFeedback,
  setYoutubeQuotaExceeded,
  youtubeQuotaExceeded,
}: {
  rows: ListenRow[];
  runPlayback: RunPlayback;
  setBaseRows: React.Dispatch<React.SetStateAction<ListenRow[]>>;
  setFeedback: React.Dispatch<React.SetStateAction<string | null>>;
  setYoutubeQuotaExceeded: (next: boolean) => void;
  youtubeQuotaExceeded: boolean;
}) {
  const playRow = useCallback(async (trackId: number) => {
    if (youtubeQuotaExceeded) return;
    const row = rows.find((item) => item.trackId === trackId);
    const optimisticItem = row ? createOptimisticPlaybackQueueItem(row) : null;
    if (optimisticItem) {
      dispatchPlayItemEvent(optimisticItem);
    }
    const result = await runPlayback<PlaybackQueueItem>(
      {
        key: trackId,
        trackId,
        playNow: true,
        queueMode: "next",
        timeoutMs: ENQUEUE_TIMEOUT_MS,
        retryTimeoutCount: 1,
      },
      {
        noMatchMessage: TRACK_QUEUE_NO_MATCH_NOTICE,
        quotaMessage: LISTENING_STATION_PLAYBACK_DISABLED_NOTICE,
        errorMessage: TRACK_QUEUE_ERROR_NOTICE,
      },
    );
    if (!result || !result.ok) {
      if (result?.kind === "quota") {
        setYouTubeQuotaExceededInSession();
      }
      if (result?.message || result?.kind === "error") {
        setFeedback(
          result?.kind === "error"
            ? TRACK_QUEUE_ERROR_NOTICE
            : (result?.message ?? null),
        );
      }
      return;
    }
    if (!optimisticItem || optimisticItem.youtubeVideoId !== result.item.youtubeVideoId) {
      dispatchPlayItemEvent(result.item);
    }
    setBaseRows((prev) => clearUpNextByTrackId(prev, trackId));
    setFeedback(playbackStartedNotice(Boolean(optimisticItem)));
  }, [rows, runPlayback, setBaseRows, setFeedback, youtubeQuotaExceeded]);

  const clearYoutubeQuotaExceeded = useCallback(() => {
    setYoutubeQuotaExceeded(false);
    setFeedback(null);
    clearYouTubeQuotaExceededInSession();
  }, [setFeedback, setYoutubeQuotaExceeded]);

  return {
    playRow,
    clearYoutubeQuotaExceeded,
  };
}
