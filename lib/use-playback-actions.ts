"use client";

import { useCallback, useState } from "react";
import {
  type TrackPlaybackAttemptResult,
} from "@/lib/use-playback-runner";
import {
  useTrackPlaybackRunner,
  type TrackPlaybackActionInput,
  type TrackPlaybackActionMessages,
} from "@/lib/use-playback-runner";

type UseTrackPlaybackActionOptions<TKey> = {
  quotaExceededMessage?: string | null;
  clearFeedbackOnQuotaClear?: boolean;
  onSuccess?: <TItem>(
    result: TrackPlaybackAttemptResult<TItem> & { ok: true; item: TItem },
    input: TrackPlaybackActionInput<TKey>,
  ) => void | Promise<void>;
};

export function useTrackPlaybackAction<TKey extends string | number>(
  options?: UseTrackPlaybackActionOptions<TKey>,
) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const {
    pendingKey,
    runPlayback: runPlaybackRaw,
    youtubeQuotaExceeded,
  } = useTrackPlaybackRunner<TKey>({
    onQuotaExceeded: () => {
      if (options?.quotaExceededMessage) {
        setFeedback(options.quotaExceededMessage);
      }
    },
    onQuotaCleared: () => {
      if (options?.clearFeedbackOnQuotaClear ?? true) {
        setFeedback(null);
      }
    },
  });

  const runPlayback = useCallback(
    async <TItem>(
      input: TrackPlaybackActionInput<TKey>,
      messages?: TrackPlaybackActionMessages,
    ) => {
      setFeedback(null);
      const result = await runPlaybackRaw<TItem>(input, messages);
      if (!result) return result;
      if (result.ok) {
        if (messages?.successMessage) {
          setFeedback(messages.successMessage);
        }
        await options?.onSuccess?.(result, input);
      } else if (result.message) {
        setFeedback(result.message);
      }
      return result;
    },
    [options, runPlaybackRaw],
  );

  return {
    feedback,
    pendingKey,
    runPlayback,
    setFeedback,
    youtubeQuotaExceeded,
  };
}
