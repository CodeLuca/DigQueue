"use client";

import { useCallback, useState } from "react";
import {
  attemptTrackPlaybackClient,
  type TrackPlaybackAttemptResult,
} from "@/lib/client-playback-actions";
import { useYouTubeQuotaState } from "@/lib/use-youtube-quota-state";

type UseTrackPlaybackRunnerOptions = {
  onQuotaExceeded?: () => void;
  onQuotaCleared?: () => void;
};

export type TrackPlaybackActionInput<TKey> = {
  key: TKey;
  trackId: number;
  matchId?: number;
  playNow?: boolean;
  queueMode?: "normal" | "next";
  timeoutMs?: number;
  retryTimeoutCount?: number;
};

export type TrackPlaybackActionMessages = {
  noMatchMessage?: string | null;
  quotaMessage?: string | null;
  errorMessage?: string;
  successMessage?: string | null;
};

export function useTrackPlaybackRunner<TKey extends string | number>(
  options?: UseTrackPlaybackRunnerOptions,
) {
  const [pendingKey, setPendingKey] = useState<TKey | null>(null);
  const { youtubeQuotaExceeded, setYoutubeQuotaExceeded } = useYouTubeQuotaState({
    onExceeded: options?.onQuotaExceeded,
    onCleared: options?.onQuotaCleared,
  });

  const runPlayback = useCallback(
    async <TItem>(
      input: TrackPlaybackActionInput<TKey>,
      messages?: TrackPlaybackActionMessages,
    ) => {
      if (youtubeQuotaExceeded) return null;
      setPendingKey(input.key);
      try {
        const result = await attemptTrackPlaybackClient<TItem>(
          {
            trackId: input.trackId,
            matchId: input.matchId,
            playNow: input.playNow,
            queueMode: input.queueMode,
            timeoutMs: input.timeoutMs,
            retryTimeoutCount: input.retryTimeoutCount,
          },
          {
            setQuotaExceeded: setYoutubeQuotaExceeded,
            noMatchMessage: messages?.noMatchMessage,
            quotaMessage: messages?.quotaMessage ?? null,
            errorMessage: messages?.errorMessage,
          },
        );
        return result;
      } finally {
        setPendingKey((current) => (current === input.key ? null : current));
      }
    },
    [setYoutubeQuotaExceeded, youtubeQuotaExceeded],
  );

  return {
    pendingKey,
    runPlayback,
    youtubeQuotaExceeded,
    setYoutubeQuotaExceeded,
  };
}

export type { TrackPlaybackAttemptResult };
