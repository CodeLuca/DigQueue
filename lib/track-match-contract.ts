export type TrackMatchSelectionResponse = {
  trackId: number;
  matchId: number;
};

export function buildTrackMatchSelectionResponse(input: {
  trackId: number;
  matchId: number;
}): TrackMatchSelectionResponse {
  return {
    trackId: input.trackId,
    matchId: input.matchId,
  };
}

export function normalizeTrackMatchSelectionResponse(
  body: Partial<{
    trackId: number;
    matchId: number;
  }>,
  fallback: {
    trackId: number;
    matchId: number;
  },
): TrackMatchSelectionResponse {
  return {
    trackId: typeof body.trackId === "number" ? body.trackId : fallback.trackId,
    matchId: typeof body.matchId === "number" ? body.matchId : fallback.matchId,
  };
}
