import {
  buildQueueFeedbackPayloadFromItem,
  parseQueueNextMutationInput,
} from "@/lib/queue-next-mutation";
import {
  findQueueItemForUser,
  findQueueTrackForUser,
  markQueueItemPlayed,
} from "@/lib/queue-next-db";
import { buildQueueNextEffectPlan } from "@/lib/queue-next-effects";
import { selectNextQueueItem } from "@/lib/queue-next-selection";
import { nextQueueItem, nextQueueItemShuffled } from "@/lib/processing";
import { applyTrackListenedMutationsForUser } from "@/lib/release-listened-state";
import { logFeedbackEvent } from "@/lib/recommendations";
import { planTrackTodoMutation } from "@/lib/track-todo-mutations";
import type { QueueMode, QueueOrder } from "@/lib/queue-next-request";

export async function resolveNextQueueItemForUser(input: {
  userId: string;
  currentId?: number;
  mode: QueueMode;
  order: QueueOrder;
}) {
  return selectNextQueueItem({
    userId: input.userId,
    currentId: input.currentId,
    mode: input.mode,
    order: input.order,
    fetchInOrder: (uid, cid, queueMode) => nextQueueItem(uid, cid, queueMode, false),
    fetchShuffled: (uid, cid, queueMode) => nextQueueItemShuffled(uid, cid, queueMode, false),
  });
}

export async function advanceQueueForUser(input: {
  userId: string;
  currentId?: number;
  action?: "next" | "played" | "listened";
  mode?: QueueMode;
  order?: QueueOrder;
}) {
  const mutation = parseQueueNextMutationInput(input);
  const currentId = mutation.currentId;
  const item = currentId ? await findQueueItemForUser(input.userId, currentId) : null;
  const track = item?.trackId ? await findQueueTrackForUser(input.userId, item.trackId) : null;
  const effectPlan = buildQueueNextEffectPlan({
    currentId,
    transitionPlan: mutation.transitionPlan,
    item,
    track,
  });

  if (effectPlan.markQueueItemPlayed && !effectPlan.markTrackListened && currentId) {
    await markQueueItemPlayed(input.userId, currentId);
    const feedbackPayload = effectPlan.shouldLogFeedback
      ? buildQueueFeedbackPayloadFromItem({
          eventType: effectPlan.feedbackEventType,
          queueItem: item,
          userId: input.userId,
        })
      : null;
    if (feedbackPayload) void logFeedbackEvent(feedbackPayload).catch(() => null);
  }

  if (currentId && effectPlan.markQueueItemPlayed && effectPlan.markTrackListened) {
    if (track) {
      await applyTrackListenedMutationsForUser({
        userId: input.userId,
        source: "api_queue_next",
        mutations: [planTrackTodoMutation(track, "listened", "set", true)],
      });
    }
    await markQueueItemPlayed(input.userId, currentId);
  }

  return resolveNextQueueItemForUser({
    userId: input.userId,
    mode: mutation.mode,
    order: mutation.order,
  });
}
