"use client";

import {
  getSourceNextId,
  isSourceSyncDashboardView,
  logSourceProcessingAttempt,
  subscribeSourceNextClient,
} from "@/lib/client-source-next";

export const SOURCE_PROGRESS_REFRESH_MIN_GAP_MS = 2800;

export function subscribeSourceProgressRefresh(
  input: {
    pathname: string;
    search: string;
    onRefresh: () => void;
    shouldRefresh?: (now: number) => boolean;
    markRefreshed?: (now: number) => void;
  },
) {
  const isSourceView = isSourceSyncDashboardView(input.pathname, input.search);
  if (!isSourceView) return () => {};

  return subscribeSourceNextClient((nextData) => {
    logSourceProcessingAttempt(nextData);
    const nextSourceId = getSourceNextId(nextData);
    if (!nextSourceId) return;

    const now = Date.now();
    if (input.shouldRefresh && !input.shouldRefresh(now)) return;
    input.markRefreshed?.(now);
    input.onRefresh();
  }, { priority: "high" });
}
