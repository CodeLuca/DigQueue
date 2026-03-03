import type { QueueMode, QueueOrder } from "@/lib/queue-next-actions";

type NextQueueFetcher<T> = (userId: string, currentId: number | undefined, mode: QueueMode) => Promise<T>;

export function isShuffleQueueOrder(order: QueueOrder) {
  return order === "shuffle";
}

export async function selectNextQueueItem<T>(input: {
  userId: string;
  currentId?: number;
  mode: QueueMode;
  order: QueueOrder;
  fetchInOrder: NextQueueFetcher<T>;
  fetchShuffled: NextQueueFetcher<T>;
}) {
  if (isShuffleQueueOrder(input.order)) {
    return input.fetchShuffled(input.userId, input.currentId, input.mode);
  }
  return input.fetchInOrder(input.userId, input.currentId, input.mode);
}
