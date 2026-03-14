import { type ReleaseWishlistSyncTarget, filterConfirmedReleaseWishlistSyncTargets } from "@/lib/release-wishlist-sync";

export function resolveReleaseWishlistFeedbackEvent(input: {
  currentWishlist: boolean;
  nextWishlist: boolean;
}): "record_wishlist_add" | "record_wishlist_remove" | null {
  if (input.currentWishlist === input.nextWishlist) return null;
  return input.nextWishlist ? "record_wishlist_add" : "record_wishlist_remove";
}

export function shouldLogReleaseWishlistFeedback(input: {
  feedbackEventType: "record_wishlist_add" | "record_wishlist_remove" | null;
  hasLocalRows: boolean;
  localConfirmedAll: boolean;
  discogsSynced: boolean;
}) {
  if (!input.feedbackEventType) return false;
  if (input.hasLocalRows) return input.localConfirmedAll;
  return input.discogsSynced;
}

export function selectConfirmedReleaseWishlistFeedbackTargets(input: {
  targets: ReleaseWishlistSyncTarget[];
  confirmedReleaseIds: Iterable<number>;
}) {
  return filterConfirmedReleaseWishlistSyncTargets(input.targets, input.confirmedReleaseIds);
}
