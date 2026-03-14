import type { UserReleaseIdentity } from "@/lib/user-release-identity";

export function resolveRecommendationReleaseTargets(input: {
  requestedReleaseId?: number | null;
  matchedLocalReleaseId?: number | null;
}) {
  const requestedReleaseId =
    typeof input.requestedReleaseId === "number" && Number.isFinite(input.requestedReleaseId) && input.requestedReleaseId > 0
      ? input.requestedReleaseId
      : null;
  const matchedLocalReleaseId =
    typeof input.matchedLocalReleaseId === "number" && Number.isFinite(input.matchedLocalReleaseId) && input.matchedLocalReleaseId > 0
      ? input.matchedLocalReleaseId
      : null;

  if (!requestedReleaseId) {
    return {
      releaseId: null,
      externalDiscogsReleaseId: null,
    };
  }

  return {
    releaseId: matchedLocalReleaseId,
    externalDiscogsReleaseId: matchedLocalReleaseId ? null : requestedReleaseId,
  };
}

export function resolveRecommendationReleaseTargetsForIdentity(
  identity: Pick<UserReleaseIdentity, "externalDiscogsReleaseId" | "primaryLocalReleaseId"> | null,
  requestedReleaseId?: number | null,
) {
  return resolveRecommendationReleaseTargets({
    requestedReleaseId: identity?.externalDiscogsReleaseId ?? requestedReleaseId ?? null,
    matchedLocalReleaseId: identity?.primaryLocalReleaseId ?? null,
  });
}
