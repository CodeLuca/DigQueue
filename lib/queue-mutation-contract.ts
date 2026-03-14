export type QueueScopeMutationResponse = {
  removed: number;
  added: number;
  skipped: number;
};

export type QueueDedupeMutationResponse = {
  removed: number;
};

export type QueueItemRemovalResponse = {
  queueItemId: number;
  removed: boolean;
};

export function buildQueueScopeMutationResponse(input: {
  removed: number;
  added?: number;
  skipped?: number;
}): QueueScopeMutationResponse {
  return {
    removed: input.removed,
    added: input.added ?? 0,
    skipped: input.skipped ?? 0,
  };
}

export function normalizeQueueScopeMutationResponse(
  body: Partial<{
    removed: number;
    added: number;
    skipped: number;
  }>,
): QueueScopeMutationResponse {
  return {
    removed: typeof body.removed === "number" ? body.removed : 0,
    added: typeof body.added === "number" ? body.added : 0,
    skipped: typeof body.skipped === "number" ? body.skipped : 0,
  };
}

export function buildQueueDedupeMutationResponse(input: {
  removed: number;
}): QueueDedupeMutationResponse {
  return {
    removed: input.removed,
  };
}

export function normalizeQueueDedupeMutationResponse(
  body: Partial<{
    removed: number;
  }>,
): QueueDedupeMutationResponse {
  return {
    removed: typeof body.removed === "number" ? body.removed : 0,
  };
}

export function buildQueueItemRemovalResponse(input: {
  queueItemId: number;
  removed: boolean;
}): QueueItemRemovalResponse {
  return {
    queueItemId: input.queueItemId,
    removed: input.removed,
  };
}

export function normalizeQueueItemRemovalResponse(
  body: Partial<{
    queueItemId: number;
    removed: boolean;
  }>,
  fallbackQueueItemId: number,
): QueueItemRemovalResponse {
  return {
    queueItemId:
      typeof body.queueItemId === "number" ? body.queueItemId : fallbackQueueItemId,
    removed: body.removed === true,
  };
}
