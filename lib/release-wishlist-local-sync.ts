import { normalizePositiveIds } from "@/lib/positive-id-list";
import { resolveUserReleaseExternalDiscogsId } from "@/lib/user-release-external-identity";

type LocalWishlistSyncRow = {
  id: number;
  discogsUrl: string | null;
  wishlist: boolean;
};

export function buildLocalReleaseWishlistSetPlan(
  rows: LocalWishlistSyncRow[],
  externalDiscogsReleaseIds: Iterable<number>,
  nextWishlist: boolean,
) {
  const targetExternalIds = new Set(normalizePositiveIds(externalDiscogsReleaseIds));
  if (targetExternalIds.size === 0) return [];

  return rows
    .filter((row) => {
      const externalDiscogsReleaseId = resolveUserReleaseExternalDiscogsId(row);
      return (
        typeof externalDiscogsReleaseId === "number" &&
        targetExternalIds.has(externalDiscogsReleaseId) &&
        row.wishlist !== nextWishlist
      );
    })
    .map((row) => row.id);
}

export function buildLocalReleaseWishlistSyncPlan(
  rows: LocalWishlistSyncRow[],
  wantedExternalDiscogsReleaseIds: Iterable<number>,
) {
  const wantedExternalIds = new Set(normalizePositiveIds(wantedExternalDiscogsReleaseIds));

  const toSetReleaseIds: number[] = [];
  const toUnsetReleaseIds: number[] = [];

  for (const row of rows) {
    const externalDiscogsReleaseId = resolveUserReleaseExternalDiscogsId(row);
    const isWanted =
      typeof externalDiscogsReleaseId === "number" &&
      wantedExternalIds.has(externalDiscogsReleaseId);

    if (isWanted && !row.wishlist) {
      toSetReleaseIds.push(row.id);
    } else if (!isWanted && row.wishlist) {
      toUnsetReleaseIds.push(row.id);
    }
  }

  return {
    toSetReleaseIds,
    toUnsetReleaseIds,
  };
}
