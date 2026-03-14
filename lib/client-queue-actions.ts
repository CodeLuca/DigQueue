"use client";

import type { ClientFetcher } from "@/lib/client-fetcher";
import { buildJsonPostInit, fetchClientJsonResponse } from "@/lib/client-json";
import { deleteClientMutation, postClientMutation } from "@/lib/client-mutations";
import { TRACK_QUEUE_ERROR_NOTICE } from "@/lib/playback-action-notices";
import {
  QUEUE_ERROR_NO_MATCH,
  QUEUE_ERROR_TIMEOUT,
  QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED,
} from "@/lib/queue-errors";
import { dispatchQueueStateMutatedEvent } from "@/lib/client-queue-events";
import {
  QUEUE_ENQUEUE_REASON_NO_MATCH,
  QUEUE_ENQUEUE_REASON_YOUTUBE_QUOTA_EXCEEDED,
  type QueueEnqueueResponse,
} from "@/lib/queue-enqueue-contract";
import {
  normalizeQueueDedupeMutationResponse,
  normalizeQueueItemRemovalResponse,
  normalizeQueueScopeMutationResponse,
  type QueueDedupeMutationResponse,
  type QueueItemRemovalResponse,
  type QueueScopeMutationResponse,
} from "@/lib/queue-mutation-contract";

export async function syncQueueScopeClient(
  input: { enabled?: boolean; trackIds: number[] },
  options?: { fetcher?: ClientFetcher; errorMessage?: string },
) {
  const body = await postClientMutation<
    QueueScopeMutationResponse & {
      ok?: boolean;
      error?: string;
    }
  >(
    "/api/queue/scope",
    {
      enabled: input.enabled ?? true,
      trackIds: input.trackIds,
    },
    { ...options, errorMessage: options?.errorMessage || "Unable to sync queue scope." },
  );
  const result = normalizeQueueScopeMutationResponse(body);
  if (result.removed > 0 || result.added > 0) {
    dispatchQueueStateMutatedEvent({
      reason: "scope_sync",
      added: result.added,
      removed: result.removed,
      skipped: result.skipped,
    });
  }
  return result;
}

export async function dedupeQueueClient(
  input?: { trackId?: number },
  options?: { fetcher?: ClientFetcher; errorMessage?: string },
) {
  const body = await postClientMutation<
    QueueDedupeMutationResponse & {
      ok?: boolean;
      error?: string;
    }
  >(
    "/api/queue/maintenance/dedupe",
    input ?? {},
    { ...options, errorMessage: options?.errorMessage || "Unable to clean queue duplicates." },
  );
  const result = normalizeQueueDedupeMutationResponse(body);
  if (result.removed > 0) {
    dispatchQueueStateMutatedEvent({
      reason: "remove",
      removed: result.removed,
    });
  }
  return result;
}

export async function removeQueueItemClient(
  queueItemId: number,
  options?: { fetcher?: ClientFetcher; errorMessage?: string },
) {
  const body = await deleteClientMutation<
    QueueItemRemovalResponse & {
      ok?: boolean;
      error?: string;
    }
  >(
    `/api/queue/item/${queueItemId}`,
    { ...options, errorMessage: options?.errorMessage || "Unable to remove queue item." },
  );
  const result = normalizeQueueItemRemovalResponse(body, queueItemId);
  if (result.removed) {
    dispatchQueueStateMutatedEvent({
      reason: "remove",
      queueItemId: result.queueItemId,
      removed: 1,
    });
  }
  return result;
}

export async function enqueueTrackClient<TItem>(
  input: {
    trackId: number;
    queueMode?: "normal" | "next";
    matchId?: number;
    timeoutMs?: number;
    retryTimeoutCount?: number;
  },
  options?: { fetcher?: ClientFetcher; errorMessage?: string },
): Promise<TItem> {
  const attempt = async () => {
    const controller = typeof input.timeoutMs === "number" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), input.timeoutMs) : null;
    try {
      const { response, body } = await fetchClientJsonResponse<QueueEnqueueResponse<TItem>>(
        "/api/queue/enqueue",
        {
          ...buildJsonPostInit({
            trackId: input.trackId,
            queueMode: input.queueMode ?? "normal",
            ...(typeof input.matchId === "number" ? { matchId: input.matchId } : {}),
          }),
          ...(controller ? { signal: controller.signal } : {}),
        },
        options,
      );
      if (body?.reason === QUEUE_ENQUEUE_REASON_NO_MATCH) {
        throw new Error(QUEUE_ERROR_NO_MATCH);
      }
      if (body?.reason === QUEUE_ENQUEUE_REASON_YOUTUBE_QUOTA_EXCEEDED) {
        throw new Error(QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED);
      }
      if (!response.ok || !body?.ok || !body.item) {
        throw new Error(body?.error || options?.errorMessage || TRACK_QUEUE_ERROR_NOTICE);
      }
      return body.item;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(QUEUE_ERROR_TIMEOUT);
      }
      throw error;
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  };

  for (let attemptIndex = 0; ; attemptIndex += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === QUEUE_ERROR_TIMEOUT &&
        attemptIndex < (input.retryTimeoutCount ?? 0)
      ) {
        continue;
      }
      throw error;
    }
  }
}
