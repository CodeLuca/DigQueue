import { and, eq, inArray } from "drizzle-orm";
import { queueItems } from "@/db/schema";
import { db } from "@/lib/db";

type PendingQueueRow = {
  id: number;
  trackId: number | null;
  youtubeVideoId: string;
  priority: number;
  bumpedAt: Date | null;
  addedAt: Date;
};

function compareRows(a: PendingQueueRow, b: PendingQueueRow) {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const aBumped = a.bumpedAt?.getTime() ?? 0;
  const bBumped = b.bumpedAt?.getTime() ?? 0;
  if (aBumped !== bBumped) return bBumped - aBumped;
  const aAdded = a.addedAt?.getTime() ?? 0;
  const bAdded = b.addedAt?.getTime() ?? 0;
  if (aAdded !== bAdded) return bAdded - aAdded;
  return b.id - a.id;
}

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
      youtubeVideoId: queueItems.youtubeVideoId,
      priority: queueItems.priority,
      bumpedAt: queueItems.bumpedAt,
      addedAt: queueItems.addedAt,
    })
    .from(queueItems)
    .where(whereClause);

  const byKey = new Map<string, PendingQueueRow[]>();
  for (const row of rows) {
    if (typeof row.trackId !== "number") continue;
    const key = `${row.trackId}::${row.youtubeVideoId}`;
    const group = byKey.get(key) ?? [];
    group.push(row);
    byKey.set(key, group);
  }

  const deleteIds: number[] = [];
  let duplicateGroups = 0;

  for (const group of byKey.values()) {
    if (group.length <= 1) continue;
    duplicateGroups += 1;
    group.sort(compareRows);
    for (const extra of group.slice(1)) {
      deleteIds.push(extra.id);
    }
  }

  if (deleteIds.length > 0) {
    await db
      .delete(queueItems)
      .where(and(eq(queueItems.userId, userId), inArray(queueItems.id, deleteIds)));
  }

  return {
    removed: deleteIds.length,
    duplicateGroups,
    scannedRows: rows.length,
  };
}

