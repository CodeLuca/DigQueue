export function trackSaveTitle() {
  return "Track save is local only and does not add to your Discogs wantlist.";
}

export function trackSaveToggleLabel(saved: boolean) {
  return saved
    ? "Track saved locally. Does not add to your Discogs wantlist."
    : "Save track locally. Does not add to your Discogs wantlist.";
}

export function getTrackSaveActionLabels(saved: boolean) {
  return {
    activeLabel: trackSaveToggleLabel(true),
    ariaLabel: trackSaveToggleLabel(saved),
    buttonLabel: saved ? "Saved" : "Save",
    inactiveLabel: trackSaveToggleLabel(false),
    title: trackSaveTitle(),
  };
}

export function discogsWishlistToggleLabel(wishlisted: boolean) {
  return wishlisted ? "Remove from Discogs wishlist" : "Add to Discogs wishlist";
}

export function recordWishlistToggleLabel(wishlisted: boolean) {
  return wishlisted ? "Remove record from Discogs wishlist" : "Add record to Discogs wishlist";
}

export function getDiscogsWishlistActionLabels(
  wishlisted: boolean,
  scope: "discogs" | "record" = "discogs",
) {
  const label = scope === "record"
    ? recordWishlistToggleLabel(wishlisted)
    : discogsWishlistToggleLabel(wishlisted);

  return {
    activeLabel: scope === "record" ? recordWishlistToggleLabel(true) : discogsWishlistToggleLabel(true),
    ariaLabel: label,
    buttonLabel: wishlisted ? "Wishlisted" : "Want",
    inactiveLabel: scope === "record" ? recordWishlistToggleLabel(false) : discogsWishlistToggleLabel(false),
    title: label,
  };
}

export function releaseDiscogsLinkTitle() {
  return "Open release on Discogs";
}

export function recommendationReviewLabel() {
  return "Mark this track as reviewed";
}

export function playNowInMiniPlayerLabel() {
  return "Play now in the mini-player";
}

export function playNowAriaLabel(subject: "track" | "match" = "track") {
  return subject === "match" ? "Play match now" : "Play track now";
}

export function replayTrackTitle() {
  return "Play this track now in the mini-player";
}

export function replayTrackAriaLabel() {
  return "Play again";
}

export function queueTrackNextTitle() {
  return "Add this track to the front of your queue";
}

export function queueTrackNextLabel() {
  return "Queue track next";
}

export function trackReviewAdvanceLabel(subject: "this track" | "current track" = "this track") {
  return `Mark ${subject} reviewed and move to next track`;
}

export function releaseReviewAdvanceLabel() {
  return "Mark entire release reviewed and skip to next release";
}

export function recommendationDismissLabel() {
  return "Dismiss recommendation";
}

export function addSourceFromReleaseLabel() {
  return "Add label from release";
}

export function addSourceFromReleaseTitle() {
  return "Create and activate label from this release";
}

export function getAddSourceFromReleaseActionLabels(state: "idle" | "pending" | "added" | "active" = "idle") {
  return {
    activeAriaLabel: "Label active",
    activeButtonLabel: "Label active",
    activeTitle: "Label is already active",
    ariaLabel: addSourceFromReleaseLabel(),
    buttonLabel: state === "pending" ? "Adding..." : state === "added" ? "Added" : "Add Source",
    listenButtonLabel: state === "pending" ? "Adding..." : state === "added" ? "Added" : "Add + activate label",
    title: addSourceFromReleaseTitle(),
  };
}

export function chooseMatchLabel(pending: boolean) {
  return pending ? "Choosing match" : "Choose match";
}
