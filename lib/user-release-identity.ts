import { eq } from "drizzle-orm";
import { releases } from "@/db/schema";
import { db } from "@/lib/db";
import { toExternalDiscogsId } from "@/lib/discogs-id";
import { matchesExternalDiscogsReleaseId } from "@/lib/release-identity";

type UserReleaseIdentityRow = {
  id: number;
  discogsUrl: string;
  labelId: number | null;
  wishlist?: boolean;
};

export type UserReleaseIdentity = {
  requestedReleaseId: number;
  externalDiscogsReleaseId: number | null;
  exactLocalReleaseId: number | null;
  primaryLocalReleaseId: number | null;
  localRows: UserReleaseIdentityRow[];
  localReleaseIds: number[];
};

export function normalizeRequestedExternalDiscogsReleaseId(requestedReleaseId: number | null | undefined) {
  if (typeof requestedReleaseId !== "number" || !Number.isFinite(requestedReleaseId) || requestedReleaseId <= 0) {
    return null;
  }
  const normalized = toExternalDiscogsId(requestedReleaseId);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

export function resolveUserReleaseRowsByExternalId(
  rows: UserReleaseIdentityRow[],
  externalDiscogsReleaseId: number | null | undefined,
) {
  if (typeof externalDiscogsReleaseId !== "number" || !Number.isFinite(externalDiscogsReleaseId) || externalDiscogsReleaseId <= 0) {
    return [];
  }
  return rows.filter((row) => matchesExternalDiscogsReleaseId(row.discogsUrl, externalDiscogsReleaseId));
}

export async function resolveUserReleaseIdentity(userId: string, requestedReleaseId: number): Promise<UserReleaseIdentity> {
  const requestedExternalDiscogsReleaseId = normalizeRequestedExternalDiscogsReleaseId(requestedReleaseId);
  const userReleaseRows = await db
    .select({
      id: releases.id,
      discogsUrl: releases.discogsUrl,
      labelId: releases.labelId,
      wishlist: releases.wishlist,
    })
    .from(releases)
    .where(eq(releases.userId, userId));

  const exactLocalRelease = userReleaseRows.find((row) => row.id === requestedReleaseId) ?? null;
  const externalDiscogsReleaseId = requestedExternalDiscogsReleaseId;
  const canonicalLocalRows = resolveUserReleaseRowsByExternalId(userReleaseRows, externalDiscogsReleaseId);
  const mergedLocalRows = exactLocalRelease
    ? [exactLocalRelease, ...canonicalLocalRows.filter((row) => row.id !== exactLocalRelease.id)]
    : canonicalLocalRows;

  return {
    requestedReleaseId,
    externalDiscogsReleaseId,
    exactLocalReleaseId: exactLocalRelease?.id ?? null,
    primaryLocalReleaseId: mergedLocalRows[0]?.id ?? null,
    localRows: mergedLocalRows,
    localReleaseIds: mergedLocalRows.map((row) => row.id),
  };
}
