"use client";

import {
  fetchReleaseDetailsClient,
  type ReleaseDetailsApiResponse,
} from "@/lib/client-release-data";
import { createClientResourceStore, useClientResource } from "@/lib/client-resource-store";

const releaseDetailsStore = createClientResourceStore<number, ReleaseDetailsApiResponse>({
  load: fetchReleaseDetailsClient,
  getErrorMessage: (error) => error instanceof Error ? error.message : "Unable to load release info.",
});

export function loadReleaseDetailsClient(releaseId: number) {
  return releaseDetailsStore.load(releaseId);
}

export function useReleaseDetails(
  releaseId: number | null | undefined,
  options?: { enabled?: boolean; missingMessage?: string },
) {
  return useClientResource(releaseDetailsStore, releaseId, options);
}
