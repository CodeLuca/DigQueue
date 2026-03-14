export type SourceNextStateInput = {
  status: string;
  transientError: boolean;
  hasPendingReleases: boolean;
  paginationFinished: boolean;
  hasStartedPagination: boolean;
  staleForMs: number;
  hasActiveLock: boolean;
};

export type SourceNextRecoveryPlan =
  | { action: "none" }
  | { action: "mark_complete" }
  | { action: "recover"; nextStatus: "queued" | "complete"; clearLastError: boolean };

const PROCESSING_STALE_MS = 25_000;
const TRANSIENT_ERROR_STALE_MS = 10_000;

function resolveContinuationStatus(input: Pick<SourceNextStateInput, "hasPendingReleases" | "paginationFinished" | "hasStartedPagination">) {
  return input.hasPendingReleases || !input.paginationFinished || !input.hasStartedPagination ? "queued" : "complete";
}

export function planSourceNextRecovery(input: SourceNextStateInput): SourceNextRecoveryPlan {
  if (!input.hasPendingReleases && input.paginationFinished && input.hasStartedPagination) {
    return { action: "mark_complete" };
  }

  const processingStale = input.status === "processing" && !input.hasActiveLock && input.staleForMs > PROCESSING_STALE_MS;
  const transientErrorStale = input.transientError && !input.hasActiveLock && input.staleForMs > TRANSIENT_ERROR_STALE_MS;

  if (processingStale || transientErrorStale) {
    return {
      action: "recover",
      nextStatus: resolveContinuationStatus(input),
      clearLastError: true,
    };
  }

  return { action: "none" };
}

export function buildSourceStatusCounts(statuses: string[]) {
  const counts = {
    queued: 0,
    processing: 0,
    error: 0,
    paused: 0,
    complete: 0,
    other: 0,
  };

  for (const status of statuses) {
    if (status === "queued") counts.queued += 1;
    else if (status === "processing") counts.processing += 1;
    else if (status === "error") counts.error += 1;
    else if (status === "paused") counts.paused += 1;
    else if (status === "complete") counts.complete += 1;
    else counts.other += 1;
  }

  return counts;
}
