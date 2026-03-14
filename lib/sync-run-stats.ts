import type { SyncRunEvent } from "@/lib/sync-types";
import { classifySourceFailure, inferFailureProvider } from "@/lib/source-failures";

function computePercentile(values: number[], percentile: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentile * sorted.length) - 1));
  return sorted[rank] ?? 0;
}

function averageDurationMs(rows: SyncRunEvent[]) {
  const durations = rows.map((item) => Math.max(0, item.durationMs || 0));
  if (durations.length === 0) return 0;
  return Math.round(durations.reduce((sum, item) => sum + item, 0) / durations.length);
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

export function buildSyncRunBreakdown(runHistory: SyncRunEvent[], windowMinutes = 60) {
  const now = Date.now();
  const threshold = now - Math.max(1, windowMinutes) * 60 * 1000;
  const recentRuns = runHistory.filter((item) => item.createdAt >= threshold);
  const failureRuns = recentRuns.filter((item) => item.outcome === "error");

  const sourceKinds = {
    label: 0,
    artist: 0,
    unknown: 0,
  };
  const failureProviders = {
    discogs: 0,
    youtube: 0,
    unknown: 0,
  };
  const failureCategories = {
    auth: 0,
    rate_limit: 0,
    provider: 0,
    database: 0,
    data: 0,
    unknown: 0,
  };

  for (const item of recentRuns) {
    if (item.sourceKind === "label") sourceKinds.label += 1;
    else if (item.sourceKind === "artist") sourceKinds.artist += 1;
    else sourceKinds.unknown += 1;
  }

  for (const item of failureRuns) {
    const errorText = item.error || item.message || "";
    failureProviders[inferFailureProvider(errorText)] += 1;
    failureCategories[classifySourceFailure(errorText)] += 1;
  }

  return {
    windowMinutes,
    sourceKinds,
    failureProviders,
    failureCategories,
  };
}

export function buildSyncWindowComparison(runHistory: SyncRunEvent[], windowMinutes = 10) {
  const now = Date.now();
  const windowMs = Math.max(1, windowMinutes) * 60 * 1000;
  const currentThreshold = now - windowMs;
  const previousThreshold = now - windowMs * 2;
  const currentRuns = runHistory.filter((item) => item.createdAt >= currentThreshold);
  const previousRuns = runHistory.filter((item) => item.createdAt >= previousThreshold && item.createdAt < currentThreshold);
  const currentFailedRuns = currentRuns.filter((item) => item.outcome === "error");
  const previousFailedRuns = previousRuns.filter((item) => item.outcome === "error");
  const currentAverageDurationMs = averageDurationMs(currentRuns);
  const previousAverageDurationMs = averageDurationMs(previousRuns);
  const runDelta = currentRuns.length - previousRuns.length;
  const failedDelta = currentFailedRuns.length - previousFailedRuns.length;
  const averageDurationDeltaMs = currentAverageDurationMs - previousAverageDurationMs;

  let anomaly: "stable" | "throughput_spike" | "throughput_drop" | "failures_spike" | "latency_spike" = "stable";
  let summary = "Stable versus the previous window.";

  if (previousRuns.length === 0 && currentRuns.length > 0) {
    summary = "Recent activity has no previous-window baseline yet.";
  } else if (currentFailedRuns.length >= 3 && currentFailedRuns.length >= previousFailedRuns.length + 2) {
    anomaly = "failures_spike";
    summary = `Failures up ${failedDelta} versus the previous ${windowMinutes}m window.`;
  } else if (previousRuns.length > 0 && currentRuns.length >= Math.max(3, previousRuns.length * 2)) {
    anomaly = "throughput_spike";
    summary = `Run volume up ${runDelta} versus the previous ${windowMinutes}m window.`;
  } else if (previousRuns.length >= 3 && currentRuns.length * 2 <= previousRuns.length) {
    anomaly = "throughput_drop";
    summary = `Run volume down ${Math.abs(runDelta)} versus the previous ${windowMinutes}m window.`;
  } else if (previousAverageDurationMs > 0 && currentAverageDurationMs >= Math.round(previousAverageDurationMs * 1.5) && currentAverageDurationMs - previousAverageDurationMs >= 1000) {
    anomaly = "latency_spike";
    summary = `Average run time up ${Math.round(averageDurationDeltaMs / 1000)}s versus the previous ${windowMinutes}m window.`;
  }

  return {
    currentWindowMinutes: windowMinutes,
    previousRuns: previousRuns.length,
    previousSuccessfulRuns: previousRuns.filter((item) => item.outcome === "ok").length,
    previousFailedRuns: previousFailedRuns.length,
    previousAverageDurationMs,
    runDelta,
    failedDelta,
    averageDurationDeltaMs,
    anomaly,
    summary,
  };
}
