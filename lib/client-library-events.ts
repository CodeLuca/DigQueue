import {
  RECOMMENDATION_DISMISSED_EVENT,
  RELEASE_WISHLIST_UPDATED_EVENT,
  TRACK_TODO_UPDATED_EVENT,
} from "@/lib/client-events";
import { dispatchClientEvent, readClientEventDetail, subscribeClientEvent } from "@/lib/client-event-bus";
import { normalizePositiveIds } from "@/lib/positive-id-list";

export type TrackTodoField = "listened" | "saved";

export type TrackTodoUpdatedDetail = {
  trackId: number;
  field: TrackTodoField;
  value: boolean;
};

export type ReleaseWishlistUpdatedDetail = {
  releaseId: number | null;
  releaseIds: number[];
  value: boolean;
};

export type RecommendationDismissedDetail = {
  trackId: number | null;
  releaseId: number | null;
};

export function dispatchTrackTodoUpdate(detail: TrackTodoUpdatedDetail) {
  dispatchClientEvent(TRACK_TODO_UPDATED_EVENT, detail);
}

export function dispatchReleaseWishlistUpdated(detail: {
  releaseId?: number | null;
  releaseIds?: number[];
  value: boolean;
}) {
  dispatchClientEvent(RELEASE_WISHLIST_UPDATED_EVENT, {
    releaseId: typeof detail.releaseId === "number" && detail.releaseId > 0 ? detail.releaseId : null,
    releaseIds: normalizePositiveIds(detail.releaseIds ?? []),
    value: detail.value,
  } satisfies ReleaseWishlistUpdatedDetail);
}

export function dispatchRecommendationDismissed(detail: {
  trackId?: number | null;
  releaseId?: number | null;
}) {
  dispatchClientEvent(RECOMMENDATION_DISMISSED_EVENT, {
    trackId: typeof detail.trackId === "number" && detail.trackId > 0 ? detail.trackId : null,
    releaseId: typeof detail.releaseId === "number" && detail.releaseId > 0 ? detail.releaseId : null,
  } satisfies RecommendationDismissedDetail);
}

export function getTrackTodoUpdatedDetail(event: Event): TrackTodoUpdatedDetail | null {
  const detail = readClientEventDetail<Partial<TrackTodoUpdatedDetail>>(event);
  if (
    !detail ||
    typeof detail.trackId !== "number" ||
    (detail.field !== "saved" && detail.field !== "listened") ||
    typeof detail.value !== "boolean"
  ) {
    return null;
  }
  return {
    trackId: detail.trackId,
    field: detail.field,
    value: detail.value,
  };
}

export function getReleaseWishlistUpdatedDetail(event: Event): ReleaseWishlistUpdatedDetail | null {
  const detail = readClientEventDetail<Partial<ReleaseWishlistUpdatedDetail>>(event);
  if (!detail || typeof detail.value !== "boolean") return null;
  const releaseId = typeof detail.releaseId === "number" && detail.releaseId > 0 ? detail.releaseId : null;
  const releaseIds = normalizePositiveIds([...(detail.releaseIds ?? []), releaseId]);
  if (releaseIds.length === 0) return null;
  return { releaseId, releaseIds, value: detail.value };
}

export function getRecommendationDismissedDetail(event: Event): RecommendationDismissedDetail | null {
  const detail = readClientEventDetail<Partial<RecommendationDismissedDetail>>(event);
  if (!detail) return null;
  const trackId = typeof detail.trackId === "number" && detail.trackId > 0 ? detail.trackId : null;
  const releaseId = typeof detail.releaseId === "number" && detail.releaseId > 0 ? detail.releaseId : null;
  if (trackId === null && releaseId === null) return null;
  return { trackId, releaseId };
}

export function subscribeTrackTodoUpdated(handler: (detail: TrackTodoUpdatedDetail) => void) {
  return subscribeClientEvent(TRACK_TODO_UPDATED_EVENT, handler, { parse: getTrackTodoUpdatedDetail });
}

export function subscribeReleaseWishlistUpdated(handler: (detail: ReleaseWishlistUpdatedDetail) => void) {
  return subscribeClientEvent(RELEASE_WISHLIST_UPDATED_EVENT, handler, { parse: getReleaseWishlistUpdatedDetail });
}

export function subscribeRecommendationDismissed(handler: (detail: RecommendationDismissedDetail) => void) {
  return subscribeClientEvent(RECOMMENDATION_DISMISSED_EVENT, handler, { parse: getRecommendationDismissedDetail });
}
