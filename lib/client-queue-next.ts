import type { ClientFetcher } from "@/lib/client-fetcher";
import { getClientQuery, postClientQuery } from "@/lib/client-queries";
import { dispatchQueueStateMutatedEvent } from "@/lib/client-queue-events";

export type QueueAdvanceAction = "played" | "listened";
export type QueueOrderMode = "in_order" | "shuffle";
export type QueueSelectionMode = "hybrid" | "track_only" | "release_only";

type QueueNextRequestOptions = {
  fetcher?: ClientFetcher;
};

export async function fetchNextQueueItemClient<TItem>(
  input: {
    mode: QueueSelectionMode;
    order: QueueOrderMode;
    currentId?: number | null;
  },
  options?: QueueNextRequestOptions,
) {
  const params = new URLSearchParams();
  params.set("mode", input.mode);
  params.set("order", input.order);
  if (typeof input.currentId === "number" && input.currentId > 0) {
    params.set("currentId", String(input.currentId));
  }
  return await getClientQuery<TItem | null>(`/api/queue/next?${params.toString()}`, options);
}

export async function advanceQueueClient<TItem>(
  input: {
    currentId: number;
    action: QueueAdvanceAction;
    mode: QueueSelectionMode;
    order: QueueOrderMode;
  },
  options?: QueueNextRequestOptions,
) {
  const item = await postClientQuery<TItem | null>("/api/queue/next", input, options);
  if (item === null) return null;
  dispatchQueueStateMutatedEvent({
    reason: "advance",
    currentId: input.currentId,
  });
  return item;
}
