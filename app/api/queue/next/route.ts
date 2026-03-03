export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { queueItems, releases, tracks } from "@/db/schema";
import { guardMutationRateLimit } from "@/lib/api-guard";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { readJsonBodyOrNull } from "@/lib/request-json";
import {
  normalizeCurrentQueueItemIdFromPost,
  resolveQueueModeFromPost,
  resolveQueueOrderFromPost,
} from "@/lib/queue-next-actions";
import { getQueueTransitionPlan } from "@/lib/queue-transition-plan";
import { deriveReleaseListenedFromTracks } from "@/lib/release-listened";
import { nextQueueItem, nextQueueItemShuffled } from "@/lib/processing";
import { parseQueueNextGetParams } from "@/lib/queue-next-request";
import { logFeedbackEvent } from "@/lib/recommendations";

const postSchema = z.object({
  currentId: z.number().optional(),
  action: z.enum(["next", "played", "listened"]).optional(),
  mode: z.enum(["track", "release", "hybrid"]).optional(),
  order: z.enum(["in_order", "shuffle"]).optional(),
});

export async function GET(request: Request) {
  const userId = await requireCurrentAppUserId();
  const { currentId, mode, order } = parseQueueNextGetParams(new URL(request.url));
  const item = order === "shuffle"
    ? await nextQueueItemShuffled(userId, currentId, mode)
    : await nextQueueItem(userId, currentId, mode);
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

  const parsed = postSchema.safeParse(await readJsonBodyOrNull(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const currentId = normalizeCurrentQueueItemIdFromPost(parsed.data.currentId);
  const transitionPlan = getQueueTransitionPlan(parsed.data.action);
  if (currentId && transitionPlan.markQueueItemPlayed && !transitionPlan.markTrackListened) {
    const item = await db.query.queueItems.findFirst({ where: and(eq(queueItems.id, currentId), eq(queueItems.userId, userId)) });
    await db.update(queueItems).set({ status: "played" }).where(and(eq(queueItems.id, currentId), eq(queueItems.userId, userId)));
    if (transitionPlan.feedbackEventType) {
      await logFeedbackEvent({
        eventType: transitionPlan.feedbackEventType,
        source: "api_queue_next",
        trackId: item?.trackId ?? null,
        releaseId: item?.releaseId ?? null,
        labelId: item?.labelId ?? null,
        userId,
      });
    }
  }

  if (currentId && transitionPlan.markTrackListened) {
    const item = await db.query.queueItems.findFirst({ where: and(eq(queueItems.id, currentId), eq(queueItems.userId, userId)) });
    if (item?.trackId) {
      await db.update(tracks).set({ listened: true }).where(and(eq(tracks.id, item.trackId), eq(tracks.userId, userId)));
      await db
        .update(queueItems)
        .set({ status: "played" })
        .where(and(eq(queueItems.trackId, item.trackId), eq(queueItems.status, "pending"), eq(queueItems.userId, userId)));
      if (transitionPlan.feedbackEventType) {
        await logFeedbackEvent({
          eventType: transitionPlan.feedbackEventType,
          source: "api_queue_next",
          trackId: item.trackId,
          releaseId: item.releaseId ?? null,
          labelId: item.labelId ?? null,
          userId,
        });
      }

      if (item.releaseId) {
        const releaseTracks = await db.query.tracks.findMany({ where: and(eq(tracks.releaseId, item.releaseId), eq(tracks.userId, userId)) });
        const listened = deriveReleaseListenedFromTracks(releaseTracks);
        await db.update(releases).set({ listened }).where(and(eq(releases.id, item.releaseId), eq(releases.userId, userId)));
      }
    }
    await db.update(queueItems).set({ status: "played" }).where(and(eq(queueItems.id, currentId), eq(queueItems.userId, userId)));
  }

  const mode = resolveQueueModeFromPost(parsed.data.mode);
  const order = resolveQueueOrderFromPost(parsed.data.order);
  const next = order === "shuffle"
    ? await nextQueueItemShuffled(userId, undefined, mode)
    : await nextQueueItem(userId, undefined, mode);
  return NextResponse.json(next || null);
}
