import { and, eq } from "drizzle-orm";
import { queueItems } from "@/db/schema";
import { db } from "@/lib/db";

export async function markQueueItemPlayed(userId: string, queueItemId: number) {
  await db.update(queueItems).set({ status: "played" }).where(and(eq(queueItems.id, queueItemId), eq(queueItems.userId, userId)));
}
