export const dynamic = "force-dynamic";

import { z } from "zod";
import { requireMutationUser, parseMutationBody } from "@/lib/api-mutation";
import { okJson } from "@/lib/api-response";
import { buildRecommendationDismissResponse } from "@/lib/library-mutation-contract";
import { resolveRecommendationReleaseTargetsForIdentity } from "@/lib/recommendation-feedback";
import { logFeedbackEvent } from "@/lib/recommendations";
import { resolveUserReleaseIdentity } from "@/lib/user-release-identity";

const schema = z.object({
  trackId: z.number().int().positive().optional(),
  releaseId: z.number().int().positive().optional(),
  eventType: z.enum(["dismiss"]),
}).refine((value) => typeof value.trackId === "number" || typeof value.releaseId === "number", {
  message: "trackId or releaseId is required",
});

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "recommendations/feedback",
    limit: 180,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const parsed = await parseMutationBody(request, schema);
  if (parsed.response) return parsed.response;

  const releaseIdentity =
    typeof parsed.data.releaseId === "number"
      ? await resolveUserReleaseIdentity(userId, parsed.data.releaseId)
      : null;
  const releaseTargets = resolveRecommendationReleaseTargetsForIdentity(releaseIdentity, parsed.data.releaseId ?? null);

  await logFeedbackEvent({
    eventType: parsed.data.eventType,
    source: "api_recommendations_feedback",
    trackId: parsed.data.trackId ?? null,
    releaseId: releaseTargets.releaseId,
    externalDiscogsReleaseId: releaseTargets.externalDiscogsReleaseId,
    userId,
  });

  return okJson(buildRecommendationDismissResponse({
    trackId: parsed.data.trackId ?? null,
    releaseId: releaseTargets.releaseId ?? parsed.data.releaseId ?? null,
  }));
}
