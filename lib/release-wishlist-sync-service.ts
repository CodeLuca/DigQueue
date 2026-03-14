import { and, eq } from "drizzle-orm";
import { releases, tracks } from "@/db/schema";
import { db } from "@/lib/db";
import { setDiscogsReleaseWishlist } from "@/lib/discogs";
import { normalizePositiveIds } from "@/lib/positive-id-list";
import { selectConfirmedReleaseWishlistFeedbackTargets } from "@/lib/release-wishlist-feedback";
import { logReleaseWishlistFeedbackTargets } from "@/lib/release-wishlist-feedback-log";
import { setLocalReleaseWishlistForUser } from "@/lib/release-wishlist-local-state";
import { buildLocalReleaseWishlistSetPlan } from "@/lib/release-wishlist-local-sync";
import {
  buildSyncSavedToDiscogsSummary,
  type SyncSavedToDiscogsSummary,
} from "@/lib/release-wishlist-sync-contract";
import {
  buildSavedWishlistSyncTargets,
  type ReleaseWishlistSyncTarget,
} from "@/lib/release-wishlist-sync";

export async function syncSavedTracksToDiscogsWishlistForUser(userId: string): Promise<SyncSavedToDiscogsSummary> {
  const savedTrackRows = await db
    .select({ releaseId: tracks.releaseId })
    .from(tracks)
    .where(and(eq(tracks.saved, true), eq(tracks.userId, userId)));

  const releaseIds = normalizePositiveIds(savedTrackRows.map((row) => row.releaseId));
  if (releaseIds.length === 0) {
    return buildSyncSavedToDiscogsSummary({
      ok: true,
      releaseCount: 0,
      attemptedCount: 0,
      skippedCount: 0,
      syncedCount: 0,
      failedCount: 0,
      localUnconfirmedCount: 0,
    });
  }

  const userReleaseRows = await db
    .select({ id: releases.id, discogsUrl: releases.discogsUrl, wishlist: releases.wishlist, labelId: releases.labelId })
    .from(releases)
    .where(eq(releases.userId, userId));
  const syncTargets = buildSavedWishlistSyncTargets(userReleaseRows, releaseIds);
  const toSyncTargets = syncTargets.filter((target) => !target.alreadyWishlisted);

  if (toSyncTargets.length === 0) {
    return buildSyncSavedToDiscogsSummary({
      ok: true,
      releaseCount: syncTargets.length,
      attemptedCount: 0,
      skippedCount: syncTargets.length,
      syncedCount: 0,
      failedCount: 0,
      localUnconfirmedCount: 0,
    });
  }

  const syncedTargets: ReleaseWishlistSyncTarget[] = [];
  const failedExternalReleaseIds: number[] = [];

  for (const target of toSyncTargets) {
    try {
      await setDiscogsReleaseWishlist(target.externalDiscogsReleaseId, true);
      syncedTargets.push(target);
    } catch {
      failedExternalReleaseIds.push(target.externalDiscogsReleaseId);
    }
  }

  const syncedLocalReleaseIds = buildLocalReleaseWishlistSetPlan(
    userReleaseRows,
    syncedTargets.map((target) => target.externalDiscogsReleaseId),
    true,
  );
  const localUpdate = await setLocalReleaseWishlistForUser({
    userId,
    releaseIds: syncedLocalReleaseIds,
    nextWishlist: true,
  });
  const confirmedTargets = selectConfirmedReleaseWishlistFeedbackTargets({
    targets: syncedTargets,
    confirmedReleaseIds: localUpdate.confirmedIds,
  });
  const localUnconfirmedCount = syncedTargets.length - confirmedTargets.length;

  await logReleaseWishlistFeedbackTargets({
    eventType: "record_wishlist_add",
    source: "api_wishlist_sync_saved",
    userId,
    targets: confirmedTargets,
  });

  return buildSyncSavedToDiscogsSummary({
    ok: failedExternalReleaseIds.length === 0 && localUnconfirmedCount === 0,
    releaseCount: syncTargets.length,
    attemptedCount: toSyncTargets.length,
    skippedCount: syncTargets.length - toSyncTargets.length,
    syncedCount: confirmedTargets.length,
    failedCount: failedExternalReleaseIds.length,
    localUnconfirmedCount,
  });
}
