export const dynamic = "force-dynamic";

import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { queueItems, releases, tracks } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { logFeedbackEvent } from "@/lib/recommendations";

const schema = z.object({
  trackIds: z.array(z.number().int().positive()).min(1).max(1500),
  field: z.enum(["listened", "saved", "wishlist"]),
  mode: z.enum(["set", "toggle"]).default("toggle"),
  value: z.boolean().optional(),
});

async function recomputeReleaseListened(releaseId: number, userId: string) {
  const releaseTracks = await db.query.tracks.findMany({ where: and(eq(tracks.releaseId, releaseId), eq(tracks.userId, userId)) });
  const listened = releaseTracks.length > 0 && releaseTracks.every((item) => item.listened);
  await db.update(releases).set({ listened }).where(and(eq(releases.id, releaseId), eq(releases.userId, userId)));
}

export async function POST(request: Request) {
  const userId = await requireCurrentAppUserId();
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedField = parsed.data.field === "wishlist" ? "saved" : parsed.data.field;
  const { trackIds, mode, value } = parsed.data;
  const uniqueTrackIds = [...new Set(trackIds)];
  const releaseIds = new Set<number>();
  const updatedTracks: Array<{ trackId: number; releaseId: number; listened: boolean; saved: boolean }> = [];

  if (mode === "set") {
    const rows = await db
      .select({ id: tracks.id, releaseId: tracks.releaseId, listened: tracks.listened, saved: tracks.saved })
      .from(tracks)
      .where(and(inArray(tracks.id, uniqueTrackIds), eq(tracks.userId, userId)));

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, tracks: [] });
    }

    const nextValue = Boolean(value);
    const matchedTrackIds = rows.map((row) => row.id);

    for (const track of rows) {
      releaseIds.add(track.releaseId);
      updatedTracks.push({
        trackId: track.id,
        releaseId: track.releaseId,
        listened: normalizedField === "listened" ? nextValue : track.listened,
        saved: normalizedField === "saved" ? nextValue : track.saved,
      });
    }

    if (normalizedField === "listened") {
      await db
        .update(tracks)
        .set({ listened: nextValue })
        .where(and(inArray(tracks.id, matchedTrackIds), eq(tracks.userId, userId)));

      if (nextValue) {
        await db
          .update(queueItems)
          .set({ status: "played" })
          .where(and(inArray(queueItems.trackId, matchedTrackIds), eq(queueItems.status, "pending"), eq(queueItems.userId, userId)));
      }
    } else {
      await db
        .update(tracks)
        .set({ saved: nextValue })
        .where(and(inArray(tracks.id, matchedTrackIds), eq(tracks.userId, userId)));
    }

    if (normalizedField === "listened") {
      for (const releaseId of releaseIds) {
        await recomputeReleaseListened(releaseId, userId);
      }
    }

    return NextResponse.json({ ok: true, updated: updatedTracks.length, tracks: updatedTracks });
  }

  for (const trackId of uniqueTrackIds) {
    const track = await db.query.tracks.findFirst({ where: and(eq(tracks.id, trackId), eq(tracks.userId, userId)) });
    if (!track) continue;

    releaseIds.add(track.releaseId);

    const nextValue = !(normalizedField === "saved" ? track.saved : track.listened);
    if (normalizedField === "listened") {
      await db.update(tracks).set({ listened: nextValue }).where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));
      if (nextValue) {
        await db
          .update(queueItems)
          .set({ status: "played" })
          .where(and(eq(queueItems.trackId, trackId), eq(queueItems.status, "pending"), eq(queueItems.userId, userId)));
        await logFeedbackEvent({
          eventType: "listened",
          source: "api_tracks_todo",
          trackId,
          releaseId: track.releaseId,
          userId,
        });
      }
    } else {
      await db
        .update(tracks)
        .set({ saved: nextValue })
        .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));
      await logFeedbackEvent({
        eventType: nextValue ? "saved_add" : "saved_remove",
        source: "api_tracks_todo",
        trackId,
        releaseId: track.releaseId,
        userId,
      });
    }

    updatedTracks.push({
      trackId,
      releaseId: track.releaseId,
      listened: normalizedField === "listened" ? nextValue : track.listened,
      saved: normalizedField === "saved" ? nextValue : track.saved,
    });
  }

  if (normalizedField === "listened") {
    for (const releaseId of releaseIds) {
      await recomputeReleaseListened(releaseId, userId);
    }
  }

  return NextResponse.json({ ok: true, updated: updatedTracks.length, tracks: updatedTracks });
}
