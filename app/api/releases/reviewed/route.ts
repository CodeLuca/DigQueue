export const dynamic = "force-dynamic";

import { and, eq, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { queueItems, releases, tracks } from "@/db/schema";
import { guardMutationRateLimit } from "@/lib/api-guard";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { logFeedbackEvent } from "@/lib/recommendations";

const schema = z.object({
  releaseId: z.number().int().positive(),
});
const MAX_TRACK_FEEDBACK_EVENTS = 120;

export async function POST(request: Request) {
  const userId = await requireCurrentAppUserId();
  const rateLimited = await guardMutationRateLimit(userId, {
    bucket: "releases/reviewed",
    limit: 45,
    windowSeconds: 60,
  });
  if (rateLimited) return rateLimited;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const releaseId = parsed.data.releaseId;
  const releaseTracks = await db.query.tracks.findMany({
    where: and(eq(tracks.releaseId, releaseId), eq(tracks.userId, userId)),
    columns: { id: true, releaseId: true, listened: true, saved: true },
  });
  if (releaseTracks.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, tracks: [] });
  }

  const trackIds = releaseTracks.map((track) => track.id);
  const newlyListened = releaseTracks.filter((track) => !track.listened);

  await db
    .update(tracks)
    .set({ listened: true })
    .where(and(inArray(tracks.id, trackIds), eq(tracks.userId, userId)));

  await db
    .update(queueItems)
    .set({ status: "played" })
    .where(
      and(
        eq(queueItems.status, "pending"),
        eq(queueItems.userId, userId),
        or(
          eq(queueItems.releaseId, releaseId),
          inArray(queueItems.trackId, trackIds),
        ),
      ),
    );

  await db
    .update(releases)
    .set({ listened: true })
    .where(and(eq(releases.id, releaseId), eq(releases.userId, userId)));

  await Promise.allSettled(
    newlyListened.slice(0, MAX_TRACK_FEEDBACK_EVENTS).map((track) =>
      logFeedbackEvent({
        eventType: "listened",
        source: "api_release_reviewed",
        trackId: track.id,
        releaseId: track.releaseId,
        userId,
      }),
    ),
  );

  return NextResponse.json({
    ok: true,
    updated: trackIds.length,
    tracks: releaseTracks.map((track) => ({
      trackId: track.id,
      listened: true,
      saved: track.saved,
    })),
  });
}
