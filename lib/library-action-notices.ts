import type { ReleaseWishlistResponse } from "@/lib/release-library-contract";

export function libraryTrackUpdateError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to update track.";
}

export function libraryTrackReviewedError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to mark reviewed.";
}

export function libraryTrackSaveError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save track.";
}

export function libraryRecordWishlistError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to update record wishlist.";
}

export function libraryReleaseReviewedError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to mark release reviewed.";
}

export function libraryAddSourceError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to add label.";
}

export function libraryDismissRecommendationError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to dismiss recommendation.";
}

export function reviewedReleaseEndOfQueueNotice() {
  return "Release marked reviewed. End of queue reached.";
}

export function addingLabelNotice() {
  return "Adding and activating label...";
}

export function labelAddedAndActivatedNotice() {
  return "Label added and activated.";
}

export function trackSavedToggleNotice(saved: boolean | null | undefined) {
  return saved ? "Track saved." : "Track unsaved.";
}

export function bulkReviewedTracksNotice(count: number) {
  return `Marked ${count} tracks reviewed.`;
}

export function bulkReviewedPlayedTracksNotice(count: number) {
  return `Marked ${count} played tracks reviewed.`;
}

export function bulkSavedTracksNotice(count: number, saved: boolean) {
  return saved ? `Saved ${count} tracks.` : `Removed ${count} saved tracks.`;
}

export function releaseWishlistNotice(result: Pick<ReleaseWishlistResponse, "wishlist" | "affectedTrackCount" | "discogsSynced" | "localConfirmedAll">) {
  const scopeSuffix = result.affectedTrackCount > 0 ? ` (${result.affectedTrackCount} tracks)` : "";
  const syncSuffix = result.discogsSynced ? "" : " Discogs sync is delayed; local state is saved.";
  const verifySuffix = result.localConfirmedAll ? "" : " Local confirmation is still syncing.";
  return `${result.wishlist ? "Added record to Discogs wishlist" : "Removed record from Discogs wishlist"}${scopeSuffix}.${syncSuffix}${verifySuffix}`;
}

export function addedToWishlistNotice() {
  return "Added to Discogs wishlist.";
}

export function removedFromWishlistNotice() {
  return "Removed from Discogs wishlist.";
}

export function reviewedTrackNotice() {
  return "Marked as reviewed.";
}

export function recommendationDismissedNotice() {
  return "Dismissed.";
}
