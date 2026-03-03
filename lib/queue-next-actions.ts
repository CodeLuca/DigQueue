export type QueueAdvanceAction = "next" | "played" | "listened" | undefined;
export type QueueMode = "track" | "release" | "hybrid";
export type QueueOrder = "in_order" | "shuffle";

export function shouldMarkCurrentQueueItemPlayed(action: QueueAdvanceAction) {
  return action === "played" || action === "listened";
}

export function shouldMarkCurrentTrackListened(action: QueueAdvanceAction) {
  return action === "listened";
}

export function resolveQueueModeFromPost(mode: QueueMode | undefined): QueueMode {
  return mode ?? "hybrid";
}

export function resolveQueueOrderFromPost(order: QueueOrder | undefined): QueueOrder {
  return order === "shuffle" ? "shuffle" : "in_order";
}
