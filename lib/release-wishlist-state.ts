import { and, eq, inArray } from "drizzle-orm";
import { tracks } from "@/db/schema";
import { db } from "@/lib/db";
import { setDiscogsReleaseWishlist } from "@/lib/discogs";
import { resolveReleaseWishlistFeedbackEvent, shouldLogReleaseWishlistFeedback } from "@/lib/release-wishlist-feedback";
import { setLocalReleaseWishlistForUser } from "@/lib/release-wishlist-local-state";
import { resolveNextReleaseWishlistValue, type ReleaseWishlistMode } from "@/lib/release-wishlist-plan";
import { logFeedbackEvent } from "@/lib/recommendations";
import { resolveUserReleaseIdentity } from "@/lib/user-release-identity";

export async function updateReleaseWishlistForUser(input: {
  userId: string;
  requestedReleaseId: number;
  mode?: ReleaseWishlistMode;
  value?: boolean;
  feedbackSource?: string;
}) {
  const releaseIdentity = await resolveUserReleaseIdentity(input.userId, input.requestedReleaseId);
  const currentWishlist = releaseIdentity.localRows.length > 0
    ? releaseIdentity.localRows.every((row) => row.wishlist === true)
    : false;
  const nextWishlist = resolveNextReleaseWishlistValue(currentWishlist, input.mode ?? "toggle", input.value);
  const localUpdate = await setLocalReleaseWishlistForUser({
    userId: input.userId,
    releaseIds: releaseIdentity.localReleaseIds,
    nextWishlist,
  });
  const affectedReleaseIds = localUpdate.affectedReleaseIds;

  let discogsSynced = true;
  try {
    await setDiscogsReleaseWishlist(releaseIdentity.externalDiscogsReleaseId ?? input.requestedReleaseId, nextWishlist);
  } catch {
    discogsSynced = false;
  }

  const localConfirmedAll = localUpdate.confirmedAll;

  const affectedTrackCount = affectedReleaseIds.length > 0
    ? (
      await db
        .select({ id: tracks.id })
        .from(tracks)
        .where(and(inArray(tracks.releaseId, affectedReleaseIds), eq(tracks.userId, input.userId)))
    ).length
    : 0;

  const feedbackEventType = resolveReleaseWishlistFeedbackEvent({
    currentWishlist,
    nextWishlist,
  });
  if (input.feedbackSource && feedbackEventType && shouldLogReleaseWishlistFeedback({
    feedbackEventType,
    hasLocalRows: affectedReleaseIds.length > 0,
    localConfirmedAll,
    discogsSynced,
  })) {
    const loggedFeedbackEventType = feedbackEventType;
    await logFeedbackEvent({
      eventType: loggedFeedbackEventType,
      source: input.feedbackSource,
      releaseId: releaseIdentity.primaryLocalReleaseId,
      externalDiscogsReleaseId: releaseIdentity.externalDiscogsReleaseId ?? null,
      labelId: releaseIdentity.localRows[0]?.labelId ?? null,
      userId: input.userId,
    });
  }

  return {
    requestedReleaseId: input.requestedReleaseId,
    externalDiscogsReleaseId: releaseIdentity.externalDiscogsReleaseId ?? null,
    primaryLocalReleaseId: releaseIdentity.primaryLocalReleaseId,
    primaryLabelId: releaseIdentity.localRows[0]?.labelId ?? null,
    affectedReleaseIds,
    affectedTrackCount,
    currentWishlist,
    nextWishlist,
    feedbackEventType,
    localConfirmedAll,
    discogsSynced,
    external: affectedReleaseIds.length === 0,
    externalOnlySyncFailed: affectedReleaseIds.length === 0 && !discogsSynced,
  };
}
