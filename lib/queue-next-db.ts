import { and, eq } from "drizzle-orm";
import { queueItems, tracks } from "@/db/schema";
import { db } from "@/lib/db";
import { refreshReleaseListenedForUser } from "@/lib/release-listened-state";

export async function findQueueItemForUser(userId: string, queueItemId: number) {
  return db.query.queueItems.findFirst({
    where: and(eq(queueItems.id, queueItemId), eq(queueItems.userId, userId)),
  });
}

export async function findQueueTrackForUser(userId: string, trackId: number) {
  return db.query.tracks.findFirst({
    where: and(eq(tracks.id, trackId), eq(tracks.userId, userId)),
    columns: { id: true, releaseId: true, listened: true, saved: true },
  });
}

export async function markQueueItemPlayed(userId: string, queueItemId: number) {
  await db.update(queueItems).set({ status: "played" }).where(and(eq(queueItems.id, queueItemId), eq(queueItems.userId, userId)));
}

export async function markPendingTrackQueueItemsPlayed(userId: string, trackId: number) {
  await db
    .update(queueItems)
    .set({ status: "played" })
    .where(and(eq(queueItems.trackId, trackId), eq(queueItems.status, "pending"), eq(queueItems.userId, userId)));
}

export async function markTrackListenedForUser(userId: string, trackId: number) {
  await db.update(tracks).set({ listened: true }).where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));
}

export async function refreshReleaseListenedFromTracks(userId: string, releaseId: number) {
  await refreshReleaseListenedForUser(userId, [releaseId]);
}
