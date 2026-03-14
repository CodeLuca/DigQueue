import { logFeedbackEvent } from "@/lib/recommendations";
import { shouldLogReleaseQueuedFeedback } from "@/lib/release-queue-feedback";
import { ensurePendingReleaseQueueItem } from "@/lib/track-youtube-matches";

type EnqueueReleasePendingInput = {
  userId: string;
  youtubeVideoId: string;
  releaseId: number;
  labelId: number | null;
  queueSource: string;
  feedbackSource: string;
  priority?: number;
  bumpedAt?: Date | null;
  addedAt?: Date;
};

export async function enqueuePendingReleaseForUser(input: EnqueueReleasePendingInput) {
  const insertedPending = await ensurePendingReleaseQueueItem({
    userId: input.userId,
    youtubeVideoId: input.youtubeVideoId,
    releaseId: input.releaseId,
    labelId: input.labelId,
    source: input.queueSource,
    priority: input.priority,
    bumpedAt: input.bumpedAt,
    addedAt: input.addedAt,
  });

  if (shouldLogReleaseQueuedFeedback(insertedPending.inserted)) {
    await logFeedbackEvent({
      eventType: "queued",
      source: input.feedbackSource,
      releaseId: input.releaseId,
      labelId: input.labelId,
      userId: input.userId,
    });
  }

  return insertedPending;
}
