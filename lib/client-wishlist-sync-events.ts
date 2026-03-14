"use client";

import { WISHLIST_SYNC_MUTATED_EVENT } from "@/lib/client-events";
import { dispatchClientEvent, readClientEventDetail, subscribeClientEvent } from "@/lib/client-event-bus";

export type WishlistSyncMutationReason = "auto" | "manual" | "saved-to-discogs";

export type WishlistSyncMutatedDetail = {
  reason: WishlistSyncMutationReason;
};

export function dispatchWishlistSyncMutated(detail: WishlistSyncMutatedDetail) {
  dispatchClientEvent(WISHLIST_SYNC_MUTATED_EVENT, detail);
}

export function getWishlistSyncMutatedDetail(event: Event): WishlistSyncMutatedDetail | null {
  const detail = readClientEventDetail<Partial<WishlistSyncMutatedDetail>>(event);
  if (!detail) return null;
  if (detail.reason !== "auto" && detail.reason !== "manual" && detail.reason !== "saved-to-discogs") return null;
  return { reason: detail.reason };
}

export function subscribeWishlistSyncMutated(handler: (detail: WishlistSyncMutatedDetail) => void) {
  return subscribeClientEvent(WISHLIST_SYNC_MUTATED_EVENT, handler, { parse: getWishlistSyncMutatedDetail });
}
