export const dynamic = "force-dynamic";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { tracks } from "@/db/schema";
import { requireMutationUser, parseMutationBody } from "@/lib/api-mutation";
import { okJson } from "@/lib/api-response";
import { db } from "@/lib/db";
import { buildEmptyReleaseReviewedResponse, buildReleaseReviewedResponse } from "@/lib/release-library-contract";
import { markReleaseReviewedForUser } from "@/lib/release-listened-state";
import { mapTrackTodoUpdates } from "@/lib/track-todo-contract";
import { resolveUserReleaseIdentity } from "@/lib/user-release-identity";

const schema = z.object({
  releaseId: z.number().int().positive(),
});
export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "releases/reviewed",
    limit: 45,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const parsed = await parseMutationBody(request, schema);
  if (parsed.response) return parsed.response;

  const releaseIdentity = await resolveUserReleaseIdentity(userId, parsed.data.releaseId);
  const affectedReleaseIds = releaseIdentity.localReleaseIds;
  if (affectedReleaseIds.length === 0) {
    return okJson(buildEmptyReleaseReviewedResponse(releaseIdentity.externalDiscogsReleaseId));
  }
  const releaseTracks = await db.query.tracks.findMany({
    where: and(inArray(tracks.releaseId, affectedReleaseIds), eq(tracks.userId, userId)),
    columns: { id: true, releaseId: true, listened: true, saved: true },
  });
  if (releaseTracks.length === 0) {
    return okJson(buildEmptyReleaseReviewedResponse(releaseIdentity.externalDiscogsReleaseId));
  }

  await markReleaseReviewedForUser({
    userId,
    source: "api_release_reviewed",
    releaseTracks,
    affectedReleaseIds,
  });

  return okJson(buildReleaseReviewedResponse({
    externalDiscogsReleaseId: releaseIdentity.externalDiscogsReleaseId,
    affectedReleaseIds,
    tracks: mapTrackTodoUpdates(
      releaseTracks.map((track) => ({
        ...track,
        listened: true,
      })),
    ),
  }));
}
