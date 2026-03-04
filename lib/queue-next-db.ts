import { and, eq } from "drizzle-orm";
import { queueItems, releases, tracks } from "@/db/schema";
import { db } from "@/lib/db";
import { deriveReleaseListenedFromTracks } from "@/lib/release-listened";

export async function findQueueItemForUser(userId: string, queueItemId: number) {
  return db.query.queueItems.findFirst({
    where: and(eq(queueItems.id, queueItemId), eq(queueItems.userId, userId)),
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
  const releaseTracks = await db.query.tracks.findMany({
    where: and(eq(tracks.releaseId, releaseId), eq(tracks.userId, userId)),
  });
  const listened = deriveReleaseListenedFromTracks(releaseTracks);
  await db.update(releases).set({ listened }).where(and(eq(releases.id, releaseId), eq(releases.userId, userId)));
}
