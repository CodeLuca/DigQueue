import { createZeroSyncThroughput, type SyncThroughput } from "@/lib/sync-throughput";
import type { SyncHealthAlert } from "@/lib/sync-health";
import type { SyncRunEvent, SyncTelemetry } from "@/lib/sync-types";

type SourceRow = {
  id: number;
  name: string;
  kind: "label" | "artist";
};

export type SourceNextResponse = {
  nextSourceId: number | null;
  counts: {
    queued: number;
    processing: number;
    error: number;
    paused: number;
    complete: number;
    other: number;
  };
  activeCount: number;
  processingSources: SourceRow[];
  syncTelemetry: SyncTelemetry | null;
  runHistory: SyncRunEvent[];
  lastSuccessBySource: Array<{ sourceId: number; sourceName: string; lastSuccessAt: number }>;
  throughput: SyncThroughput;
  throughputLong: SyncThroughput;
  throughputComparison: {
    currentWindowMinutes: number;
    previousRuns: number;
    previousSuccessfulRuns: number;
    previousFailedRuns: number;
    previousAverageDurationMs: number;
    runDelta: number;
    failedDelta: number;
    averageDurationDeltaMs: number;
    anomaly: "stable" | "throughput_spike" | "throughput_drop" | "failures_spike" | "latency_spike";
    summary: string;
  };
  throughputBreakdown: {
    windowMinutes: number;
    sourceKinds: { label: number; artist: number; unknown: number };
    failureProviders: { discogs: number; youtube: number; unknown: number };
    failureCategories: { auth: number; rate_limit: number; provider: number; database: number; data: number; unknown: number };
  };
  healthAlerts: SyncHealthAlert[];
  processingAttempt: {
    attempted: boolean;
    sourceId: number | null;
    lockAcquired: boolean;
    outcome: "ok" | "error" | "skipped";
    message?: string;
    error?: string;
  };
  blocker: string | null;
};

export function createEmptySourceNextResponse(errorMessage: string): SourceNextResponse {
  return {
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
    runHistory: [],
    lastSuccessBySource: [],
    throughput: createZeroSyncThroughput(10),
    throughputLong: createZeroSyncThroughput(60),
    throughputComparison: {
      currentWindowMinutes: 10,
      previousRuns: 0,
      previousSuccessfulRuns: 0,
      previousFailedRuns: 0,
      previousAverageDurationMs: 0,
      runDelta: 0,
      failedDelta: 0,
      averageDurationDeltaMs: 0,
      anomaly: "stable",
      summary: "No recent baseline yet.",
    },
    throughputBreakdown: {
      windowMinutes: 60,
      sourceKinds: { label: 0, artist: 0, unknown: 0 },
      failureProviders: { discogs: 0, youtube: 0, unknown: 0 },
      failureCategories: { auth: 0, rate_limit: 0, provider: 0, database: 0, data: 0, unknown: 0 },
    },
    healthAlerts: [],
    processingAttempt: {
      attempted: false,
      sourceId: null,
      lockAcquired: false,
      outcome: "error",
      error: errorMessage,
    },
    blocker: "Database unavailable.",
  };
}
