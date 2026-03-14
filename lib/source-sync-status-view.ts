"use client";

import { getTimelineMaxRuns, groupTimelineBuckets } from "@/lib/sync-timeline";
import type { SyncTelemetry } from "@/lib/sync-types";
import type { SourceNextResponse } from "@/lib/source-next-response";

type TopBucket = {
  label: string;
  count: number;
};

function pickTopBucket(entries: Array<[string, number]>): TopBucket | null {
  const ranked = [...entries].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top || top[1] <= 0) return null;
  return { label: top[0], count: top[1] };
}

export function formatSourceSyncPhase(phase: SyncTelemetry["phase"]) {
  if (phase === "matching_track") return "Matching track";
  if (phase === "processing_release") return "Processing release";
  if (phase === "loading_release_page") return "Loading release page";
  if (phase === "queued") return "Queued results";
  if (phase === "complete") return "Complete";
  if (phase === "error") return "Error";
  return "Idle";
}

export function formatSourceSyncAge(updatedAt: number | undefined) {
  if (!updatedAt) return "";
  const deltaSec = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
  if (deltaSec < 2) return "just now";
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const mins = Math.floor(deltaSec / 60);
  return `${mins}m ago`;
}

export function formatSourceSyncDuration(durationMs: number | undefined) {
  const ms = Math.max(0, Number(durationMs || 0));
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function formatSourceSyncDelta(value: number, formatter: (n: number) => string) {
  if (value === 0) return `0 ${formatter(0)}`;
  const prefix = value > 0 ? "+" : "-";
  return `${prefix}${formatter(Math.abs(value))}`;
}

export function getSourceSyncAnomalyBadgeClass(
  anomaly: NonNullable<Partial<SourceNextResponse>["throughputComparison"]>["anomaly"],
) {
  if (anomaly === "throughput_spike") return "border-sky-500/50 bg-sky-500/12 text-sky-200";
  if (anomaly === "throughput_drop") return "border-amber-500/50 bg-amber-500/12 text-amber-200";
  if (anomaly === "failures_spike") return "border-rose-500/50 bg-rose-500/12 text-rose-200";
  if (anomaly === "latency_spike") return "border-fuchsia-500/50 bg-fuchsia-500/12 text-fuchsia-200";
  return "border-[var(--color-border)] text-[var(--color-muted)]";
}

export function getSourceSyncAnomalyLabel(
  anomaly: NonNullable<Partial<SourceNextResponse>["throughputComparison"]>["anomaly"],
) {
  if (anomaly === "throughput_spike") return "Throughput spike";
  if (anomaly === "throughput_drop") return "Throughput drop";
  if (anomaly === "failures_spike") return "Failures spiking";
  if (anomaly === "latency_spike") return "Latency spike";
  return "Stable";
}

export function buildSourceSyncStatusViewModel(
  data: Partial<SourceNextResponse>,
  initialProcessingCount: number,
) {
  const processingCount = data.counts?.processing ?? initialProcessingCount;
  const processingNames = (data.processingSources ?? []).map((item) => item.name).slice(0, 3);
  const recentSuccessBySource = (data.lastSuccessBySource ?? [])
    .slice(0, 4)
    .map((item) => ({
      sourceName: item.sourceName || `Source ${item.sourceId}`,
      createdAt: item.lastSuccessAt,
    }));

  const timeline = data.throughput?.timeline ?? [];
  const timelineMaxRuns = getTimelineMaxRuns(timeline);
  const longTimelineGrouped = groupTimelineBuckets(data.throughputLong?.timeline ?? [], 5);
  const longTimelineMaxRuns = getTimelineMaxRuns(longTimelineGrouped);

  const categories = data.throughputBreakdown?.failureCategories;
  const providers = data.throughputBreakdown?.failureProviders;
  const sourceKinds = data.throughputBreakdown?.sourceKinds;

  return {
    processingCount,
    processingNames,
    recentSuccessBySource,
    timeline,
    timelineMaxRuns,
    longTimelineGrouped,
    longTimelineMaxRuns,
    topFailureCategory: categories
      ? pickTopBucket([
        ["auth", categories.auth],
        ["rate limit", categories.rate_limit],
        ["provider", categories.provider],
        ["database", categories.database],
        ["data", categories.data],
        ["unknown", categories.unknown],
      ])
      : null,
    topFailureProvider: providers
      ? pickTopBucket([
        ["Discogs", providers.discogs],
        ["YouTube", providers.youtube],
        ["Unknown", providers.unknown],
      ])
      : null,
    dominantRunMix: sourceKinds
      ? pickTopBucket([
        ["labels", sourceKinds.label],
        ["artists", sourceKinds.artist],
        ["unknown", sourceKinds.unknown],
      ])
      : null,
  };
}
