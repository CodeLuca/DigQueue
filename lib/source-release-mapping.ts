import { and, eq, sql } from "drizzle-orm";
import { sourceReleases } from "@/db/schema";
import { db } from "@/lib/db";

export function mergeSourceReleaseMappingState(input: {
  existingReleaseOrder: number;
  existingDiscoveredAt: Date;
  nextReleaseOrder: number;
  nextDiscoveredAt: Date;
}) {
  return {
    releaseOrder: Math.min(input.existingReleaseOrder, input.nextReleaseOrder),
    discoveredAt:
      input.existingDiscoveredAt.getTime() >= input.nextDiscoveredAt.getTime()
        ? input.existingDiscoveredAt
        : input.nextDiscoveredAt,
  };
}

export async function upsertSourceReleaseMapping(input: {
  sourceId: number;
  releaseId: number;
  userId: string;
  releaseOrder: number;
  discoveredAt: Date;
}) {
  await db
    .insert(sourceReleases)
    .values({
      sourceId: input.sourceId,
      releaseId: input.releaseId,
      userId: input.userId,
      releaseOrder: input.releaseOrder,
      discoveredAt: input.discoveredAt,
    })
    .onConflictDoUpdate({
      target: [sourceReleases.sourceId, sourceReleases.releaseId],
      set: {
        userId: input.userId,
        releaseOrder: sql`least(${sourceReleases.releaseOrder}, ${input.releaseOrder})`,
        discoveredAt: sql`greatest(${sourceReleases.discoveredAt}, ${input.discoveredAt})`,
      },
    });
}

export async function listSourceReleaseFallbackMappings(userId: string, releaseId: number) {
  return db.query.sourceReleases.findMany({
    where: and(eq(sourceReleases.releaseId, releaseId), eq(sourceReleases.userId, userId)),
    orderBy: [sql`${sourceReleases.discoveredAt} desc`, sql`${sourceReleases.releaseOrder} asc`],
    limit: 8,
  });
}
