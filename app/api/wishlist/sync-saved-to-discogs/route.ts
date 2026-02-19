export const dynamic = "force-dynamic";

import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { releases, tracks } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
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
  const userId = await requireCurrentAppUserId();
  const savedTrackRows = await db
    .select({ releaseId: tracks.releaseId })
    .from(tracks)
    .where(and(eq(tracks.saved, true), eq(tracks.userId, userId)));

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
      .where(and(inArray(releases.id, ids), eq(releases.userId, userId)));
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
    await db.update(releases).set({ wishlist: true }).where(and(inArray(releases.id, ids), eq(releases.userId, userId)));
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
