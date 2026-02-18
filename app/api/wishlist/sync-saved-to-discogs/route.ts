export const dynamic = "force-dynamic";

import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { releases, tracks } from "@/db/schema";
import { db } from "@/lib/db";
import { setDiscogsReleaseWishlist } from "@/lib/discogs";

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let idx = 0; idx < items.length; idx += size) {
    chunks.push(items.slice(idx, idx + size));
  }
  return chunks;
}

export async function POST() {
  const savedTrackRows = await db
    .select({ releaseId: tracks.releaseId })
    .from(tracks)
    .where(eq(tracks.saved, true));

  const releaseIds = [...new Set(savedTrackRows.map((row) => row.releaseId))];
  if (releaseIds.length === 0) {
    return NextResponse.json({
      ok: true,
      releaseCount: 0,
      attemptedCount: 0,
      skippedCount: 0,
      syncedCount: 0,
      failedCount: 0,
    });
  }

  const existingRows = [];
  for (const ids of chunk(releaseIds, 500)) {
    if (ids.length === 0) continue;
    const rows = await db
      .select({ id: releases.id, wishlist: releases.wishlist })
      .from(releases)
      .where(inArray(releases.id, ids));
    existingRows.push(...rows);
  }

  const alreadyWishlistedSet = new Set(
    existingRows.filter((row) => row.wishlist).map((row) => row.id),
  );
  const toSyncReleaseIds = releaseIds.filter((id) => !alreadyWishlistedSet.has(id));

  if (toSyncReleaseIds.length === 0) {
    return NextResponse.json({
      ok: true,
      releaseCount: releaseIds.length,
      attemptedCount: 0,
      skippedCount: releaseIds.length,
      syncedCount: 0,
      failedCount: 0,
    });
  }

  const syncedReleaseIds: number[] = [];
  const failedReleaseIds: number[] = [];

  for (const releaseId of toSyncReleaseIds) {
    try {
      await setDiscogsReleaseWishlist(releaseId, true);
      syncedReleaseIds.push(releaseId);
    } catch {
      failedReleaseIds.push(releaseId);
    }
  }

  for (const ids of chunk(syncedReleaseIds, 500)) {
    if (ids.length === 0) continue;
    await db.update(releases).set({ wishlist: true }).where(inArray(releases.id, ids));
  }

  return NextResponse.json({
    ok: failedReleaseIds.length === 0,
    releaseCount: releaseIds.length,
    attemptedCount: toSyncReleaseIds.length,
    skippedCount: alreadyWishlistedSet.size,
    syncedCount: syncedReleaseIds.length,
    failedCount: failedReleaseIds.length,
  });
}
