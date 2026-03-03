import type { SyncRunEvent } from "@/lib/sync-telemetry";

export function buildLastSuccessBySource(runHistory: SyncRunEvent[]) {
  const bySource = new Map<number, number>();
  for (const row of runHistory) {
    if (row.outcome !== "ok" || typeof row.sourceId !== "number" || row.sourceId <= 0) continue;
    if (!bySource.has(row.sourceId)) bySource.set(row.sourceId, row.createdAt);
  }
  return [...bySource.entries()].map(([sourceId, lastSuccessAt]) => ({ sourceId, lastSuccessAt }));
}

export function buildSyncRunStats(runHistory: SyncRunEvent[], windowMinutes = 10) {
  const now = Date.now();
  const threshold = now - Math.max(1, windowMinutes) * 60 * 1000;
  const recentRuns = runHistory.filter((item) => item.createdAt >= threshold);
  const successfulRuns = recentRuns.filter((item) => item.outcome === "ok");
  const failedRuns = recentRuns.filter((item) => item.outcome === "error");
  const averageDurationMs =
    recentRuns.length > 0
      ? Math.round(recentRuns.reduce((sum, item) => sum + Math.max(0, item.durationMs || 0), 0) / recentRuns.length)
      : 0;
  const lastSuccessAt = runHistory.find((item) => item.outcome === "ok")?.createdAt ?? null;

  return {
    windowMinutes,
    runs: recentRuns.length,
    successfulRuns: successfulRuns.length,
    failedRuns: failedRuns.length,
    averageDurationMs,
    lastSuccessAt,
  };
}
