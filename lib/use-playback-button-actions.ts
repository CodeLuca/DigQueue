"use client";

import { useCallback } from "react";
import {
  MATCH_PLAY_ERROR_NOTICE,
  PLAYBACK_DISABLED_NOTICE,
  RECOMMENDATION_NO_MATCH_NOTICE,
  RECOMMENDATION_PLAY_SUCCESS_NOTICE,
  RECOMMENDATION_QUEUE_ERROR_NOTICE,
  RECOMMENDATION_QUEUE_SUCCESS_NOTICE,
  REPLAY_DISABLED_NOTICE,
  REPLAY_ERROR_NOTICE,
  REPLAY_NO_MATCH_NOTICE,
  REPLAY_SUCCESS_NOTICE,
  REPLAY_UNAVAILABLE_NOTICE,
  TRACK_QUEUE_BUTTON_ERROR_NOTICE,
} from "@/lib/playback-action-notices";
import type { PlaybackQueueItem } from "@/lib/playback-queue-item";
import { useTrackPlaybackAction } from "@/lib/use-playback-actions";

type DualPlaybackMessages = {
  noMatchMessage?: string | null;
  quotaExceededMessage: string;
  errorMessage: string;
  playSuccessMessage?: string | null;
  queueSuccessMessage?: string | null;
  queueMode?: "normal" | "next";
};

function useDualPlaybackButtonActions<TKey extends string | number>(
  options: {
    queueInput: { key: TKey; trackId: number };
    playInput: { key: TKey; trackId: number; matchId?: number };
    messages: DualPlaybackMessages;
  },
) {
  const { feedback, pendingKey, runPlayback, setFeedback, youtubeQuotaExceeded } = useTrackPlaybackAction<TKey>({
    quotaExceededMessage: options.messages.quotaExceededMessage,
  });

  const queueLater = useCallback(async () => {
    await runPlayback<PlaybackQueueItem>(
      {
        key: options.queueInput.key,
        trackId: options.queueInput.trackId,
        playNow: false,
        queueMode: options.messages.queueMode,
      },
      {
        noMatchMessage: options.messages.noMatchMessage ?? null,
        quotaMessage: options.messages.quotaExceededMessage,
        errorMessage: options.messages.errorMessage,
        successMessage: options.messages.queueSuccessMessage ?? null,
      },
    );
  }, [options, runPlayback]);

  const playNow = useCallback(async () => {
    await runPlayback<PlaybackQueueItem>(
      {
        key: options.playInput.key,
        trackId: options.playInput.trackId,
        matchId: options.playInput.matchId,
        playNow: true,
        queueMode: options.messages.queueMode,
      },
      {
        noMatchMessage: options.messages.noMatchMessage ?? null,
        quotaMessage: options.messages.quotaExceededMessage,
        errorMessage: options.messages.errorMessage,
        successMessage: options.messages.playSuccessMessage ?? null,
      },
    );
  }, [options, runPlayback]);

  return {
    feedback,
    setFeedback,
    queueLater,
    playNow,
    pendingKey,
    queuePending: pendingKey === options.queueInput.key,
    playPending: pendingKey === options.playInput.key,
    disabled: pendingKey !== null || youtubeQuotaExceeded,
  };
}

export function useTrackQueueButtonActions(trackId: number) {
  return useDualPlaybackButtonActions({
    queueInput: { key: "queue", trackId },
    playInput: { key: "play", trackId },
    messages: {
      quotaExceededMessage: PLAYBACK_DISABLED_NOTICE,
      errorMessage: TRACK_QUEUE_BUTTON_ERROR_NOTICE,
    },
  });
}

export function usePlayMatchButtonAction(trackId: number, matchId: number) {
  const { disabled, playNow, playPending } = useDualPlaybackButtonActions({
    queueInput: { key: "play", trackId },
    playInput: { key: "play", trackId, matchId },
    messages: {
      quotaExceededMessage: "",
      errorMessage: MATCH_PLAY_ERROR_NOTICE,
      queueMode: "next",
    },
  });

  return {
    playNow,
    pending: playPending,
    disabled,
  };
}

export function useRecommendationPlaybackButtonActions(trackId: number) {
  const { disabled, feedback, pendingKey, playNow, queueLater, setFeedback } = useDualPlaybackButtonActions({
    queueInput: { key: trackId, trackId },
    playInput: { key: trackId, trackId },
    messages: {
      noMatchMessage: RECOMMENDATION_NO_MATCH_NOTICE,
      quotaExceededMessage: PLAYBACK_DISABLED_NOTICE,
      errorMessage: RECOMMENDATION_QUEUE_ERROR_NOTICE,
      playSuccessMessage: RECOMMENDATION_PLAY_SUCCESS_NOTICE,
      queueSuccessMessage: RECOMMENDATION_QUEUE_SUCCESS_NOTICE,
      queueMode: "next",
    },
  });

  return {
    disabled,
    feedback,
    pending: pendingKey === trackId,
    playNow,
    queueNext: queueLater,
    setFeedback,
  };
}

export function useReplayTrackButtonAction() {
  const { feedback, pendingKey, runPlayback, setFeedback, youtubeQuotaExceeded } = useTrackPlaybackAction<number>({
    quotaExceededMessage: REPLAY_DISABLED_NOTICE,
  });

  const replay = useCallback(
    async (playbackKey: number, trackId: number | null) => {
      if (!trackId) {
        setFeedback(REPLAY_UNAVAILABLE_NOTICE);
        return;
      }
      await runPlayback<PlaybackQueueItem>(
        { key: playbackKey, trackId, playNow: true, queueMode: "next" },
        {
          noMatchMessage: REPLAY_NO_MATCH_NOTICE,
          quotaMessage: REPLAY_DISABLED_NOTICE,
          errorMessage: REPLAY_ERROR_NOTICE,
          successMessage: REPLAY_SUCCESS_NOTICE,
        },
      );
    },
    [runPlayback, setFeedback],
  );

  return {
    feedback,
    replay,
    isPending: (playbackKey: number) => pendingKey === playbackKey,
    disabled: youtubeQuotaExceeded,
  };
}
