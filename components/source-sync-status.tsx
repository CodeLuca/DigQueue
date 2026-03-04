"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getTimelineBarStyle, getTimelineMaxRuns } from "@/lib/sync-timeline";
import type { SyncThroughput } from "@/lib/sync-throughput";
import type { SyncRunEvent, SyncTelemetry } from "@/lib/sync-types";

type SourceRow = {
  id: number;
  name: string;
  kind: "label" | "artist";
};

type SourceNextResponse = {
  counts?: { processing?: number; queued?: number; error?: number; complete?: number };
  processingSources?: SourceRow[];
  syncTelemetry?: SyncTelemetry | null;
  lastSuccessBySource?: Array<{ sourceId: number; sourceName: string; lastSuccessAt: number }>;
  runHistory?: SyncRunEvent[];
  throughput?: SyncThroughput;
  throughputLong?: SyncThroughput;
  blocker?: string | null;
};

const POLL_MS = 2000;

function formatPhase(phase: SyncTelemetry["phase"]) {
  if (phase === "matching_track") return "Matching track";
  if (phase === "processing_release") return "Processing release";
  if (phase === "loading_release_page") return "Loading release page";
  if (phase === "queued") return "Queued results";
  if (phase === "complete") return "Complete";
  if (phase === "error") return "Error";
  return "Idle";
}

function ageLabel(updatedAt: number | undefined) {
  if (!updatedAt) return "";
  const deltaSec = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
  if (deltaSec < 2) return "just now";
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const mins = Math.floor(deltaSec / 60);
  return `${mins}m ago`;
}

function formatDuration(durationMs: number | undefined) {
  const ms = Math.max(0, Number(durationMs || 0));
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function SourceSyncStatus({ initialProcessingCount }: { initialProcessingCount: number }) {
  const [data, setData] = useState<SourceNextResponse>({
    counts: { processing: initialProcessingCount },
    processingSources: [],
    syncTelemetry: null,
    blocker: null,
  });

  useEffect(() => {
    let canceled = false;

    const tick = async () => {
      try {
        const response = await fetch("/api/sources/next", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as SourceNextResponse;
        if (!canceled) setData(payload);
      } catch {
        // Keep previous state on transient failures.
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      canceled = true;
      window.clearInterval(id);
    };
  }, []);

  const processingCount = data.counts?.processing ?? initialProcessingCount;
  const processingNames = useMemo(
    () => (data.processingSources ?? []).map((item) => item.name).slice(0, 3),
    [data.processingSources],
  );
  const recentSuccessBySource = useMemo(() => {
    return (data.lastSuccessBySource ?? [])
      .slice(0, 4)
      .map((item) => ({
        sourceName: item.sourceName || `Source ${item.sourceId}`,
        createdAt: item.lastSuccessAt,
      }));
  }, [data.lastSuccessBySource]);
  const timelineMaxRuns = useMemo(() => {
    return getTimelineMaxRuns(data.throughput?.timeline ?? []);
  }, [data.throughput?.timeline]);

  return (
    <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)]/70 p-2.5 text-xs">
      <p className="text-[var(--color-text)]">
        {processingCount > 0
          ? `Auto-sync is running on this page (${processingCount} active source ${processingCount === 1 ? "job" : "jobs"}).`
          : "Auto-sync is idle right now on this page."}
      </p>
      {processingNames.length > 0 ? (
        <p className="mt-1 text-[var(--color-muted)]">Currently processing: {processingNames.join(", ")}</p>
      ) : null}
      {data.syncTelemetry ? (
        <div className="mt-2 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{formatPhase(data.syncTelemetry.phase)}</Badge>
            <Badge className="border-[var(--color-border)] text-[var(--color-muted)]">{data.syncTelemetry.sourceKind}</Badge>
            <Badge className="border-[var(--color-border)] text-[var(--color-muted)]">{ageLabel(data.syncTelemetry.updatedAt)}</Badge>
          </div>
          <p className="text-[var(--color-text)]">Source: {data.syncTelemetry.sourceName}</p>
          {data.syncTelemetry.releaseTitle ? <p className="text-[var(--color-muted)]">Release: {data.syncTelemetry.releaseTitle}</p> : null}
          {data.syncTelemetry.trackTitle ? (
            <p className="text-[var(--color-muted)]">
              Track now: {data.syncTelemetry.trackTitle}
              {typeof data.syncTelemetry.trackIndex === "number" && typeof data.syncTelemetry.trackTotal === "number"
                ? ` (${data.syncTelemetry.trackIndex}/${data.syncTelemetry.trackTotal})`
                : ""}
            </p>
          ) : null}
        </div>
      ) : data.blocker ? (
        <p className="mt-1 text-[var(--color-muted)]">{data.blocker}</p>
      ) : null}
      {data.throughput ? (
        <div className="mt-2 rounded-md border border-[var(--color-border)]/70 bg-[var(--color-surface)]/40 p-2">
          <p className="text-[11px] font-medium text-[var(--color-text)]">
            Last {data.throughput.windowMinutes}m: {data.throughput.runs} runs
            {" "}({data.throughput.successfulRuns} ok, {data.throughput.failedRuns} failed)
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            Avg run duration: {formatDuration(data.throughput.averageDurationMs)}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            Duration p50/p90: {formatDuration(data.throughput.durationP50Ms)} / {formatDuration(data.throughput.durationP90Ms)}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            Last successful sync: {data.throughput.lastSuccessAt ? ageLabel(data.throughput.lastSuccessAt) : "none yet"}
          </p>
          {data.throughput.timeline.length > 0 ? (
            <div className="mt-1">
              <p className="text-[10px] text-[var(--color-muted)]">Timeline (oldest to newest)</p>
              <div className="mt-1 flex h-8 items-end gap-0.5 rounded border border-[var(--color-border)]/60 bg-[var(--color-surface2)]/40 p-1">
                {data.throughput.timeline.map((bucket, index) => {
                  const { heightPct, className } = getTimelineBarStyle(bucket, timelineMaxRuns);
                  return (
                    <span
                      key={`${bucket.minuteOffset}-${index}`}
                      title={`${bucket.runs} runs (${bucket.successfulRuns} ok, ${bucket.failedRuns} failed)`}
                      className={`w-2 rounded-sm ${className}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {data.throughputLong ? (
        <details className="mt-2 rounded-md border border-[var(--color-border)]/70 bg-[var(--color-surface)]/40 p-2">
          <summary className="cursor-pointer text-[11px] font-medium text-[var(--color-text)]">
            {data.throughputLong.windowMinutes}m trend: {data.throughputLong.runs} runs
          </summary>
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">
            Success/failed: {data.throughputLong.successfulRuns}/{data.throughputLong.failedRuns}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            Duration p50/p90: {formatDuration(data.throughputLong.durationP50Ms)} / {formatDuration(data.throughputLong.durationP90Ms)}
          </p>
        </details>
      ) : null}
      {data.runHistory && data.runHistory.length > 0 ? (
        <details className="mt-2 rounded-md border border-[var(--color-border)]/70 bg-[var(--color-surface)]/40 p-2">
          <summary className="cursor-pointer text-[11px] font-medium text-[var(--color-text)]">Recent run history</summary>
          <div className="mt-2 space-y-1">
            {data.runHistory.slice(0, 5).map((item) => (
              <p key={`${item.createdAt}-${item.sourceId}-${item.outcome}`} className="text-[10px] text-[var(--color-muted)]">
                {new Date(item.createdAt).toLocaleTimeString()} • {item.sourceName} • {item.outcome}
                {" "}({formatDuration(item.durationMs)})
                {item.error ? ` • ${item.error}` : item.message ? ` • ${item.message}` : ""}
              </p>
            ))}
          </div>
        </details>
      ) : null}
      {recentSuccessBySource.length > 0 ? (
        <details className="mt-2 rounded-md border border-[var(--color-border)]/70 bg-[var(--color-surface)]/40 p-2">
          <summary className="cursor-pointer text-[11px] font-medium text-[var(--color-text)]">Per-source recent success</summary>
          <div className="mt-1 space-y-1">
            {recentSuccessBySource.map(({ sourceName, createdAt }) => (
              <p key={`${sourceName}-${createdAt}`} className="text-[10px] text-[var(--color-muted)]">
                {sourceName}: {ageLabel(createdAt)}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
