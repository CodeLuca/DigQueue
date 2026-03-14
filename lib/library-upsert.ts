import { and, desc, eq, sql } from "drizzle-orm";
import { releases, tracks } from "@/db/schema";
import { db } from "@/lib/db";
import { toStoredDiscogsId } from "@/lib/discogs-id";
import { mergeReleaseImportSource } from "@/lib/release-upsert-policy";
import { normalizeTrackPosition, normalizeTrackTitle } from "@/lib/track-identity";

export async function upsertReleaseForUser(input: {
  userId: string;
  externalDiscogsReleaseId: number;
  labelId: number;
  title: string;
  artist: string;
  year?: number | null;
  catno?: string | null;
  discogsUrl: string;
  thumbUrl?: string | null;
  detailsFetched?: boolean;
  youtubeMatched?: boolean;
  listened?: boolean;
  wishlist?: boolean;
  matchConfidence?: number;
  processingError?: string | null;
  fetchedAt: Date;
  releaseOrder?: number;
  importSource?: string;
}) {
  const preferredId = toStoredDiscogsId(input.userId, input.externalDiscogsReleaseId, "release");
  const importSource = mergeReleaseImportSource(null, input.importSource || "label");

  await db
    .insert(releases)
    .values({
      id: preferredId,
      userId: input.userId,
      labelId: input.labelId,
      title: input.title,
      artist: input.artist || "Unknown Artist",
      year: input.year ?? null,
      catno: input.catno ?? null,
      discogsUrl: input.discogsUrl,
      thumbUrl: input.thumbUrl ?? null,
      detailsFetched: input.detailsFetched ?? false,
      youtubeMatched: input.youtubeMatched ?? false,
      listened: input.listened ?? false,
      wishlist: input.wishlist ?? false,
      matchConfidence: input.matchConfidence ?? 0,
      processingError: input.processingError ?? null,
      fetchedAt: input.fetchedAt,
      releaseOrder: input.releaseOrder ?? 0,
      importSource,
    })
    .onConflictDoUpdate({
      target: [releases.userId, releases.discogsUrl],
      set: {
        title: input.title,
        artist: input.artist || "Unknown Artist",
        year: sql`coalesce(excluded.year, ${releases.year})`,
        catno: sql`coalesce(excluded.catno, ${releases.catno})`,
        thumbUrl: sql`coalesce(excluded.thumb_url, ${releases.thumbUrl})`,
        detailsFetched: sql`(${releases.detailsFetched} or excluded.details_fetched)`,
        youtubeMatched: sql`(${releases.youtubeMatched} or excluded.youtube_matched)`,
        listened: sql`(${releases.listened} or excluded.listened)`,
        wishlist: sql`(${releases.wishlist} or excluded.wishlist)`,
        matchConfidence: sql`greatest(coalesce(${releases.matchConfidence}, 0), coalesce(excluded.match_confidence, 0))`,
        processingError: sql`excluded.processing_error`,
        fetchedAt: sql`greatest(${releases.fetchedAt}, excluded.fetched_at)`,
        releaseOrder: sql`least(${releases.releaseOrder}, excluded.release_order)`,
        importSource: sql`case
            when ${releases.importSource} = 'discogs_want' and excluded.import_source <> 'discogs_want' then excluded.import_source
            else ${releases.importSource}
          end`,
        labelId: sql`case
            when ${releases.importSource} = 'discogs_want' and excluded.import_source <> 'discogs_want' then excluded.label_id
            else ${releases.labelId}
          end`,
      },
    });

  const persisted = await db.query.releases.findFirst({
    where: and(eq(releases.userId, input.userId), eq(releases.discogsUrl, input.discogsUrl)),
    columns: { id: true, labelId: true, importSource: true },
    orderBy: [desc(releases.fetchedAt), desc(releases.id)],
  });
  if (!persisted) {
    throw new Error("Unable to persist release.");
  }
  return persisted;
}

export async function ensureTrackForUser(input: {
  userId: string;
  releaseId: number;
  position?: string | null;
  title: string;
  duration?: string | null;
  artistsText?: string | null;
  listened?: boolean;
  saved?: boolean;
  wishlist?: boolean;
  createdAt: Date;
}) {
  const normalizedPosition = normalizeTrackPosition(input.position);
  const normalizedTitle = normalizeTrackTitle(input.title);

  await db
    .insert(tracks)
    .values({
      userId: input.userId,
      releaseId: input.releaseId,
      position: input.position?.trim() || "",
      title: input.title.trim(),
      duration: input.duration ?? null,
      artistsText: input.artistsText ?? null,
      listened: input.listened ?? false,
      saved: input.saved ?? false,
      wishlist: input.wishlist ?? false,
      createdAt: input.createdAt,
    })
    .onConflictDoNothing();

  await db
    .update(tracks)
    .set({
      duration: sql`coalesce(${tracks.duration}, ${input.duration ?? null})`,
      artistsText: sql`coalesce(${tracks.artistsText}, ${input.artistsText ?? null})`,
      listened: sql`(${tracks.listened} or ${input.listened ?? false})`,
      saved: sql`(${tracks.saved} or ${input.saved ?? false})`,
      wishlist: sql`(${tracks.wishlist} or ${input.wishlist ?? false})`,
    })
    .where(and(
      eq(tracks.userId, input.userId),
      eq(tracks.releaseId, input.releaseId),
      sql`coalesce(nullif(trim(${tracks.position}), ''), '__') = ${normalizedPosition}`,
      sql`lower(trim(${tracks.title})) = ${normalizedTitle}`,
    ));

  const persisted = await db.query.tracks.findFirst({
    where: and(
      eq(tracks.userId, input.userId),
      eq(tracks.releaseId, input.releaseId),
      sql`coalesce(nullif(trim(${tracks.position}), ''), '__') = ${normalizedPosition}`,
      sql`lower(trim(${tracks.title})) = ${normalizedTitle}`,
    ),
    columns: { id: true },
    orderBy: [desc(tracks.id)],
  });
  if (!persisted) {
    throw new Error("Unable to persist track.");
  }
  return persisted.id;
}
