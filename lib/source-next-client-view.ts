import type { SourceNextLike } from "@/lib/source-next-client-store";
import { normalizeDashboardTab } from "@/lib/app-tabs";

export function getSourceNextId(payload: SourceNextLike | null | undefined) {
  return payload?.nextSourceId ?? payload?.nextLabelId ?? null;
}

export function logSourceProcessingAttempt(payload: SourceNextLike | null | undefined) {
  const attempt = payload?.processingAttempt;
  if (!attempt) return;
  if (attempt.outcome === "error") {
    console.error(
      `[label-sync-daemon] source=${attempt.sourceId ?? "unknown"} error=${attempt.error ?? "unknown"}`,
    );
    return;
  }
  if (attempt.attempted) {
    console.debug(
      `[label-sync-daemon] source=${attempt.sourceId ?? "unknown"} outcome=${attempt.outcome ?? "unknown"} message=${attempt.message ?? ""}`,
    );
  }
}

function getDashboardTab(search: string | undefined) {
  const params = new URLSearchParams(search ?? "");
  return params.get("tab");
}

export function isSourceSyncDashboardView(pathname: string, search?: string) {
  if (pathname.startsWith("/labels/")) return true;
  if (pathname !== "/") return false;
  const tab = getDashboardTab(search);
  return normalizeDashboardTab(tab) === "sources";
}

export function isHighPrioritySourceSyncView(pathname: string, search?: string) {
  return isSourceSyncDashboardView(pathname, search);
}
