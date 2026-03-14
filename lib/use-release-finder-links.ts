"use client";

import {
  fetchReleaseFinderLinksClient,
  type FinderLinksApiResponse,
} from "@/lib/client-release-data";
import { createClientResourceStore, useClientResource } from "@/lib/client-resource-store";

const releaseFinderLinksStore = createClientResourceStore<number, FinderLinksApiResponse>({
  load: fetchReleaseFinderLinksClient,
  getErrorMessage: (error) => error instanceof Error ? error.message : "Could not find links",
});

export async function loadReleaseFinderLinksClient(releaseId: number) {
  return releaseFinderLinksStore.load(releaseId);
}

export function useReleaseFinderLinks(
  releaseId: number | null | undefined,
  options?: { enabled?: boolean; missingMessage?: string },
) {
  return useClientResource(releaseFinderLinksStore, releaseId, options);
}
