export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { queueItems, releases, tracks } from "@/db/schema";
import { db } from "@/lib/db";
import { logFeedbackEvent } from "@/lib/recommendations";

const schema = z.object({
  trackIds: z.array(z.number().int().positive()).min(1),
  field: z.enum(["listened", "saved", "wishlist"]),
  mode: z.enum(["set", "toggle"]).default("toggle"),
  value: z.boolean().optional(),
});

async function recomputeReleaseListened(releaseId: number) {
  const releaseTracks = await db.query.tracks.findMany({ where: eq(tracks.releaseId, releaseId) });
  const listened = releaseTracks.length > 0 && releaseTracks.every((item) => item.listened);
  await db.update(releases).set({ listened }).where(eq(releases.id, releaseId));
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedField = parsed.data.field === "wishlist" ? "saved" : parsed.data.field;
  const { trackIds, mode, value } = parsed.data;
  const releaseIds = new Set<number>();
  const updatedTracks: Array<{ trackId: number; releaseId: number; listened: boolean; saved: boolean }> = [];

  for (const trackId of trackIds) {
    const track = await db.query.tracks.findFirst({ where: eq(tracks.id, trackId) });
    if (!track) continue;

    releaseIds.add(track.releaseId);

    const nextValue = mode === "set" ? Boolean(value) : !(normalizedField === "saved" ? track.saved : track.listened);
    if (normalizedField === "listened") {
      await db.update(tracks).set({ listened: nextValue }).where(eq(tracks.id, trackId));
      if (nextValue) {
        await db
          .update(queueItems)
          .set({ status: "played" })
          .where(and(eq(queueItems.trackId, trackId), eq(queueItems.status, "pending")));
        await logFeedbackEvent({
          eventType: "listened",
          source: "api_tracks_todo",
          trackId,
          releaseId: track.releaseId,
        });
      }
    } else {
      await db
        .update(tracks)
        .set({ saved: nextValue })
        .where(eq(tracks.id, trackId));
      await logFeedbackEvent({
        eventType: nextValue ? "saved_add" : "saved_remove",
        source: "api_tracks_todo",
        trackId,
        releaseId: track.releaseId,
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
      await recomputeReleaseListened(releaseId);
    }
  }

  return NextResponse.json({ ok: true, updated: updatedTracks.length, tracks: updatedTracks });
}
