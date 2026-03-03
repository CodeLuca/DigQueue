"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

type SyncTelemetry = {
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

type SourceRow = {
  id: number;
  name: string;
  kind: "label" | "artist";
};

type SourceNextResponse = {
  counts?: { processing?: number; queued?: number; error?: number; complete?: number };
  processingSources?: SourceRow[];
  syncTelemetry?: SyncTelemetry | null;
  runHistory?: Array<{
    sourceId: number | null;
    sourceName: string;
    outcome: "ok" | "error" | "skipped";
    message?: string;
    error?: string;
    lockAcquired: boolean;
    durationMs: number;
    createdAt: number;
  }>;
  throughput?: {
    windowMinutes: number;
    runs: number;
    successfulRuns: number;
    failedRuns: number;
    averageDurationMs: number;
  };
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
        </div>
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
    </div>
  );
}
