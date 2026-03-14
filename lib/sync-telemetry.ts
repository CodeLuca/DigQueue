import { and, eq, gt } from "drizzle-orm";
import { apiCache } from "@/db/schema";
import { db } from "@/lib/db";
import type { SyncRunEvent, SyncTelemetry } from "@/lib/sync-types";

const TTL_MS = 10 * 60 * 1000;
const RUN_HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
const RUN_HISTORY_LIMIT = 40;

function syncTelemetryKey(userId: string) {
  return `sync_telemetry:${userId}`;
}

function syncRunHistoryKey(userId: string) {
  return `sync_run_history:${userId}`;
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
        target: [apiCache.userId, apiCache.key],
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

export async function appendSyncRunEvent(userId: string, event: SyncRunEvent) {
  const key = syncRunHistoryKey(userId);
  const now = Date.now();
  try {
    const existing = await db.query.apiCache.findFirst({
      where: and(eq(apiCache.key, key), eq(apiCache.userId, userId)),
      columns: { responseJson: true },
    });
    const parsed = existing?.responseJson ? (JSON.parse(existing.responseJson) as SyncRunEvent[]) : [];
    const next = [event, ...(Array.isArray(parsed) ? parsed : [])].slice(0, RUN_HISTORY_LIMIT);
    await db
      .insert(apiCache)
      .values({
        key,
        userId,
        responseJson: JSON.stringify(next),
        fetchedAt: new Date(now),
        expiresAt: new Date(now + RUN_HISTORY_TTL_MS),
      })
      .onConflictDoUpdate({
        target: [apiCache.userId, apiCache.key],
        set: {
          userId,
          responseJson: JSON.stringify(next),
          fetchedAt: new Date(now),
          expiresAt: new Date(now + RUN_HISTORY_TTL_MS),
        },
      });
  } catch {
    // Run history is best-effort and must never block processing.
  }
}

export async function readSyncRunHistory(userId: string): Promise<SyncRunEvent[]> {
  const key = syncRunHistoryKey(userId);
  try {
    const row = await db.query.apiCache.findFirst({
      where: and(eq(apiCache.key, key), eq(apiCache.userId, userId)),
      columns: { responseJson: true },
    });
    if (!row?.responseJson) return [];
    const parsed = JSON.parse(row.responseJson) as SyncRunEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
