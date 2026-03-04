import {
  QUEUE_ERROR_NO_MATCH,
  QUEUE_ERROR_TIMEOUT,
  QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED,
} from "@/lib/queue-errors";

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
  timeoutMs?: number;
  retryTimeoutCount?: number;
};

export async function enqueueTrackForClient<TItem>({
  trackId,
  queueMode = "normal",
  matchId,
  timeoutMs,
  retryTimeoutCount = 0,
}: EnqueueTrackInput): Promise<TItem> {
  const attempt = async () => {
    const controller = typeof timeoutMs === "number" ? new AbortController() : null;
    const timeoutId = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetch("/api/queue/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, queueMode, ...(typeof matchId === "number" ? { matchId } : {}) }),
        ...(controller ? { signal: controller.signal } : {}),
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
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(QUEUE_ERROR_TIMEOUT);
      }
      throw error;
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    }
  };

  for (let attemptIndex = 0; ; attemptIndex += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (error instanceof Error && error.message === QUEUE_ERROR_TIMEOUT && attemptIndex < retryTimeoutCount) {
        continue;
      }
      throw error;
    }
  }
}
