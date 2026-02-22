import { and, eq, sql } from "drizzle-orm";
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
}

export async function clearSyncTelemetry(userId: string) {
  const key = syncTelemetryKey(userId);
  await db.delete(apiCache).where(and(eq(apiCache.key, key), eq(apiCache.userId, userId)));
}

export async function readSyncTelemetry(userId: string): Promise<SyncTelemetry | null> {
  const key = syncTelemetryKey(userId);
  const now = Date.now();
  const row = await db.query.apiCache.findFirst({
    where: and(eq(apiCache.key, key), eq(apiCache.userId, userId), sql`${apiCache.expiresAt} > ${new Date(now)}`),
    columns: { responseJson: true },
  });
  if (!row?.responseJson) return null;

  try {
    const parsed = JSON.parse(row.responseJson) as SyncTelemetry;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}
