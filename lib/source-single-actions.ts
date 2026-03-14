import { and, eq, inArray, or } from "drizzle-orm";
import { labels, queueItems, releases } from "@/db/schema";
import { db } from "@/lib/db";
import { refreshSourceMetadata } from "@/lib/label-metadata";
import { processSingleReleaseForSource } from "@/lib/processing";
import { toSourceKind } from "@/lib/source-kind";
import { runSourceProcessingAttemptForUser } from "@/lib/source-processing-run";
import { listSourceReleaseFallbackMappings } from "@/lib/source-release-mapping";

export async function findOwnedSourceForUser(
  userId: string,
  sourceId: number,
  columns?: Record<string, true>,
) {
  return db.query.labels.findFirst({
    where: and(eq(labels.id, sourceId), eq(labels.userId, userId)),
    columns,
  });
}

export async function retrySourceForUser(userId: string, sourceId: number) {
  const source = await findOwnedSourceForUser(userId, sourceId, { id: true });
  if (!source) {
    return { found: false as const };
  }

  await db
    .update(labels)
    .set({ active: true, status: "processing", lastError: null, updatedAt: new Date() })
    .where(and(eq(labels.id, sourceId), eq(labels.userId, userId)));

  let failed = false;
  try {
    await processSingleReleaseForSource(sourceId, userId);
  } catch {
    failed = true;
  }

  return {
    found: true as const,
    sourceId,
    failed,
  };
}

export async function refreshSingleSourceMetadataForUser(userId: string, sourceId: number) {
  const source = await findOwnedSourceForUser(userId, sourceId, { id: true, entityKind: true });
  if (!source) {
    return { found: false as const };
  }

  try {
    await refreshSourceMetadata(source.id, toSourceKind(source.entityKind), userId);
  } catch {
    // Preserve existing data on metadata refresh failures.
  }

  return {
    found: true as const,
    sourceId,
  };
}

export async function attemptProcessSourceForUser(userId: string, sourceId: number) {
  const source = await findOwnedSourceForUser(userId, sourceId, {
    id: true,
    active: true,
    status: true,
  });
  if (!source) {
    return { found: false as const };
  }

  if (!source.active) {
    return {
      found: true as const,
      sourceId,
      inactive: true as const,
    };
  }

  if (source.status === "paused") {
    return {
      found: true as const,
      sourceId,
      paused: true as const,
    };
  }

  const run = await runSourceProcessingAttemptForUser({
    userId,
    sourceId,
    leaseMs: 120_000,
  });

  if (run.attempt.outcome === "skipped" && !run.attempt.lockAcquired) {
    return {
      found: true as const,
      sourceId,
      busy: true as const,
      result: null as Awaited<typeof run.result>,
      attempt: run.attempt,
    };
  }

  if (run.attempt.outcome === "error") {
    return {
      found: true as const,
      sourceId,
      failed: true as const,
      result: null as Awaited<typeof run.result>,
      attempt: run.attempt,
    };
  }

  return {
    found: true as const,
    sourceId,
    inactive: false as const,
    paused: false as const,
    busy: false as const,
    failed: false as const,
    result: run.result,
    attempt: run.attempt,
  };
}

export async function deleteSourceForUser(userId: string, sourceId: number) {
  const source = await findOwnedSourceForUser(userId, sourceId, { id: true });
  if (!source) {
    return { found: false as const };
  }

  const ownedReleaseRows = await db.query.releases.findMany({
    where: and(eq(releases.labelId, sourceId), eq(releases.userId, userId)),
    columns: { id: true },
  });
  const releaseIds = ownedReleaseRows.map((item) => item.id);

  for (const releaseId of releaseIds) {
    const fallbackMappings = await listSourceReleaseFallbackMappings(userId, releaseId);
    const fallback = fallbackMappings.find((item) => item.sourceId !== sourceId);
    if (!fallback) continue;
    await db
      .update(releases)
      .set({ labelId: fallback.sourceId })
      .where(and(eq(releases.id, releaseId), eq(releases.userId, userId)));
  }

  await db
    .delete(queueItems)
    .where(
      releaseIds.length > 0
        ? and(
            eq(queueItems.userId, userId),
            or(eq(queueItems.labelId, sourceId), inArray(queueItems.releaseId, releaseIds)),
          )
        : and(eq(queueItems.userId, userId), eq(queueItems.labelId, sourceId)),
    );

  await db.delete(labels).where(and(eq(labels.id, sourceId), eq(labels.userId, userId)));

  return {
    found: true as const,
    sourceId,
  };
}
