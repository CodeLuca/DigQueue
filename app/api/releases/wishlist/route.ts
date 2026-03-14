export const dynamic = "force-dynamic";

import { z } from "zod";
import { requireMutationUser, parseMutationBody } from "@/lib/api-mutation";
import { errorJson, okJson } from "@/lib/api-response";
import { buildReleaseWishlistResponse } from "@/lib/release-library-contract";
import { updateReleaseWishlistForUser } from "@/lib/release-wishlist-state";

const schema = z.object({
  releaseId: z.number().int().positive(),
  mode: z.enum(["toggle", "set"]).default("toggle"),
  value: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "releases/wishlist",
    limit: 60,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const parsed = await parseMutationBody(request, schema);
  if (parsed.response) return parsed.response;

  const result = await updateReleaseWishlistForUser({
    userId,
    requestedReleaseId: parsed.data.releaseId,
    mode: parsed.data.mode,
    value: parsed.data.value,
    feedbackSource: "api_release_wishlist",
  });
  if (result.externalOnlySyncFailed) {
    return errorJson("Discogs sync failed for external release.", { status: 502 });
  }

  return okJson(buildReleaseWishlistResponse({
    releaseId: result.requestedReleaseId,
    externalDiscogsReleaseId: result.externalDiscogsReleaseId,
    wishlist: result.nextWishlist,
    external: result.external,
    discogsSynced: result.discogsSynced,
    localConfirmedAll: result.localConfirmedAll,
    affectedReleaseIds: result.affectedReleaseIds,
    affectedTrackCount: result.affectedTrackCount,
  }));
}
