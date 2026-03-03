import type { SyncRunEvent } from "@/lib/sync-telemetry";

function computePercentile(values: number[], percentile: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentile * sorted.length) - 1));
  return sorted[rank] ?? 0;
}

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
  const durations = recentRuns.map((item) => Math.max(0, item.durationMs || 0));
  const averageDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((sum, item) => sum + item, 0) / durations.length)
      : 0;
  const lastSuccessAt = runHistory.find((item) => item.outcome === "ok")?.createdAt ?? null;
  const durationP50Ms = computePercentile(durations, 0.5);
  const durationP90Ms = computePercentile(durations, 0.9);
  const timeline = Array.from({ length: Math.max(1, windowMinutes) }, (_, index) => {
    const end = now - index * 60_000;
    const start = end - 60_000;
    const runs = recentRuns.filter((item) => item.createdAt >= start && item.createdAt < end);
    return {
      minuteOffset: index,
      runs: runs.length,
      successfulRuns: runs.filter((item) => item.outcome === "ok").length,
      failedRuns: runs.filter((item) => item.outcome === "error").length,
    };
  }).reverse();

  return {
    windowMinutes,
    runs: recentRuns.length,
    successfulRuns: successfulRuns.length,
    failedRuns: failedRuns.length,
    averageDurationMs,
    durationP50Ms,
    durationP90Ms,
    lastSuccessAt,
    timeline,
  };
}
