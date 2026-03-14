import { normalizePositiveIds } from "@/lib/positive-id-list";
import {
  buildUserReleaseRowsByExternalDiscogsId,
  resolveUserReleaseExternalDiscogsId,
} from "@/lib/user-release-external-identity";

type ReleaseWishlistSyncRow = {
  id: number;
  discogsUrl: string | null;
  wishlist: boolean;
  labelId?: number | null;
};

export type ReleaseWishlistSyncTarget = {
  externalDiscogsReleaseId: number;
  localReleaseIds: number[];
  primaryLocalReleaseId: number | null;
  primaryLabelId: number | null;
  alreadyWishlisted: boolean;
};

export function filterConfirmedReleaseWishlistSyncTargets(
  targets: ReleaseWishlistSyncTarget[],
  confirmedReleaseIds: Iterable<number>,
) {
  const confirmedSet = new Set(normalizePositiveIds(confirmedReleaseIds));

  return targets.filter((target) => {
    if (target.localReleaseIds.length === 0) return true;
    return target.localReleaseIds.every((releaseId) => confirmedSet.has(releaseId));
  });
}

export function buildSavedWishlistSyncTargets(
  userReleaseRows: ReleaseWishlistSyncRow[],
  savedTrackReleaseIds: number[],
) {
  const requestedIds = new Set(normalizePositiveIds(savedTrackReleaseIds));
  const exactRows = userReleaseRows.filter((row) => requestedIds.has(row.id));
  const rowsByExternalId = buildUserReleaseRowsByExternalDiscogsId(exactRows);
  const targets: ReleaseWishlistSyncTarget[] = [];
  for (const [externalDiscogsReleaseId, matchedExactRows] of rowsByExternalId.entries()) {
    const matchingRows = userReleaseRows.filter((row) => resolveUserReleaseExternalDiscogsId(row) === externalDiscogsReleaseId);
    if (matchingRows.length === 0) continue;
    targets.push({
      externalDiscogsReleaseId,
      localReleaseIds: normalizePositiveIds(matchingRows.map((row) => row.id)),
      primaryLocalReleaseId: matchedExactRows[0]?.id ?? matchingRows[0]?.id ?? null,
      primaryLabelId: matchedExactRows[0]?.labelId ?? matchingRows[0]?.labelId ?? null,
      alreadyWishlisted: matchingRows.every((row) => row.wishlist === true),
    });
  }

  return targets;
}

export function buildReleaseWishlistSyncTargetsForLocalReleaseIds(
  userReleaseRows: ReleaseWishlistSyncRow[],
  localReleaseIds: Iterable<number>,
) {
  const requestedIds = new Set(normalizePositiveIds(localReleaseIds));
  const exactRows = userReleaseRows.filter((row) => requestedIds.has(row.id));
  const rowsByExternalId = buildUserReleaseRowsByExternalDiscogsId(exactRows);
  const targets: ReleaseWishlistSyncTarget[] = [];
  for (const [externalDiscogsReleaseId, matchingRows] of rowsByExternalId.entries()) {
    if (matchingRows.length === 0) continue;
    targets.push({
      externalDiscogsReleaseId,
      localReleaseIds: normalizePositiveIds(matchingRows.map((row) => row.id)),
      primaryLocalReleaseId: matchingRows[0]?.id ?? null,
      primaryLabelId: matchingRows[0]?.labelId ?? null,
      alreadyWishlisted: matchingRows.every((row) => row.wishlist === true),
    });
  }

  return targets;
}
