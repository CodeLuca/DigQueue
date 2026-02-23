export const dynamic = "force-dynamic";

import { and, asc, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { labels, releases, sourceReleases, workerLocks } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { processSingleReleaseForSource } from "@/lib/processing";
import { readSyncTelemetry } from "@/lib/sync-telemetry";
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
      if (source.status !== "processing" && source.status !== "queued") continue;

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
      const activeLock = await db.query.workerLocks.findFirst({
        where: and(
          eq(workerLocks.lockKey, `${userId}:${source.id}`),
          eq(workerLocks.userId, userId),
          gt(workerLocks.lockedUntil, new Date(now)),
        ),
        columns: { lockKey: true },
      });

      if (!hasPendingReleases && paginationFinished) {
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
      const processingStale = source.status === "processing" && !activeLock && staleForMs > 90_000;
      if (processingStale) {
        await db
          .update(labels)
          .set({
            status: hasPendingReleases ? "queued" : "complete",
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

    // Safety net: keep ingestion moving even if client-side worker polling fails.
    if (nextSourceId) {
      const lock = await acquireSourceWorkerLock(userId, nextSourceId, 120_000);
      if (lock) {
        try {
          await processSingleReleaseForSource(nextSourceId, userId);
        } catch {
          // Best-effort; source status/telemetry are updated in processing.
        } finally {
          await releaseSourceWorkerLock(lock);
        }
      }
    }

    const syncTelemetry = await readSyncTelemetry(userId);
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
      blocker:
        nextSourceId !== null
          ? null
          : counts.error > 0
            ? "Only errored sources remain. Retry or clear errors to continue."
            : activeSources.length === 0
              ? "No active sources."
              : "No queued/processing sources.",
    });
  } catch {
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
      blocker: "Database unavailable.",
    });
  }
}
