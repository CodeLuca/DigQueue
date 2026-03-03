export const dynamic = "force-dynamic";

import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { labels, releases, sourceReleases } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { processSingleReleaseForSource } from "@/lib/processing";
import { appendSyncRunEvent, readSyncRunHistory, readSyncTelemetry } from "@/lib/sync-telemetry";
import { isTransientLabelError } from "@/lib/utils";
import { acquireSourceWorkerLock, releaseSourceWorkerLock } from "@/lib/worker-locks";

export async function GET() {
  try {
    const now = Date.now();
    const userId = await requireCurrentAppUserId();
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
      const activeLock: { lockKey: string } | null = null;

      if (!hasPendingReleases && paginationFinished && hasStartedPagination) {
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

      const staleForMs = now - source.updatedAt.getTime();
      const processingStale = source.status === "processing" && !activeLock && staleForMs > 25_000;
      const transientErrorStale = transientError && !activeLock && staleForMs > 10_000;
      if (processingStale) {
        await db
          .update(labels)
          .set({
            status: hasPendingReleases || !paginationFinished || !hasStartedPagination ? "queued" : "complete",
            updatedAt: new Date(),
            lastError: null,
          })
          .where(and(eq(labels.id, source.id), eq(labels.userId, userId)));
      } else if (transientErrorStale) {
        await db
          .update(labels)
          .set({
            status: hasPendingReleases || !paginationFinished || !hasStartedPagination ? "queued" : "complete",
            updatedAt: new Date(),
            lastError: null,
          })
          .where(and(eq(labels.id, source.id), eq(labels.userId, userId)));
      }
    }

    const activeSources = await db.query.labels.findMany({
      where: and(eq(labels.userId, userId), eq(labels.active, true)),
      columns: { id: true, name: true, entityKind: true, status: true, lastError: true, updatedAt: true, currentPage: true, totalPages: true },
      orderBy: [asc(labels.updatedAt)],
    });

    const counts = {
      queued: 0,
      processing: 0,
      error: 0,
      paused: 0,
      complete: 0,
      other: 0,
    };

    for (const source of activeSources) {
      if (source.status === "queued") counts.queued += 1;
      else if (source.status === "processing") counts.processing += 1;
      else if (source.status === "error") counts.error += 1;
      else if (source.status === "paused") counts.paused += 1;
      else if (source.status === "complete") counts.complete += 1;
      else counts.other += 1;
    }

    const nextProcessing = activeSources.find((source) => source.status === "processing");
    const nextQueued = activeSources.find((source) => source.status === "queued");
    const nextSourceId = nextProcessing?.id ?? nextQueued?.id ?? null;

    const processingAttempt: {
      attempted: boolean;
      sourceId: number | null;
      lockAcquired: boolean;
      outcome: "ok" | "error" | "skipped";
      message?: string;
      error?: string;
    } = {
      attempted: false,
      sourceId: nextSourceId,
      lockAcquired: false,
      outcome: "skipped",
    };

    // Safety net: keep ingestion moving even if client-side worker polling fails.
    if (nextSourceId) {
      const startedAt = Date.now();
      processingAttempt.attempted = true;
      const lock = await acquireSourceWorkerLock(userId, nextSourceId, 120_000);
      if (lock) {
        processingAttempt.lockAcquired = true;
        try {
          const result = await processSingleReleaseForSource(nextSourceId, userId);
          processingAttempt.outcome = "ok";
          processingAttempt.message = result?.message || "Processed one source step.";
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          processingAttempt.outcome = "error";
          processingAttempt.error = message;
          console.error(`[sources-next] source=${nextSourceId} processing error: ${message}`);
        } finally {
          await releaseSourceWorkerLock(lock);
        }
      } else {
        processingAttempt.outcome = "skipped";
        processingAttempt.message = "Worker lock busy";
      }
      const sourceName = activeSources.find((item) => item.id === nextSourceId)?.name || `Source ${nextSourceId}`;
      await appendSyncRunEvent(userId, {
        sourceId: nextSourceId,
        sourceName,
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
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const recentRuns = runHistory.filter((item) => item.createdAt >= tenMinutesAgo);
    const successfulRuns = recentRuns.filter((item) => item.outcome === "ok");
    const failedRuns = recentRuns.filter((item) => item.outcome === "error");
    const averageDurationMs =
      recentRuns.length > 0
        ? Math.round(recentRuns.reduce((sum, item) => sum + Math.max(0, item.durationMs || 0), 0) / recentRuns.length)
        : 0;
    const processingSources = activeSources
      .filter((source) => source.status === "processing")
      .map((source) => ({
        id: source.id,
        name: source.name,
        kind: source.entityKind,
      }));

    return NextResponse.json({
      nextSourceId,
      counts,
      activeCount: activeSources.length,
      processingSources,
      syncTelemetry,
      runHistory: runHistory.slice(0, 8),
      throughput: {
        windowMinutes: 10,
        runs: recentRuns.length,
        successfulRuns: successfulRuns.length,
        failedRuns: failedRuns.length,
        averageDurationMs,
      },
      processingAttempt,
      blocker:
        nextSourceId !== null
          ? null
          : counts.error > 0
            ? "Only errored sources remain. Retry or clear errors to continue."
            : activeSources.length === 0
              ? "No active sources."
              : "No queued/processing sources.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[sources-next] fatal error: ${message}`);
    return NextResponse.json({
      nextSourceId: null,
      counts: {
        queued: 0,
        processing: 0,
        error: 0,
        paused: 0,
        complete: 0,
        other: 0,
      },
      activeCount: 0,
      processingSources: [],
      syncTelemetry: null,
      runHistory: [],
      throughput: {
        windowMinutes: 10,
        runs: 0,
        successfulRuns: 0,
        failedRuns: 0,
        averageDurationMs: 0,
      },
      processingAttempt: {
        attempted: false,
        sourceId: null,
        lockAcquired: false,
        outcome: "error",
        error: message,
      },
      blocker: "Database unavailable.",
    });
  }
}
