export const dynamic = "force-dynamic";

import { eq, inArray, like, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { releases, tracks } from "@/db/schema";
import { db } from "@/lib/db";
import { setDiscogsReleaseWishlist } from "@/lib/discogs";

const schema = z.object({
  releaseId: z.number().int().positive(),
  mode: z.enum(["toggle", "set"]).default("toggle"),
  value: z.boolean().optional(),
});

function parseDiscogsReleaseId(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/releases?\/(\d+)/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const release = await db.query.releases.findFirst({ where: eq(releases.id, parsed.data.releaseId) });
  const nextWishlist =
    parsed.data.mode === "set" ? Boolean(parsed.data.value) : release ? !release.wishlist : true;

  let affectedReleaseIds: number[] = release ? [release.id] : [];
  if (release?.discogsUrl) {
    const linkedReleases = await db
      .select({ id: releases.id })
      .from(releases)
      .where(eq(releases.discogsUrl, release.discogsUrl));
    if (linkedReleases.length > 0) {
      affectedReleaseIds = linkedReleases.map((row) => row.id);
    }

    const canonicalId = parseDiscogsReleaseId(release.discogsUrl);
    if (canonicalId) {
      const canonicalMatches = await db
        .select({ id: releases.id })
        .from(releases)
        .where(
          or(
            like(releases.discogsUrl, `%/release/${canonicalId}%`),
            like(releases.discogsUrl, `%/releases/${canonicalId}%`),
          ),
        );
      if (canonicalMatches.length > 0) {
        const merged = new Set([...affectedReleaseIds, ...canonicalMatches.map((row) => row.id)]);
        affectedReleaseIds = [...merged];
      }
    }
  }

  if (affectedReleaseIds.length > 0) {
    await db.update(releases).set({ wishlist: nextWishlist }).where(inArray(releases.id, affectedReleaseIds));
  }

  let discogsSynced = true;
  try {
    await setDiscogsReleaseWishlist(parsed.data.releaseId, nextWishlist);
  } catch {
    discogsSynced = false;
    if (!release) {
      return NextResponse.json({ error: "Discogs sync failed for external release." }, { status: 502 });
    }
    // Keep local state even if Discogs sync fails.
  }

  const confirmedRows = affectedReleaseIds.length > 0
    ? await db
        .select({ id: releases.id, wishlist: releases.wishlist })
        .from(releases)
        .where(inArray(releases.id, affectedReleaseIds))
    : [];
  const localConfirmedAll = confirmedRows.every((row) => row.wishlist === nextWishlist);

  const affectedTrackCount = affectedReleaseIds.length > 0
    ? (
      await db
        .select({ id: tracks.id })
        .from(tracks)
        .where(inArray(tracks.releaseId, affectedReleaseIds))
    ).length
    : 0;

  return NextResponse.json({
    ok: true,
    releaseId: parsed.data.releaseId,
    wishlist: nextWishlist,
    external: !release,
    discogsSynced,
    localConfirmedAll,
    affectedReleaseIds,
    affectedTrackCount,
  });
}
