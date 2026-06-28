import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { labels, queueItems, releases, tracks } from "@/db/schema";
import { db } from "@/lib/db";

const DIRECTORY_LIMIT = 18;

function toCount(value: unknown) {
  return Number(value || 0);
}

function compactText(value: string | null | undefined) {
  return value?.trim() || null;
}

export type PublicDirectoryData = Awaited<ReturnType<typeof getPublicDirectoryData>>;

export async function getPublicDirectoryData() {
  const [
    activeUserRows,
    sourceRows,
    releaseRows,
    queuedRows,
    savedTrackRows,
    wantRows,
    latestSources,
    recentQueue,
    recentReleases,
    savedTracks,
    wantedReleases,
  ] = await Promise.all([
    db.select({ value: count() }).from(labels).where(isNotNull(labels.userId)).groupBy(labels.userId),
    db.select({ value: count() }).from(labels).where(isNotNull(labels.userId)),
    db.select({ value: count() }).from(releases).where(isNotNull(releases.userId)),
    db.select({ value: count() }).from(queueItems).where(isNotNull(queueItems.userId)),
    db.select({ value: count() }).from(tracks).where(and(isNotNull(tracks.userId), eq(tracks.saved, true))),
    db.select({ value: count() }).from(releases).where(and(isNotNull(releases.userId), eq(releases.wishlist, true))),
    db
      .select({
        id: labels.id,
        name: labels.name,
        entityKind: labels.entityKind,
        discogsUrl: labels.discogsUrl,
        imageUrl: labels.imageUrl,
        active: labels.active,
        status: labels.status,
        addedAt: labels.addedAt,
      })
      .from(labels)
      .where(isNotNull(labels.userId))
      .orderBy(desc(labels.addedAt))
      .limit(DIRECTORY_LIMIT),
    db
      .select({
        id: queueItems.id,
        status: queueItems.status,
        youtubeVideoId: queueItems.youtubeVideoId,
        addedAt: queueItems.addedAt,
        trackTitle: tracks.title,
        trackArtists: tracks.artistsText,
        releaseTitle: releases.title,
        releaseArtist: releases.artist,
        releaseDiscogsUrl: releases.discogsUrl,
        releaseThumbUrl: releases.thumbUrl,
        labelName: labels.name,
      })
      .from(queueItems)
      .innerJoin(tracks, eq(queueItems.trackId, tracks.id))
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .innerJoin(labels, eq(releases.labelId, labels.id))
      .where(isNotNull(queueItems.userId))
      .orderBy(desc(queueItems.addedAt))
      .limit(DIRECTORY_LIMIT),
    db
      .select({
        id: releases.id,
        title: releases.title,
        artist: releases.artist,
        year: releases.year,
        catno: releases.catno,
        discogsUrl: releases.discogsUrl,
        thumbUrl: releases.thumbUrl,
        fetchedAt: releases.fetchedAt,
        labelName: labels.name,
      })
      .from(releases)
      .innerJoin(labels, eq(releases.labelId, labels.id))
      .where(isNotNull(releases.userId))
      .orderBy(desc(releases.fetchedAt))
      .limit(DIRECTORY_LIMIT),
    db
      .select({
        id: tracks.id,
        title: tracks.title,
        artistsText: tracks.artistsText,
        createdAt: tracks.createdAt,
        releaseTitle: releases.title,
        releaseArtist: releases.artist,
        releaseDiscogsUrl: releases.discogsUrl,
        releaseThumbUrl: releases.thumbUrl,
        labelName: labels.name,
      })
      .from(tracks)
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .innerJoin(labels, eq(releases.labelId, labels.id))
      .where(and(isNotNull(tracks.userId), eq(tracks.saved, true)))
      .orderBy(desc(tracks.createdAt))
      .limit(DIRECTORY_LIMIT),
    db
      .select({
        id: releases.id,
        title: releases.title,
        artist: releases.artist,
        year: releases.year,
        catno: releases.catno,
        discogsUrl: releases.discogsUrl,
        thumbUrl: releases.thumbUrl,
        fetchedAt: releases.fetchedAt,
        labelName: labels.name,
      })
      .from(releases)
      .innerJoin(labels, eq(releases.labelId, labels.id))
      .where(and(isNotNull(releases.userId), eq(releases.wishlist, true)))
      .orderBy(desc(releases.fetchedAt))
      .limit(DIRECTORY_LIMIT),
  ]);

  return {
    stats: {
      activeUsers: activeUserRows.length,
      sources: toCount(sourceRows[0]?.value),
      releases: toCount(releaseRows[0]?.value),
      queuedItems: toCount(queuedRows[0]?.value),
      savedTracks: toCount(savedTrackRows[0]?.value),
      wantedRecords: toCount(wantRows[0]?.value),
    },
    latestSources: latestSources.map((item) => ({
      ...item,
      imageUrl: compactText(item.imageUrl),
      entityKind: item.entityKind === "artist" ? "artist" : "label",
    })),
    recentQueue: recentQueue.map((item) => ({
      ...item,
      trackArtists: compactText(item.trackArtists),
      releaseThumbUrl: compactText(item.releaseThumbUrl),
    })),
    recentReleases: recentReleases.map((item) => ({
      ...item,
      catno: compactText(item.catno),
      thumbUrl: compactText(item.thumbUrl),
    })),
    savedTracks: savedTracks.map((item) => ({
      ...item,
      artistsText: compactText(item.artistsText),
      releaseThumbUrl: compactText(item.releaseThumbUrl),
    })),
    wantedReleases: wantedReleases.map((item) => ({
      ...item,
      catno: compactText(item.catno),
      thumbUrl: compactText(item.thumbUrl),
    })),
  };
}
