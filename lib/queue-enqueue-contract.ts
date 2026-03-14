export const QUEUE_ENQUEUE_REASON_NO_MATCH = "no_match";
export const QUEUE_ENQUEUE_REASON_YOUTUBE_QUOTA_EXCEEDED = "youtube_quota_exceeded";
export const QUEUE_ENQUEUE_REASON_YOUTUBE_ERROR = "youtube_error";

export type QueueEnqueueReason =
  | typeof QUEUE_ENQUEUE_REASON_NO_MATCH
  | typeof QUEUE_ENQUEUE_REASON_YOUTUBE_QUOTA_EXCEEDED
  | typeof QUEUE_ENQUEUE_REASON_YOUTUBE_ERROR;

export type QueueEnqueueResponse<TItem> = {
  ok?: boolean;
  item?: TItem | null;
  error?: string;
  reason?: QueueEnqueueReason;
  reused?: boolean;
  queuedNext?: boolean;
};
