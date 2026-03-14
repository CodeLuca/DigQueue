export const dynamic = "force-dynamic";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { tracks } from "@/db/schema";
import { requireMutationUser, parseMutationBody } from "@/lib/api-mutation";
import { okJson } from "@/lib/api-response";
import { db } from "@/lib/db";
import { buildTrackTodoMutationResponse } from "@/lib/library-mutation-contract";
import { normalizePositiveIds } from "@/lib/positive-id-list";
import { applyTrackListenedMutationsForUser, applyTrackSavedMutationsForUser } from "@/lib/release-listened-state";
import { mapTrackTodoUpdates } from "@/lib/track-todo-contract";
import { planTrackTodoMutations } from "@/lib/track-todo-mutations";

const schema = z.object({
  trackIds: z.array(z.number().int().positive()).min(1).max(1500),
  field: z.enum(["listened", "saved", "wishlist"]),
  mode: z.enum(["set", "toggle"]).default("toggle"),
  value: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "tracks/todo",
    limit: 80,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const parsed = await parseMutationBody(request, schema);
  if (parsed.response) return parsed.response;

  const normalizedField = parsed.data.field === "wishlist" ? "saved" : parsed.data.field;
  const { trackIds, mode, value } = parsed.data;
  const uniqueTrackIds = normalizePositiveIds(trackIds, { max: 1500 });
  const rows = await db
    .select({ id: tracks.id, releaseId: tracks.releaseId, listened: tracks.listened, saved: tracks.saved })
    .from(tracks)
    .where(and(inArray(tracks.id, uniqueTrackIds), eq(tracks.userId, userId)));
  if (rows.length === 0) {
    return okJson(buildTrackTodoMutationResponse({ tracks: [] }));
  }

  const mutations = planTrackTodoMutations(rows, normalizedField, mode, value);
  const updatedTracks = mapTrackTodoUpdates(mutations);

  if (normalizedField === "listened") {
    await applyTrackListenedMutationsForUser({
      userId,
      source: "api_tracks_todo",
      mutations,
    });
  } else {
    await applyTrackSavedMutationsForUser({
      userId,
      source: "api_tracks_todo",
      mutations,
    });
  }

  return okJson(buildTrackTodoMutationResponse({ tracks: updatedTracks }));
}
