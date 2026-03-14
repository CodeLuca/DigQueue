import { and, asc, eq } from "drizzle-orm";
import { labels } from "@/db/schema";
import { db } from "@/lib/db";
import { processSingleReleaseForSource } from "@/lib/processing";
import {
  planStartSyncSourceUpdate,
  shouldQueueActiveSourceBatch,
  shouldResumePausedSource,
  shouldRetrySourceStatus,
} from "@/lib/source-action-plans";
import { buildPauseSourceUpdate } from "@/lib/source-remediation";

function labelScope(userId: string) {
  return eq(labels.userId, userId);
}

export async function retryErroredActiveSourcesForUser(userId: string, options?: { limit?: number }) {
  const scope = labelScope(userId);
  const erroredSources = await db.query.labels.findMany({
    where: and(eq(labels.status, "error"), eq(labels.active, true), scope),
    orderBy: [asc(labels.updatedAt)],
    columns: { id: true, name: true, status: true },
  });
  const now = new Date();
  let affected = 0;
  const retriedSources: Array<{ id: number; name: string; status: string }> = [];
  for (const source of erroredSources) {
    if (typeof options?.limit === "number" && affected >= options.limit) break;
    if (!shouldRetrySourceStatus(source.status)) continue;
    await db
      .update(labels)
      .set({ status: "queued", lastError: null, retryCount: 0, updatedAt: now })
      .where(and(eq(labels.id, source.id), scope));
    affected += 1;
    retriedSources.push(source);
  }
  return { affected, sources: retriedSources };
}

export async function queueActiveSourcesForUser(userId: string, options?: { limit?: number }) {
  const scope = labelScope(userId);
  const now = new Date();
  const candidates = await db.query.labels.findMany({
    where: and(eq(labels.active, true), scope),
    orderBy: [asc(labels.updatedAt)],
    columns: { id: true, name: true, status: true },
  });

  let affected = 0;
  const appliedSources: Array<{ id: number; name: string; status: string }> = [];
  for (const source of candidates) {
    if (typeof options?.limit === "number" && affected >= options.limit) break;
    if (!shouldQueueActiveSourceBatch(source.status)) continue;
    await db
      .update(labels)
      .set({ status: "queued", lastError: null, updatedAt: now })
      .where(and(eq(labels.id, source.id), scope));
    affected += 1;
    appliedSources.push(source);
  }

  return { affected, sources: appliedSources };
}

export async function pauseAllActiveSourcesForUser(userId: string) {
  const scope = labelScope(userId);
  const now = new Date();
  const activeSources = await db.query.labels.findMany({
    where: and(eq(labels.active, true), scope),
    columns: { id: true, name: true, status: true },
  });

  for (const source of activeSources) {
    await db
      .update(labels)
      .set(buildPauseSourceUpdate(source.status, now))
      .where(and(eq(labels.id, source.id), scope));
  }

  return { affected: activeSources.length, sources: activeSources };
}

export async function resumePausedSourcesForUser(userId: string, options?: { limit?: number }) {
  const scope = labelScope(userId);
  const now = new Date();
  const pausedSources = await db.query.labels.findMany({
    where: and(eq(labels.active, false), eq(labels.status, "paused"), scope),
    orderBy: [asc(labels.updatedAt)],
    columns: { id: true, name: true, active: true, status: true },
  });

  let affected = 0;
  const resumedSources: Array<{ id: number; name: string; active: boolean; status: string }> = [];
  for (const source of pausedSources) {
    if (typeof options?.limit === "number" && affected >= options.limit) break;
    if (!shouldResumePausedSource(source)) continue;
    await db
      .update(labels)
      .set({ active: true, status: "queued", lastError: null, updatedAt: now })
      .where(and(eq(labels.id, source.id), scope));
    affected += 1;
    resumedSources.push(source);
  }

  return { affected, sources: resumedSources };
}

export async function startSourceSyncForUser(userId: string) {
  const scope = labelScope(userId);
  const now = new Date();
  const allSources = await db.query.labels.findMany({
    where: scope,
    orderBy: [asc(labels.updatedAt)],
    columns: { id: true, active: true, status: true },
  });

  let affected = 0;
  for (const source of allSources) {
    const updatePlan = planStartSyncSourceUpdate(source);
    if (!updatePlan) continue;
    await db
      .update(labels)
      .set(
        updatePlan.clearLastError
          ? { active: updatePlan.active, status: updatePlan.status, lastError: null, updatedAt: now }
          : { active: updatePlan.active, status: updatePlan.status, updatedAt: now },
      )
      .where(and(eq(labels.id, source.id), scope));
    affected += 1;
  }

  const firstQueued = await db.query.labels.findFirst({
    where: and(eq(labels.active, true), eq(labels.status, "queued"), scope),
    orderBy: [asc(labels.updatedAt)],
    columns: { id: true },
  });

  if (firstQueued) {
    await db
      .update(labels)
      .set({ status: "processing", lastError: null, updatedAt: new Date() })
      .where(and(eq(labels.id, firstQueued.id), scope));
    try {
      await processSingleReleaseForSource(firstQueued.id, userId);
    } catch {
      // Keep daemon-driven retries; start action should stay resilient.
    }
  }

  return { affected, kickedSourceId: firstQueued?.id ?? null };
}
