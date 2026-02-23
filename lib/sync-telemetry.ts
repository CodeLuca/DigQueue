import { and, eq, gt } from "drizzle-orm";
import { apiCache } from "@/db/schema";
import { db } from "@/lib/db";

const TTL_MS = 10 * 60 * 1000;

export type SyncTelemetry = {
  sourceId: number;
  sourceName: string;
  sourceKind: "label" | "artist";
  phase: "idle" | "loading_release_page" | "processing_release" | "matching_track" | "queued" | "complete" | "error";
  releaseId?: number;
  releaseTitle?: string;
  trackId?: number;
  trackTitle?: string;
  trackIndex?: number;
  trackTotal?: number;
  message?: string;
  updatedAt: number;
};

function syncTelemetryKey(userId: string) {
  return `sync_telemetry:${userId}`;
}

export async function writeSyncTelemetry(userId: string, telemetry: SyncTelemetry) {
  const key = syncTelemetryKey(userId);
  const now = Date.now();
  const payload = JSON.stringify(telemetry);

  try {
    await db
      .insert(apiCache)
      .values({
        key,
        userId,
        responseJson: payload,
        fetchedAt: new Date(now),
        expiresAt: new Date(now + TTL_MS),
      })
      .onConflictDoUpdate({
        target: apiCache.key,
        set: {
          userId,
          responseJson: payload,
          fetchedAt: new Date(now),
          expiresAt: new Date(now + TTL_MS),
        },
      });
  } catch {
    // Telemetry is best-effort; never block ingestion on cache writes.
  }
}

export async function clearSyncTelemetry(userId: string) {
  const key = syncTelemetryKey(userId);
  try {
    await db.delete(apiCache).where(and(eq(apiCache.key, key), eq(apiCache.userId, userId)));
  } catch {
    // Telemetry is best-effort; ignore cleanup failures.
  }
}

export async function readSyncTelemetry(userId: string): Promise<SyncTelemetry | null> {
  const key = syncTelemetryKey(userId);
  const now = Date.now();
  let row: { responseJson: string } | null = null;
  try {
    row = await db.query.apiCache.findFirst({
      where: and(eq(apiCache.key, key), eq(apiCache.userId, userId), gt(apiCache.expiresAt, new Date(now))),
      columns: { responseJson: true },
    }) ?? null;
  } catch {
    return null;
  }
  if (!row?.responseJson) return null;

  try {
    const parsed = JSON.parse(row.responseJson) as SyncTelemetry;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}
