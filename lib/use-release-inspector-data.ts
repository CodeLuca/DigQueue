"use client";

import { useReleaseDetails } from "@/lib/release-details-client-store";
import { useReleaseFinderLinks } from "@/lib/use-release-finder-links";

export function useReleaseInspectorData(
  releaseId: number | null | undefined,
  expandedOpen: boolean,
) {
  const details = useReleaseDetails(releaseId, {
    enabled: expandedOpen,
    missingMessage: "No release selected.",
  });

  const links = useReleaseFinderLinks(releaseId, {
    enabled: expandedOpen,
    missingMessage: "No release selected.",
  });

  return {
    releaseDetails: details.result,
    releaseDetailsLoading: details.pending,
    releaseDetailsError: details.error,
    releaseLinks: links.result,
    releaseLinksLoading: links.pending,
    releaseLinksError: links.error,
  };
}
