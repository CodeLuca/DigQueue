import { getVisibleLabelError, isTransientLabelError } from "@/lib/utils";

type SourceLike = {
  active: boolean;
  status: string;
  lastError: string | null;
  tracksFullyLoaded?: boolean | null;
  currentPage?: number | null;
  totalPages?: number | null;
};

export function normalizeSourceStatus(active: boolean, status: string, lastError: string | null) {
  if (!active && status === "processing") return "paused";
  if (status === "error" && isTransientLabelError(lastError)) return "processing";
  return status;
}

export function getEffectiveSourceStatus(source: SourceLike) {
  const normalized = normalizeSourceStatus(source.active, source.status, source.lastError);
  return source.tracksFullyLoaded ? "complete" : normalized;
}

export function getSourceProgressPages(source: SourceLike) {
  const totalPages = Math.max(1, Number(source.totalPages ?? 1));
  const currentPage = Math.min(totalPages, Math.max(1, Number(source.currentPage ?? 1)));
  const scannedPages = Math.min(totalPages, Math.max(0, currentPage - 1));
  const hasMorePages = currentPage <= totalPages;
  return {
    currentPage,
    totalPages,
    scannedPages,
    hasMorePages,
  };
}

export function getSourceProgressState(source: SourceLike) {
  const effectiveStatus = getEffectiveSourceStatus(source);
  const { scannedPages, totalPages, hasMorePages } = getSourceProgressPages(source);

  if (!source.active) return "Inactive";
  if (effectiveStatus === "processing") {
    return hasMorePages
      ? `Scanning Discogs pages (${scannedPages}/${totalPages})`
      : "Loading remaining release details and playable sources";
  }
  if (effectiveStatus === "queued") return "Waiting in ingestion queue";
  if (effectiveStatus === "error") return "Stopped by error";
  if (effectiveStatus === "complete") return "Complete";
  return effectiveStatus;
}

export function getSourceStatusLabel(status: string) {
  if (status === "processing") return "Processing";
  if (status === "queued") return "Queued";
  if (status === "error") return "Error";
  if (status === "paused") return "Paused";
  if (status === "complete") return "Complete";
  return status;
}

export function getSourceVisibleError(lastError: string | null | undefined) {
  return getVisibleLabelError(lastError);
}

export function getSourceViewModel(source: SourceLike) {
  const effectiveStatus = getEffectiveSourceStatus(source);
  return {
    effectiveStatus,
    statusLabel: getSourceStatusLabel(effectiveStatus),
    visibleError: getSourceVisibleError(source.lastError),
    progressState: getSourceProgressState(source),
    progressPages: getSourceProgressPages(source),
  };
}
