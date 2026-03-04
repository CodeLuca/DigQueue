import { createZeroSyncThroughput, type SyncThroughput } from "@/lib/sync-throughput";
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
