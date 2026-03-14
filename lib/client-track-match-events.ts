"use client";

import { TRACK_MATCH_UPDATED_EVENT } from "@/lib/client-events";
import { dispatchClientEvent, readClientEventDetail, subscribeClientEvent } from "@/lib/client-event-bus";

export type TrackMatchUpdatedDetail = {
  trackId?: number | null;
  matchId?: number | null;
};

export function dispatchTrackMatchUpdatedEvent(detail: TrackMatchUpdatedDetail) {
  dispatchClientEvent(TRACK_MATCH_UPDATED_EVENT, detail);
}

export function getTrackMatchUpdatedDetail(event: Event): TrackMatchUpdatedDetail | null {
  const detail = readClientEventDetail<Partial<TrackMatchUpdatedDetail>>(event);
  if (!detail) return null;
  return {
    trackId: typeof detail.trackId === "number" ? detail.trackId : null,
    matchId: typeof detail.matchId === "number" ? detail.matchId : null,
  };
}

export function subscribeTrackMatchUpdated(handler: (detail: TrackMatchUpdatedDetail) => void) {
  return subscribeClientEvent(TRACK_MATCH_UPDATED_EVENT, handler, { parse: getTrackMatchUpdatedDetail });
}
