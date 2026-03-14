"use client";

import { useEffect, useMemo, useState } from "react";
import {
  subscribeRecommendationDismissed,
  subscribeReleaseWishlistUpdated,
  subscribeTrackTodoUpdated,
} from "@/lib/client-library-events";
import { subscribeQueueTrackEnqueued } from "@/lib/client-queue-events";
import {
  filterExternalRecommendationsByReleaseIds,
  removeExternalRecommendationByReleaseId,
  removeRecommendationTrackById,
  updateRecommendationReleaseWishlistState,
  updateRecommendationSavedState,
} from "@/lib/client-recommendation-state";

type RecommendationTrackItem = {
  id: number;
  releaseId: number;
  saved?: boolean;
  release?: Record<string, unknown> | null;
};

type RecommendationReleaseItem = {
  releaseId: number;
};

export function useRecommendationFeedState<
  TTrackItem extends RecommendationTrackItem,
  TReleaseItem extends RecommendationReleaseItem,
>(
  initialItems: TTrackItem[],
  initialExternalItems: TReleaseItem[],
) {
  const [items, setItems] = useState(initialItems);
  const [externalItems, setExternalItems] = useState(initialExternalItems);
  const [view, setView] = useState<"all" | "in_library" | "outside_library">("all");

  const canShow = useMemo(() => items.length > 0 || externalItems.length > 0, [externalItems.length, items.length]);
  const visibleLibraryItems = useMemo(() => (view === "outside_library" ? [] : items), [items, view]);
  const visibleExternalItems = useMemo(() => (view === "in_library" ? [] : externalItems), [externalItems, view]);

  useEffect(() => {
    return subscribeTrackTodoUpdated(({ trackId, field, value }) => {
      if (field === "listened" && value) {
        setItems((prev) => removeRecommendationTrackById(prev, trackId));
        return;
      }

      if (field === "saved") {
        setItems((prev) => updateRecommendationSavedState(prev, trackId, value));
      }
    });
  }, []);

  useEffect(() => {
    return subscribeReleaseWishlistUpdated(({ releaseIds, value }) => {
      setItems((prev) => updateRecommendationReleaseWishlistState(prev, releaseIds, value));

      if (value) {
        setExternalItems((prev) => filterExternalRecommendationsByReleaseIds(prev, releaseIds));
      }
    });
  }, []);

  useEffect(() => {
    return subscribeQueueTrackEnqueued(({ trackId }) => {
      if (typeof trackId === "number") {
        setItems((prev) => removeRecommendationTrackById(prev, trackId));
      }
    });
  }, []);

  useEffect(() => {
    return subscribeRecommendationDismissed(({ trackId, releaseId }) => {
      if (trackId !== null) {
        setItems((prev) => removeRecommendationTrackById(prev, trackId));
      }
      if (releaseId !== null) {
        setExternalItems((prev) => removeExternalRecommendationByReleaseId(prev, releaseId));
      }
    });
  }, []);

  return {
    canShow,
    externalItems,
    items,
    setExternalItems,
    setItems,
    setView,
    view,
    visibleExternalItems,
    visibleLibraryItems,
  };
}
