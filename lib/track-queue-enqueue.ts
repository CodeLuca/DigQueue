import { logFeedbackEvent } from "@/lib/recommendations";
import { ensurePendingTrackQueueItem } from "@/lib/track-youtube-matches";

type EnqueueTrackPendingInput = {
  userId: string;
  youtubeVideoId: string;
  trackId: number;
  releaseId: number | null;
  labelId: number | null;
  queueSource: string;
  feedbackSource: string;
  priority?: number;
  bumpedAt?: Date | null;
  addedAt?: Date;
};

export async function enqueuePendingTrackForUser(input: EnqueueTrackPendingInput) {
  const insertedPending = await ensurePendingTrackQueueItem({
    userId: input.userId,
    youtubeVideoId: input.youtubeVideoId,
    trackId: input.trackId,
    releaseId: input.releaseId,
    labelId: input.labelId,
    source: input.queueSource,
    priority: input.priority,
    bumpedAt: input.bumpedAt,
    addedAt: input.addedAt,
  });

  if (insertedPending.inserted) {
    await logFeedbackEvent({
      eventType: "queued",
      source: input.feedbackSource,
      trackId: input.trackId,
      releaseId: input.releaseId,
      labelId: input.labelId,
      userId: input.userId,
    });
  }

  return insertedPending;
}
