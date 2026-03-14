"use client";

import { QUEUE_STATE_MUTATED_EVENT, QUEUE_TRACK_ENQUEUED_EVENT } from "@/lib/client-events";
import { dispatchClientEvent, readClientEventDetail, subscribeClientEvent } from "@/lib/client-event-bus";

export type QueueTrackEnqueuedDetail = {
  trackId: number;
  queueItemId?: number | null;
  youtubeVideoId?: string | null;
  playNow: boolean;
  queueMode: "normal" | "next";
};

export type QueueStateMutationDetail = {
  reason: "enqueue" | "remove" | "advance" | "scope_sync";
  trackId?: number | null;
  queueItemId?: number | null;
  currentId?: number | null;
  added?: number | null;
  removed?: number | null;
  skipped?: number | null;
};

export function dispatchQueueStateMutatedEvent(detail: QueueStateMutationDetail) {
  dispatchClientEvent(QUEUE_STATE_MUTATED_EVENT, detail);
}

export function dispatchQueueTrackEnqueuedEvent(detail: QueueTrackEnqueuedDetail) {
  dispatchClientEvent(QUEUE_TRACK_ENQUEUED_EVENT, detail);
  dispatchQueueStateMutatedEvent({
    reason: "enqueue",
    trackId: detail.trackId,
    queueItemId: detail.queueItemId ?? null,
  });
}

export function getQueueTrackEnqueuedDetail(event: Event): QueueTrackEnqueuedDetail | null {
  const detail = readClientEventDetail<Partial<QueueTrackEnqueuedDetail>>(event);
  if (
    !detail ||
    typeof detail.trackId !== "number" ||
    typeof detail.playNow !== "boolean" ||
    (detail.queueMode !== "normal" && detail.queueMode !== "next")
  ) {
    return null;
  }
  return {
    trackId: detail.trackId,
    queueItemId: typeof detail.queueItemId === "number" ? detail.queueItemId : null,
    youtubeVideoId: typeof detail.youtubeVideoId === "string" && detail.youtubeVideoId ? detail.youtubeVideoId : null,
    playNow: detail.playNow,
    queueMode: detail.queueMode,
  };
}

export function getQueueStateMutationDetail(event: Event): QueueStateMutationDetail | null {
  const detail = readClientEventDetail<Partial<QueueStateMutationDetail>>(event);
  if (
    !detail ||
    (detail.reason !== "enqueue" && detail.reason !== "remove" && detail.reason !== "advance" && detail.reason !== "scope_sync")
  ) {
    return null;
  }
  return {
    reason: detail.reason,
    trackId: typeof detail.trackId === "number" ? detail.trackId : null,
    queueItemId: typeof detail.queueItemId === "number" ? detail.queueItemId : null,
    currentId: typeof detail.currentId === "number" ? detail.currentId : null,
    added: typeof detail.added === "number" ? detail.added : null,
    removed: typeof detail.removed === "number" ? detail.removed : null,
    skipped: typeof detail.skipped === "number" ? detail.skipped : null,
  };
}

export function subscribeQueueTrackEnqueued(handler: (detail: QueueTrackEnqueuedDetail) => void) {
  return subscribeClientEvent(QUEUE_TRACK_ENQUEUED_EVENT, handler, { parse: getQueueTrackEnqueuedDetail });
}

export function subscribeQueueStateMutated(handler: (detail: QueueStateMutationDetail) => void) {
  return subscribeClientEvent(QUEUE_STATE_MUTATED_EVENT, handler, { parse: getQueueStateMutationDetail });
}

export function subscribeQueueActivity(handler: () => void) {
  const unsubscribeEnqueued = subscribeQueueTrackEnqueued(() => handler());
  const unsubscribeMutated = subscribeQueueStateMutated(() => handler());
  return () => {
    unsubscribeEnqueued();
    unsubscribeMutated();
  };
}
