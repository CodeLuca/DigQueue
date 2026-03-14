import type { TrackTodoUpdate } from "@/lib/track-todo-contract";

export type TrackTodoMutationResponse = {
  updated: number;
  tracks: TrackTodoUpdate[];
};

export type RecommendationDismissResponse = {
  trackId?: number | null;
  releaseId?: number | null;
};

export function buildTrackTodoMutationResponse(input: {
  tracks: TrackTodoUpdate[];
}): TrackTodoMutationResponse {
  return {
    updated: input.tracks.length,
    tracks: input.tracks,
  };
}

export function normalizeTrackTodoMutationResponse(
  body: Partial<{
    updated: number;
    tracks: TrackTodoUpdate[];
  }>,
): TrackTodoMutationResponse {
  return {
    updated: typeof body.updated === "number" ? body.updated : 0,
    tracks: Array.isArray(body.tracks) ? body.tracks : [],
  };
}

export function buildRecommendationDismissResponse(input: {
  trackId?: number | null;
  releaseId?: number | null;
}): RecommendationDismissResponse {
  return {
    trackId: typeof input.trackId === "number" && input.trackId > 0 ? input.trackId : null,
    releaseId: typeof input.releaseId === "number" && input.releaseId > 0 ? input.releaseId : null,
  };
}

export function normalizeRecommendationDismissResponse(
  body: Partial<{
    trackId: number | null;
    releaseId: number | null;
  }>,
  fallback: {
    trackId?: number;
    releaseId?: number;
  },
): RecommendationDismissResponse {
  return {
    trackId:
      typeof body.trackId === "number"
        ? body.trackId
        : typeof fallback.trackId === "number"
          ? fallback.trackId
          : null,
    releaseId:
      typeof body.releaseId === "number"
        ? body.releaseId
        : typeof fallback.releaseId === "number"
          ? fallback.releaseId
          : null,
  };
}
