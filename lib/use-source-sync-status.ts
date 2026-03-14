"use client";

import { useMemo } from "react";
import { getLatestSourceNextClient, subscribeSourceNextClient } from "@/lib/client-source-next";
import type { SourceNextResponse } from "@/lib/source-next-response";
import { buildSourceSyncStatusViewModel } from "@/lib/source-sync-status-view";
import { useClientStoreValue } from "@/lib/use-client-store-value";

export function useSourceSyncStatus(initialProcessingCount: number) {
  const fallbackData = useMemo<Partial<SourceNextResponse>>(() => ({
    counts: {
      queued: 0,
      processing: initialProcessingCount,
      error: 0,
      paused: 0,
      complete: 0,
      other: 0,
    },
    processingSources: [],
    syncTelemetry: null,
    blocker: null,
  }), [initialProcessingCount]);

  const data = useClientStoreValue(
    (callback) => subscribeSourceNextClient(() => callback(), { priority: "high", emitLatest: true }),
    () => getLatestSourceNextClient() ?? fallbackData,
  );

  const view = useMemo(
    () => buildSourceSyncStatusViewModel(data, initialProcessingCount),
    [data, initialProcessingCount],
  );

  return {
    data,
    view,
  };
}
