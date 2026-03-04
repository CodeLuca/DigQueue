import { QUEUE_ERROR_NO_MATCH, QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED } from "@/lib/queue-errors";

type QueueApiResponse<TItem> = {
  ok?: boolean;
  item?: TItem | null;
  error?: string;
  reason?: string;
};

type EnqueueTrackInput = {
  trackId: number;
  queueMode?: "normal" | "next";
  matchId?: number;
};

export async function enqueueTrackForClient<TItem>({
  trackId,
  queueMode = "normal",
  matchId,
}: EnqueueTrackInput): Promise<TItem> {
  const response = await fetch("/api/queue/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackId, queueMode, ...(typeof matchId === "number" ? { matchId } : {}) }),
  });
  const body = (await response.json().catch(() => null)) as QueueApiResponse<TItem> | null;
  if (body?.reason === "no_match") {
    throw new Error(QUEUE_ERROR_NO_MATCH);
  }
  if (body?.reason === "youtube_quota_exceeded") {
    throw new Error(QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED);
  }
  if (!response.ok || !body?.ok || !body.item) {
    throw new Error(body?.error || "Unable to queue track.");
  }
  return body.item;
}
