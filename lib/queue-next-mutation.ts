import {
  normalizeCurrentQueueItemIdFromPost,
  resolveQueueModeFromPost,
  resolveQueueOrderFromPost,
  type QueueMode,
  type QueueOrder,
} from "@/lib/queue-next-actions";
import { getQueueTransitionPlan } from "@/lib/queue-transition-plan";

type QueueAction = "next" | "played" | "listened" | undefined;

export function parseQueueNextMutationInput(input: {
  currentId?: number;
  action?: QueueAction;
  mode?: QueueMode;
  order?: QueueOrder;
}) {
  return {
    currentId: normalizeCurrentQueueItemIdFromPost(input.currentId),
    transitionPlan: getQueueTransitionPlan(input.action),
    mode: resolveQueueModeFromPost(input.mode),
    order: resolveQueueOrderFromPost(input.order),
  };
}

export function shouldApplyPlayedOnlyMutation(input: {
  currentId: number | undefined;
  transitionPlan: { markQueueItemPlayed: boolean; markTrackListened: boolean };
}) {
  return Boolean(input.currentId && input.transitionPlan.markQueueItemPlayed && !input.transitionPlan.markTrackListened);
}

export function shouldApplyListenedMutation(input: {
  currentId: number | undefined;
  transitionPlan: { markTrackListened: boolean };
}) {
  return Boolean(input.currentId && input.transitionPlan.markTrackListened);
}

export function shouldRefreshReleaseListened(releaseId: number | null | undefined): releaseId is number {
  return typeof releaseId === "number" && releaseId > 0;
}

export function buildQueueFeedbackPayload(
  eventType: "played" | "listened" | null,
  item: { trackId?: number | null; releaseId?: number | null; labelId?: number | null } | null | undefined,
  userId: string,
) {
  if (!eventType) return null;
  return {
    eventType,
    source: "api_queue_next" as const,
    trackId: item?.trackId ?? null,
    releaseId: item?.releaseId ?? null,
    labelId: item?.labelId ?? null,
    userId,
  };
}

export function buildQueueFeedbackPayloadFromItem(input: {
  eventType: "played" | "listened" | null;
  queueItem: { trackId?: number | null; releaseId?: number | null; labelId?: number | null } | null | undefined;
  userId: string;
}) {
  return buildQueueFeedbackPayload(input.eventType, input.queueItem, input.userId);
}
