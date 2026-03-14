import {
  createAffectedReleaseIdSet,
  filterItemsByAffectedReleaseIds,
  mapItemsByAffectedReleaseIds,
} from "@/lib/client-release-wishlist-state";

type RecommendationTrackItem = {
  id: number;
  releaseId: number;
  saved?: boolean;
  release?: Record<string, unknown> | null;
};

type RecommendationReleaseItem = {
  releaseId: number;
};

export function removeRecommendationTrackById<TItem extends RecommendationTrackItem>(
  items: TItem[],
  trackId: number,
) {
  return items.filter((item) => item.id !== trackId);
}

export function removeExternalRecommendationByReleaseId<TItem extends RecommendationReleaseItem>(
  items: TItem[],
  releaseId: number,
) {
  return items.filter((item) => item.releaseId !== releaseId);
}

export function updateRecommendationSavedState<TItem extends RecommendationTrackItem>(
  items: TItem[],
  trackId: number,
  saved: boolean,
) {
  return items.map((item) => (item.id === trackId ? { ...item, saved } : item));
}

export function updateRecommendationReleaseWishlistState<TItem extends RecommendationTrackItem>(
  items: TItem[],
  releaseIds: number[],
  value: boolean,
) {
  const affected = createAffectedReleaseIdSet(releaseIds);
  return mapItemsByAffectedReleaseIds(items, affected, (item) => item.releaseId, (item) => ({
    ...item,
    release: {
      ...(item.release ?? {}),
      wishlist: value,
    },
  }));
}

export function filterExternalRecommendationsByReleaseIds<TItem extends RecommendationReleaseItem>(
  items: TItem[],
  releaseIds: number[],
) {
  const affected = createAffectedReleaseIdSet(releaseIds);
  return filterItemsByAffectedReleaseIds(items, affected, (item) => item.releaseId);
}
