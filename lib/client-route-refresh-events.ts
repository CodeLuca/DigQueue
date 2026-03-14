"use client";

import { subscribeAccountStateMutated } from "@/lib/client-account-events";
import {
  subscribeRecommendationDismissed,
  subscribeReleaseWishlistUpdated,
  subscribeTrackTodoUpdated,
} from "@/lib/client-library-events";
import { subscribeQueueStateMutated } from "@/lib/client-queue-events";
import { subscribeSourceStateMutated } from "@/lib/client-source-events";
import { subscribeTrackMatchUpdated } from "@/lib/client-track-match-events";
import { subscribeWishlistSyncMutated } from "@/lib/client-wishlist-sync-events";

export function subscribeRouteRefreshMutationEvents(callback: () => void) {
  const unsubscribeAccountState = subscribeAccountStateMutated(callback);
  const unsubscribeTrackTodo = subscribeTrackTodoUpdated(callback);
  const unsubscribeReleaseWishlist = subscribeReleaseWishlistUpdated(callback);
  const unsubscribeRecommendationDismissed = subscribeRecommendationDismissed(callback);
  const unsubscribeQueueState = subscribeQueueStateMutated(callback);
  const unsubscribeSourceState = subscribeSourceStateMutated(callback);
  const unsubscribeTrackMatch = subscribeTrackMatchUpdated(callback);
  const unsubscribeWishlistSync = subscribeWishlistSyncMutated(callback);

  return () => {
    unsubscribeAccountState();
    unsubscribeTrackTodo();
    unsubscribeReleaseWishlist();
    unsubscribeRecommendationDismissed();
    unsubscribeQueueState();
    unsubscribeSourceState();
    unsubscribeTrackMatch();
    unsubscribeWishlistSync();
  };
}
