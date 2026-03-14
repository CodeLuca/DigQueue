import { parseDiscogsReleaseIdFromUrl } from "@/lib/discogs-release-id";

type FeedbackTrackTarget = {
  id: number;
  releaseId: number;
};

type FeedbackReleaseTarget = {
  id: number;
  labelId: number | null;
  discogsUrl?: string | null;
};

export function canonicalizeFeedbackTargets(input: {
  track?: FeedbackTrackTarget | null;
  release?: FeedbackReleaseTarget | null;
  requestedTrackId?: number | null;
  requestedReleaseId?: number | null;
  requestedExternalDiscogsReleaseId?: number | null;
  requestedLabelId?: number | null;
  labelIsValid?: boolean;
}) {
  const trackId = input.track?.id ?? null;
  const releaseId = input.track?.releaseId ?? input.release?.id ?? null;
  const labelId =
    input.release?.labelId ??
    (input.labelIsValid ? (input.requestedLabelId ?? null) : null);
  const releaseExternalDiscogsId = parseDiscogsReleaseIdFromUrl(input.release?.discogsUrl);
  const externalDiscogsReleaseId =
    typeof releaseExternalDiscogsId === "number"
      ? releaseExternalDiscogsId
      : (input.requestedExternalDiscogsReleaseId ?? null);

  return {
    trackId,
    releaseId,
    labelId,
    externalDiscogsReleaseId,
  };
}
