import { and, eq, inArray } from "drizzle-orm";
import { queueItems } from "@/db/schema";
import { db } from "@/lib/db";
import { findPendingQueueDuplicateIds } from "@/lib/queue-duplicates";

export async function dedupePendingQueueItems(
  userId: string,
  options?: { trackId?: number },
) {
  const whereClause = options?.trackId
    ? and(
        eq(queueItems.userId, userId),
        eq(queueItems.status, "pending"),
        eq(queueItems.trackId, options.trackId),
      )
    : and(eq(queueItems.userId, userId), eq(queueItems.status, "pending"));

  const rows = await db
    .select({
      id: queueItems.id,
      trackId: queueItems.trackId,
      releaseId: queueItems.releaseId,
      youtubeVideoId: queueItems.youtubeVideoId,
      priority: queueItems.priority,
      bumpedAt: queueItems.bumpedAt,
      addedAt: queueItems.addedAt,
    })
    .from(queueItems)
    .where(whereClause);

  const { deleteIds, duplicateGroups, scannedRows } = findPendingQueueDuplicateIds(rows);

  if (deleteIds.length > 0) {
    await db
      .delete(queueItems)
      .where(and(eq(queueItems.userId, userId), inArray(queueItems.id, deleteIds)));
  }

  return {
    removed: deleteIds.length,
    duplicateGroups,
    scannedRows,
  };
}
