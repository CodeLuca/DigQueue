export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { queueItems, releases, tracks } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { nextQueueItem, nextQueueItemShuffled } from "@/lib/processing";
import { logFeedbackEvent } from "@/lib/recommendations";

const postSchema = z.object({
  currentId: z.number().optional(),
  action: z.enum(["next", "played", "listened"]).optional(),
  mode: z.enum(["track", "release", "hybrid"]).optional(),
  order: z.enum(["in_order", "shuffle"]).optional(),
});

export async function GET(request: Request) {
  const userId = await requireCurrentAppUserId();
  const currentIdRaw = new URL(request.url).searchParams.get("currentId");
  const modeRaw = new URL(request.url).searchParams.get("mode");
  const orderRaw = new URL(request.url).searchParams.get("order");
  const currentId = currentIdRaw ? Number(currentIdRaw) : undefined;
  const mode = modeRaw === "release" || modeRaw === "track" ? modeRaw : "hybrid";
  const order = orderRaw === "shuffle" ? "shuffle" : "in_order";
  const item = order === "shuffle"
    ? await nextQueueItemShuffled(userId, currentId, mode)
    : await nextQueueItem(userId, currentId, mode);
  return NextResponse.json(item || null);
}

export async function POST(request: Request) {
  const userId = await requireCurrentAppUserId();
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.currentId && parsed.data.action === "played") {
    const item = await db.query.queueItems.findFirst({ where: and(eq(queueItems.id, parsed.data.currentId), eq(queueItems.userId, userId)) });
    await db.update(queueItems).set({ status: "played" }).where(and(eq(queueItems.id, parsed.data.currentId), eq(queueItems.userId, userId)));
    await logFeedbackEvent({
      eventType: "played",
      source: "api_queue_next",
      trackId: item?.trackId ?? null,
      releaseId: item?.releaseId ?? null,
      labelId: item?.labelId ?? null,
      userId,
    });
  }

  if (parsed.data.currentId && parsed.data.action === "listened") {
    const item = await db.query.queueItems.findFirst({ where: and(eq(queueItems.id, parsed.data.currentId), eq(queueItems.userId, userId)) });
    if (item?.trackId) {
      await db.update(tracks).set({ listened: true }).where(and(eq(tracks.id, item.trackId), eq(tracks.userId, userId)));
      await db
        .update(queueItems)
        .set({ status: "played" })
        .where(and(eq(queueItems.trackId, item.trackId), eq(queueItems.status, "pending"), eq(queueItems.userId, userId)));
      await logFeedbackEvent({
        eventType: "listened",
        source: "api_queue_next",
        trackId: item.trackId,
        releaseId: item.releaseId ?? null,
        labelId: item.labelId ?? null,
        userId,
      });

      if (item.releaseId) {
        const releaseTracks = await db.query.tracks.findMany({ where: and(eq(tracks.releaseId, item.releaseId), eq(tracks.userId, userId)) });
        const listened = releaseTracks.length > 0 && releaseTracks.every((track) => track.listened);
        await db.update(releases).set({ listened }).where(and(eq(releases.id, item.releaseId), eq(releases.userId, userId)));
      }
    }
    await db.update(queueItems).set({ status: "played" }).where(and(eq(queueItems.id, parsed.data.currentId), eq(queueItems.userId, userId)));
  }

  const next = parsed.data.order === "shuffle"
    ? await nextQueueItemShuffled(userId, undefined, parsed.data.mode ?? "hybrid")
    : await nextQueueItem(userId, undefined, parsed.data.mode ?? "hybrid");
  return NextResponse.json(next || null);
}
