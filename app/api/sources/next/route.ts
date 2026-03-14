export const dynamic = "force-dynamic";

import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { labels, releases, sourceReleases } from "@/db/schema";
import { requireRouteUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { resolveSourceNextBlocker } from "@/lib/source-next-blocker";
import {
  createProcessingAttempt,
  getProcessingAttemptSourceMeta,
  selectNextSourceId,
} from "@/lib/source-next-processing";
import { runSourceProcessingAttemptForUser } from "@/lib/source-processing-run";
import { buildSyncHealthAlerts } from "@/lib/sync-health";
import { buildSourceStatusCounts, planSourceNextRecovery } from "@/lib/source-next-state";
import { toSourceKind } from "@/lib/source-kind";
import { createEmptySourceNextResponse, type SourceNextResponse } from "@/lib/source-next-response";
import { appendSyncRunEvent, readSyncRunHistory, readSyncTelemetry } from "@/lib/sync-telemetry";
import { buildLastSuccessBySource, buildSyncRunBreakdown, buildSyncRunStats, buildSyncWindowComparison } from "@/lib/sync-run-stats";
import { isTransientLabelError } from "@/lib/utils";

export async function GET() {
  try {
    const now = Date.now();
    const auth = await requireRouteUserId();
    if (auth.response) return auth.response;
    const userId = auth.userId;
    const initialSources = await db.query.labels.findMany({
      where: and(eq(labels.userId, userId), eq(labels.active, true)),
      columns: { id: true, name: true, entityKind: true, status: true, lastError: true, updatedAt: true, currentPage: true, totalPages: true },
      orderBy: [asc(labels.updatedAt)],
    });

    for (const source of initialSources) {
      const transientError = source.status === "error" && isTransientLabelError(source.lastError);
      if (source.status !== "processing" && source.status !== "queued" && !transientError) continue;

      const pending = await db
        .select({ releaseId: releases.id })
        .from(sourceReleases)
        .innerJoin(releases, eq(sourceReleases.releaseId, releases.id))
        .where(
          and(
            eq(sourceReleases.userId, userId),
            eq(sourceReleases.sourceId, source.id),
            eq(releases.userId, userId),
            eq(releases.detailsFetched, false),
          ),
        )
        .limit(1);

      const hasPendingReleases = pending.length > 0;
      const paginationFinished = source.currentPage >= source.totalPages;
      const hasStartedPagination = source.currentPage > 1;
      const recoveryPlan = planSourceNextRecovery({
        status: source.status,
        transientError,
        hasPendingReleases,
        paginationFinished,
        hasStartedPagination,
        staleForMs: now - source.updatedAt.getTime(),
        hasActiveLock: false,
      });

      if (recoveryPlan.action === "mark_complete") {
        await db
          .update(labels)
          .set({
            status: "complete",
            updatedAt: new Date(),
            lastError: null,
          })
          .where(and(eq(labels.id, source.id), eq(labels.userId, userId)));
        continue;
      }
      if (recoveryPlan.action === "recover") {
        await db
          .update(labels)
          .set({
            status: recoveryPlan.nextStatus,
            updatedAt: new Date(),
            lastError: recoveryPlan.clearLastError ? null : source.lastError,
          })
          .where(and(eq(labels.id, source.id), eq(labels.userId, userId)));
      }
    }

    const activeSources = await db.query.labels.findMany({
      where: and(eq(labels.userId, userId), eq(labels.active, true)),
      columns: { id: true, name: true, entityKind: true, status: true, lastError: true, updatedAt: true, currentPage: true, totalPages: true },
      orderBy: [asc(labels.updatedAt)],
    });

    const counts = buildSourceStatusCounts(activeSources.map((source) => source.status));

    const nextSourceId = selectNextSourceId(activeSources);
    let processingAttempt = createProcessingAttempt(nextSourceId);

    // Safety net: keep ingestion moving even if client-side worker polling fails.
    if (nextSourceId) {
      const startedAt = Date.now();
      const run = await runSourceProcessingAttemptForUser({
        userId,
        sourceId: nextSourceId,
        leaseMs: 120_000,
      });
      processingAttempt = run.attempt;
      if (run.attempt.outcome === "error" && run.attempt.error) {
        console.error(`[sources-next] source=${nextSourceId} processing error: ${run.attempt.error}`);
      }
      const sourceMeta = getProcessingAttemptSourceMeta(activeSources, nextSourceId);
      await appendSyncRunEvent(userId, {
        sourceId: nextSourceId,
        sourceName: sourceMeta?.sourceName || `Source ${nextSourceId}`,
        sourceKind: toSourceKind(sourceMeta?.entityKind),
        outcome: processingAttempt.outcome,
        message: processingAttempt.message,
        error: processingAttempt.error,
        lockAcquired: processingAttempt.lockAcquired,
        durationMs: Math.max(0, Date.now() - startedAt),
        createdAt: Date.now(),
      });
    }

    const syncTelemetry = await readSyncTelemetry(userId).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[sources-next] telemetry unavailable: ${message}`);
      return null;
    });
    const runHistory = await readSyncRunHistory(userId).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[sources-next] run history unavailable: ${message}`);
      return [];
    });
    const sourceNameById = new Map<number, string>(activeSources.map((item) => [item.id, item.name]));
    const lastSuccessBySource = buildLastSuccessBySource(runHistory).map((item) => ({
      sourceId: item.sourceId,
      sourceName: sourceNameById.get(item.sourceId) || `Source ${item.sourceId}`,
      lastSuccessAt: item.lastSuccessAt,
    }));
    const throughput = buildSyncRunStats(runHistory, 10);
    const throughputLong = buildSyncRunStats(runHistory, 60);
    const throughputComparison = buildSyncWindowComparison(runHistory, 10);
    const throughputBreakdown = buildSyncRunBreakdown(runHistory, 60);
    const healthAlerts = buildSyncHealthAlerts({
      now,
      counts: { processing: counts.processing, error: counts.error },
      syncTelemetry,
      throughputLong,
      throughputBreakdown,
    });
    const processingSources = activeSources
      .filter((source) => source.status === "processing")
      .map((source) => ({
        id: source.id,
        name: source.name,
        kind: toSourceKind(source.entityKind),
      }));

    const response: SourceNextResponse = {
      nextSourceId,
      counts,
      activeCount: activeSources.length,
      processingSources,
      syncTelemetry,
      runHistory: runHistory.slice(0, 8),
      lastSuccessBySource,
      throughput,
      throughputLong,
      throughputComparison,
      throughputBreakdown,
      healthAlerts,
      processingAttempt,
      blocker: resolveSourceNextBlocker({
        nextSourceId,
        errorCount: counts.error,
        activeCount: activeSources.length,
      }),
    };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[sources-next] fatal error: ${message}`);
    return NextResponse.json(createEmptySourceNextResponse(message));
  }
}
