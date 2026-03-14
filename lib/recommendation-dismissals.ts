import { parseDiscogsReleaseIdFromUrl } from "@/lib/discogs-release-id";

type FeedbackDismissRow = {
  eventType: string;
  trackId?: number | null;
  releaseId?: number | null;
  externalDiscogsReleaseId?: number | null;
};

export function buildDismissedTrackSet(rows: FeedbackDismissRow[]) {
  return new Set(
    rows
      .filter((row) => row.eventType === "dismiss" && typeof row.trackId === "number")
      .map((row) => row.trackId as number),
  );
}

export function buildDismissedReleaseSets(rows: FeedbackDismissRow[]) {
  const localReleaseIds = new Set<number>();
  const externalDiscogsReleaseIds = new Set<number>();

  for (const row of rows) {
    if (row.eventType !== "dismiss") continue;
    if (typeof row.releaseId === "number") {
      localReleaseIds.add(row.releaseId);
    }
    if (typeof row.externalDiscogsReleaseId === "number") {
      externalDiscogsReleaseIds.add(row.externalDiscogsReleaseId);
    }
  }

  return { localReleaseIds, externalDiscogsReleaseIds };
}

export function isReleaseDismissed(input: {
  releaseId?: number | null;
  discogsUrl?: string | null;
  dismissedLocalReleaseIds: Set<number>;
  dismissedExternalDiscogsReleaseIds: Set<number>;
}) {
  if (typeof input.releaseId === "number" && input.dismissedLocalReleaseIds.has(input.releaseId)) {
    return true;
  }
  const externalDiscogsReleaseId = parseDiscogsReleaseIdFromUrl(input.discogsUrl);
  return typeof externalDiscogsReleaseId === "number" && input.dismissedExternalDiscogsReleaseIds.has(externalDiscogsReleaseId);
}
