import { and, eq, inArray } from "drizzle-orm";
import { releases } from "@/db/schema";
import { db } from "@/lib/db";
import { normalizePositiveIds } from "@/lib/positive-id-list";

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let idx = 0; idx < items.length; idx += size) {
    chunks.push(items.slice(idx, idx + size));
  }
  return chunks;
}

export async function setLocalReleaseWishlistForUser(input: {
  userId: string;
  releaseIds: Iterable<number>;
  nextWishlist: boolean;
  chunkSize?: number;
  onChunkApplied?: (appliedCount: number) => Promise<void> | void;
}) {
  const releaseIds = normalizePositiveIds(input.releaseIds);
  if (releaseIds.length === 0) {
    return {
      affectedReleaseIds: [] as number[],
      confirmedIds: [] as number[],
      confirmedAll: true,
    };
  }

  for (const ids of chunk(releaseIds, input.chunkSize ?? 500)) {
    if (ids.length === 0) continue;
    await db
      .update(releases)
      .set({ wishlist: input.nextWishlist })
      .where(and(inArray(releases.id, ids), eq(releases.userId, input.userId)));
    await input.onChunkApplied?.(ids.length);
  }

  const confirmedRows = await db
    .select({ id: releases.id, wishlist: releases.wishlist })
    .from(releases)
    .where(and(inArray(releases.id, releaseIds), eq(releases.userId, input.userId)));

  const confirmedIds = confirmedRows
    .filter((row) => row.wishlist === input.nextWishlist)
    .map((row) => row.id);

  return {
    affectedReleaseIds: releaseIds,
    confirmedIds,
    confirmedAll: confirmedIds.length === releaseIds.length,
  };
}

export async function applyLocalReleaseWishlistSyncPlanForUser(input: {
  userId: string;
  toSetReleaseIds: Iterable<number>;
  toUnsetReleaseIds: Iterable<number>;
  chunkSize?: number;
  onChunkApplied?: (input: { appliedCount: number; nextWishlist: boolean }) => Promise<void> | void;
}) {
  const setResult = await setLocalReleaseWishlistForUser({
    userId: input.userId,
    releaseIds: input.toSetReleaseIds,
    nextWishlist: true,
    chunkSize: input.chunkSize,
    onChunkApplied: (appliedCount) => input.onChunkApplied?.({ appliedCount, nextWishlist: true }),
  });
  const unsetResult = await setLocalReleaseWishlistForUser({
    userId: input.userId,
    releaseIds: input.toUnsetReleaseIds,
    nextWishlist: false,
    chunkSize: input.chunkSize,
    onChunkApplied: (appliedCount) => input.onChunkApplied?.({ appliedCount, nextWishlist: false }),
  });

  return { setResult, unsetResult };
}
