import { toSourceKind } from "@/lib/source-kind";

type ActiveSourceRow = {
  id: number;
  name: string;
  entityKind: string | null | undefined;
  status: string;
};

type SourceProcessorRow = {
  id: number;
  status: string;
  active?: boolean;
  lastError?: string | null;
};

export type ProcessingAttemptState = {
  attempted: boolean;
  sourceId: number | null;
  lockAcquired: boolean;
  outcome: "ok" | "error" | "skipped";
  message?: string;
  error?: string;
};

export function selectNextSourceId(activeSources: Array<Pick<ActiveSourceRow, "id" | "status">>) {
  const nextProcessing = activeSources.find((source) => source.status === "processing");
  const nextQueued = activeSources.find((source) => source.status === "queued");
  return nextProcessing?.id ?? nextQueued?.id ?? null;
}

export function isSafeRetryableSourceError(lastError?: string | null) {
  const message = lastError?.toLowerCase() || "";
  return !(
    message.includes("api_key_service_blocked") ||
    message.includes("youtube key blocked") ||
    message.includes("missing youtube_api_key")
  );
}

export function buildSourceProcessorQueues(labels: SourceProcessorRow[]) {
  const activeSources = labels.filter((item) => item.active !== false);
  const processingIds = activeSources.filter((item) => item.status === "processing").map((item) => item.id);
  const readyIds = activeSources.filter((item) => item.status === "queued").map((item) => item.id);
  const retryableErroredIds = activeSources
    .filter((item) => item.status === "error" && isSafeRetryableSourceError(item.lastError))
    .map((item) => item.id);

  return {
    activeSources,
    processingIds,
    readyIds,
    retryableErroredIds,
    nextSourceId: selectNextSourceId(activeSources),
  };
}

export function createProcessingAttempt(sourceId: number | null): ProcessingAttemptState {
  return {
    attempted: false,
    sourceId,
    lockAcquired: false,
    outcome: "skipped",
  };
}

export function markProcessingAttemptStarted(attempt: ProcessingAttemptState) {
  return {
    ...attempt,
    attempted: true,
  };
}

export function markProcessingAttemptLockBusy(attempt: ProcessingAttemptState) {
  return {
    ...attempt,
    attempted: true,
    outcome: "skipped" as const,
    message: "Worker lock busy",
    error: undefined,
  };
}

export function markProcessingAttemptSuccess(attempt: ProcessingAttemptState, message?: string | null) {
  return {
    ...attempt,
    attempted: true,
    lockAcquired: true,
    outcome: "ok" as const,
    message: message || "Processed one source step.",
    error: undefined,
  };
}

export function markProcessingAttemptError(attempt: ProcessingAttemptState, error: string) {
  return {
    ...attempt,
    attempted: true,
    lockAcquired: true,
    outcome: "error" as const,
    error,
    message: undefined,
  };
}

export function getProcessingAttemptSourceMeta(
  activeSources: ActiveSourceRow[],
  sourceId: number | null,
) {
  if (!sourceId) return null;
  const source = activeSources.find((item) => item.id === sourceId);
  if (!source) {
    return {
      sourceName: `Source ${sourceId}`,
      entityKind: "label" as const,
    };
  }
  return {
    sourceName: source.name || `Source ${sourceId}`,
    entityKind: toSourceKind(source.entityKind),
  };
}
