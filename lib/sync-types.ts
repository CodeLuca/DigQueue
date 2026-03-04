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

export type SyncRunEvent = {
  sourceId: number | null;
  sourceName: string;
  outcome: "ok" | "error" | "skipped";
  message?: string;
  error?: string;
  lockAcquired: boolean;
  durationMs: number;
  createdAt: number;
};
