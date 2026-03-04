import { and, eq } from "drizzle-orm";
import { queueItems } from "@/db/schema";
import { db } from "@/lib/db";

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
