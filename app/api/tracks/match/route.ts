export const dynamic = "force-dynamic";

import { z } from "zod";
import { requireMutationUser, parseMutationBody } from "@/lib/api-mutation";
import { okJson } from "@/lib/api-response";
import { chooseTrackMatch } from "@/lib/processing";
import { buildTrackMatchSelectionResponse } from "@/lib/track-match-contract";

const schema = z.object({
  trackId: z.number().int().positive(),
  matchId: z.number().int().positive(),
});

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "tracks/match",
    limit: 90,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const parsed = await parseMutationBody(request, schema);
  if (parsed.response) return parsed.response;

  await chooseTrackMatch(parsed.data.trackId, parsed.data.matchId, userId);

  return okJson(buildTrackMatchSelectionResponse({
    trackId: parsed.data.trackId,
    matchId: parsed.data.matchId,
  }));
}
