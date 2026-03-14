"use client";
import { dispatchPlayItemEvent } from "@/lib/client-playback-events";
import { enqueueTrackClient } from "@/lib/client-queue-actions";
import { dispatchQueueTrackEnqueuedEvent } from "@/lib/client-queue-events";
import { TRACK_QUEUE_ERROR_NOTICE } from "@/lib/playback-action-notices";
import { QUEUE_ERROR_NO_MATCH, QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED } from "@/lib/queue-errors";
import { setYouTubeQuotaExceededInSession } from "@/lib/youtube-quota-client";

type EnqueuedQueueItem = {
  id?: number;
  youtubeVideoId?: string;
};

type TrackPlaybackFailureKind = "no_match" | "quota" | "error";

export type TrackPlaybackAttemptResult<TItem> =
  | { ok: true; item: TItem }
  | { ok: false; kind: TrackPlaybackFailureKind; message: string | null };

export function isYouTubeQuotaExceededError(error: unknown) {
  return error instanceof Error && error.message === QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED;
}

export function markYouTubeQuotaExceededClient(setter?: (value: boolean) => void) {
  setter?.(true);
  setYouTubeQuotaExceededInSession();
}

export function resolveTrackPlaybackFailure(
  error: unknown,
  options?: {
    setQuotaExceeded?: (value: boolean) => void;
    noMatchMessage?: string | null;
    quotaMessage?: string | null;
    errorMessage?: string;
  },
): TrackPlaybackAttemptResult<never> {
  if (error instanceof Error && error.message === QUEUE_ERROR_NO_MATCH) {
    return {
      ok: false,
      kind: "no_match",
      message: options?.noMatchMessage ?? null,
    };
  }
  if (isYouTubeQuotaExceededError(error)) {
    markYouTubeQuotaExceededClient(options?.setQuotaExceeded);
    return {
      ok: false,
      kind: "quota",
      message: options?.quotaMessage ?? null,
    };
  }
  return {
    ok: false,
    kind: "error",
    message: error instanceof Error ? error.message : (options?.errorMessage ?? TRACK_QUEUE_ERROR_NOTICE),
  };
}

export async function enqueueTrackPlaybackClient<TItem>(input: {
  trackId: number;
  matchId?: number;
  playNow?: boolean;
  queueMode?: "normal" | "next";
  timeoutMs?: number;
  retryTimeoutCount?: number;
}) {
  const item = await enqueueTrackClient<TItem>({
    trackId: input.trackId,
    matchId: input.matchId,
    queueMode: input.queueMode ?? (input.playNow ? "next" : "normal"),
    timeoutMs: input.timeoutMs,
    retryTimeoutCount: input.retryTimeoutCount,
  });
  const queueMode = input.queueMode ?? (input.playNow ? "next" : "normal");
  const queueItem = item as EnqueuedQueueItem | null;
  dispatchQueueTrackEnqueuedEvent({
    trackId: input.trackId,
    queueItemId: typeof queueItem?.id === "number" ? queueItem.id : null,
    youtubeVideoId: typeof queueItem?.youtubeVideoId === "string" ? queueItem.youtubeVideoId : null,
    playNow: Boolean(input.playNow),
    queueMode,
  });
  if (input.playNow) {
    dispatchPlayItemEvent(item);
  }
  return item;
}

export async function attemptTrackPlaybackClient<TItem>(
  input: {
    trackId: number;
    matchId?: number;
    playNow?: boolean;
    queueMode?: "normal" | "next";
    timeoutMs?: number;
    retryTimeoutCount?: number;
  },
  options?: {
    setQuotaExceeded?: (value: boolean) => void;
    noMatchMessage?: string | null;
    quotaMessage?: string | null;
    errorMessage?: string;
  },
): Promise<TrackPlaybackAttemptResult<TItem>> {
  try {
    const item = await enqueueTrackPlaybackClient<TItem>(input);
    return { ok: true, item };
  } catch (error) {
    return resolveTrackPlaybackFailure(error, options);
  }
}
