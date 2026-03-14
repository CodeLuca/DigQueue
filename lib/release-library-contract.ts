import { normalizePositiveIds } from "@/lib/positive-id-list";
import type { TrackTodoUpdate } from "@/lib/track-todo-contract";

export type ReleaseReviewedResponse = {
  updated: number;
  externalDiscogsReleaseId: number | null;
  affectedReleaseIds: number[];
  tracks: TrackTodoUpdate[];
};

export function buildEmptyReleaseReviewedResponse(
  externalDiscogsReleaseId: number | null,
): ReleaseReviewedResponse {
  return {
    updated: 0,
    externalDiscogsReleaseId,
    affectedReleaseIds: [],
    tracks: [],
  };
}

export function buildReleaseReviewedResponse(input: {
  externalDiscogsReleaseId: number | null;
  affectedReleaseIds: number[];
  tracks: TrackTodoUpdate[];
}): ReleaseReviewedResponse {
  return {
    updated: input.tracks.length,
    externalDiscogsReleaseId: input.externalDiscogsReleaseId,
    affectedReleaseIds: input.affectedReleaseIds,
    tracks: input.tracks,
  };
}

export type ReleaseWishlistResponse = {
  releaseId: number;
  externalDiscogsReleaseId: number | null;
  wishlist: boolean;
  external: boolean;
  discogsSynced: boolean;
  localConfirmedAll: boolean;
  affectedReleaseIds: number[];
  affectedTrackCount: number;
};

export function buildReleaseWishlistResponse(input: ReleaseWishlistResponse): ReleaseWishlistResponse {
  return {
    ...input,
    affectedReleaseIds: normalizePositiveIds(input.affectedReleaseIds),
  };
}

export function normalizeReleaseWishlistResponse(
  body: Partial<ReleaseWishlistResponse>,
  requestedReleaseId: number,
) {
  return {
    releaseId: typeof body.releaseId === "number" ? body.releaseId : requestedReleaseId,
    externalDiscogsReleaseId:
      typeof body.externalDiscogsReleaseId === "number" ? body.externalDiscogsReleaseId : null,
    wishlist: Boolean(body.wishlist),
    external: body.external === true,
    discogsSynced: body.discogsSynced !== false,
    localConfirmedAll: body.localConfirmedAll !== false,
    affectedReleaseIds: normalizePositiveIds(body.affectedReleaseIds ?? [requestedReleaseId]),
    affectedTrackCount: typeof body.affectedTrackCount === "number" ? body.affectedTrackCount : 0,
  };
}
