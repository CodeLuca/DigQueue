export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { queueItems, releases, tracks } from "@/db/schema";
import { db } from "@/lib/db";
import { nextQueueItem } from "@/lib/processing";
import { logFeedbackEvent } from "@/lib/recommendations";

const postSchema = z.object({
  currentId: z.number().optional(),
  action: z.enum(["next", "played", "listened"]).optional(),
  mode: z.enum(["track", "release", "hybrid"]).optional(),
});

export async function GET(request: Request) {
  const currentIdRaw = new URL(request.url).searchParams.get("currentId");
  const modeRaw = new URL(request.url).searchParams.get("mode");
  const currentId = currentIdRaw ? Number(currentIdRaw) : undefined;
  const mode = modeRaw === "release" || modeRaw === "track" ? modeRaw : "hybrid";
  const item = await nextQueueItem(currentId, mode);
  return NextResponse.json(item || null);
}

export async function POST(request: Request) {
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.currentId && parsed.data.action === "played") {
    const item = await db.query.queueItems.findFirst({ where: eq(queueItems.id, parsed.data.currentId) });
    await db.update(queueItems).set({ status: "played" }).where(eq(queueItems.id, parsed.data.currentId));
    await logFeedbackEvent({
      eventType: "played",
      source: "api_queue_next",
      trackId: item?.trackId ?? null,
      releaseId: item?.releaseId ?? null,
      labelId: item?.labelId ?? null,
    });
  }

  if (parsed.data.currentId && parsed.data.action === "listened") {
    const item = await db.query.queueItems.findFirst({ where: eq(queueItems.id, parsed.data.currentId) });
    if (item?.trackId) {
      await db.update(tracks).set({ listened: true }).where(eq(tracks.id, item.trackId));
      await db
        .update(queueItems)
        .set({ status: "played" })
        .where(and(eq(queueItems.trackId, item.trackId), eq(queueItems.status, "pending")));
      await logFeedbackEvent({
        eventType: "listened",
        source: "api_queue_next",
        trackId: item.trackId,
        releaseId: item.releaseId ?? null,
        labelId: item.labelId ?? null,
      });

      if (item.releaseId) {
        const releaseTracks = await db.query.tracks.findMany({ where: eq(tracks.releaseId, item.releaseId) });
        const listened = releaseTracks.length > 0 && releaseTracks.every((track) => track.listened);
        await db.update(releases).set({ listened }).where(eq(releases.id, item.releaseId));
      }
    }
    await db.update(queueItems).set({ status: "played" }).where(eq(queueItems.id, parsed.data.currentId));
  }

  const next = await nextQueueItem(undefined, parsed.data.mode ?? "hybrid");
  return NextResponse.json(next || null);
}
