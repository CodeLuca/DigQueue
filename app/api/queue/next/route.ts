export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { tracks } from "@/db/schema";
import { guardMutationRateLimit } from "@/lib/api-guard";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { readJsonBodyOrNull } from "@/lib/request-json";
import {
  buildQueueFeedbackPayload,
  parseQueueNextMutationInput,
  shouldApplyListenedMutation,
  shouldApplyPlayedOnlyMutation,
} from "@/lib/queue-next-mutation";
import {
  findQueueItemForUser,
  markPendingTrackQueueItemsPlayed,
  markQueueItemPlayed,
  refreshReleaseListenedFromTracks,
} from "@/lib/queue-next-db";
import { selectNextQueueItem } from "@/lib/queue-next-selection";
import { parseQueueNextPostBody } from "@/lib/queue-next-post";
import { nextQueueItem, nextQueueItemShuffled } from "@/lib/processing";
import { parseQueueNextGetParams } from "@/lib/queue-next-request";
import { logFeedbackEvent } from "@/lib/recommendations";

export async function GET(request: Request) {
  const userId = await requireCurrentAppUserId();
  const { currentId, mode, order } = parseQueueNextGetParams(new URL(request.url));
  const item = await selectNextQueueItem({
    userId,
    currentId,
    mode,
    order,
    fetchInOrder: nextQueueItem,
    fetchShuffled: nextQueueItemShuffled,
  });
  return NextResponse.json(item || null);
}

export async function POST(request: Request) {
  const userId = await requireCurrentAppUserId();
  const rateLimited = await guardMutationRateLimit(userId, {
    bucket: "queue/next",
    limit: 120,
    windowSeconds: 60,
  });
  if (rateLimited) return rateLimited;

  const parsed = parseQueueNextPostBody(await readJsonBodyOrNull(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const mutation = parseQueueNextMutationInput(parsed.data);
  if (shouldApplyPlayedOnlyMutation(mutation)) {
    const currentId = mutation.currentId as number;
    const item = await findQueueItemForUser(userId, currentId);
    await markQueueItemPlayed(userId, currentId);
    const feedbackPayload = buildQueueFeedbackPayload(mutation.transitionPlan.feedbackEventType, item, userId);
    if (feedbackPayload) await logFeedbackEvent(feedbackPayload);
  }

  if (shouldApplyListenedMutation(mutation)) {
    const currentId = mutation.currentId as number;
    const item = await findQueueItemForUser(userId, currentId);
    if (item?.trackId) {
      await db.update(tracks).set({ listened: true }).where(and(eq(tracks.id, item.trackId), eq(tracks.userId, userId)));
      await markPendingTrackQueueItemsPlayed(userId, item.trackId);
      const feedbackPayload = buildQueueFeedbackPayload(mutation.transitionPlan.feedbackEventType, item, userId);
      if (feedbackPayload) await logFeedbackEvent(feedbackPayload);

      if (item.releaseId) {
        await refreshReleaseListenedFromTracks(userId, item.releaseId);
      }
    }
    await markQueueItemPlayed(userId, currentId);
  }

  const next = await selectNextQueueItem({
    userId,
    currentId: undefined,
    mode: mutation.mode,
    order: mutation.order,
    fetchInOrder: nextQueueItem,
    fetchShuffled: nextQueueItemShuffled,
  });
  return NextResponse.json(next || null);
}
