import { and, asc, count, desc, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import { labels, queueItems, releases, tracks, youtubeMatches } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { buildDeepRecommendations, buildExternalRecommendations } from "@/lib/recommendations";

function userScope(userId: string) {
  return {
    labels: eq(labels.userId, userId),
    releases: eq(releases.userId, userId),
    tracks: eq(tracks.userId, userId),
    queueItems: eq(queueItems.userId, userId),
    youtubeMatches: eq(youtubeMatches.userId, userId),
  };
}

export async function getDashboardData() {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const [labelRows, allLabelNameRows, releaseThumbRows, releaseLabelRows, queueCountRows, fetchedReleaseRows, trackCountRows] = await Promise.all([
    db.query.labels.findMany({
      where: and(eq(labels.sourceType, "workspace"), scope.labels),
      orderBy: [asc(labels.addedAt)],
    }),
    db.query.labels.findMany({
      where: scope.labels,
      columns: { name: true },
      orderBy: [asc(labels.name)],
    }),
    db
      .select({ labelId: releases.labelId, thumbUrl: releases.thumbUrl })
      .from(releases)
      .where(and(isNotNull(releases.thumbUrl), scope.releases))
      .orderBy(asc(releases.labelId), asc(releases.releaseOrder)),
    db.select({ releaseId: releases.id, labelId: releases.labelId }).from(releases).where(scope.releases),
    db
      .select({ value: count() })
      .from(queueItems)
      .innerJoin(tracks, eq(queueItems.trackId, tracks.id))
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .innerJoin(labels, eq(releases.labelId, labels.id))
      .where(and(eq(queueItems.status, "pending"), eq(tracks.listened, false), eq(labels.active, true), scope.queueItems, scope.tracks, scope.releases, scope.labels)),
    db
      .select({ labelId: releases.labelId, value: count() })
      .from(releases)
      .where(and(eq(releases.detailsFetched, true), scope.releases))
      .groupBy(releases.labelId),
    db
      .select({ labelId: releases.labelId, value: count() })
      .from(tracks)
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .where(and(scope.tracks, scope.releases))
      .groupBy(releases.labelId),
  ]);

  const thumbByLabel = new Map<number, string>();
  for (const row of releaseThumbRows) {
    if (!row.thumbUrl) continue;
    if (!thumbByLabel.has(row.labelId)) {
      thumbByLabel.set(row.labelId, row.thumbUrl);
    }
  }

  const releaseCountByLabel = new Map<number, number>();
  for (const row of releaseLabelRows) {
    releaseCountByLabel.set(row.labelId, (releaseCountByLabel.get(row.labelId) ?? 0) + 1);
  }
  const fetchedReleaseCountByLabel = new Map<number, number>();
  for (const row of fetchedReleaseRows) {
    fetchedReleaseCountByLabel.set(row.labelId, row.value);
  }
  const trackCountByLabel = new Map<number, number>();
  for (const row of trackCountRows) {
    trackCountByLabel.set(row.labelId, row.value);
  }
  const existingReleaseIds = releaseLabelRows.map((row) => row.releaseId);

  const labelsWithMetadata = labelRows.map((label) => {
    const loadedReleaseCount = releaseCountByLabel.get(label.id) ?? 0;
    const fetchedReleaseCount = fetchedReleaseCountByLabel.get(label.id) ?? 0;
    const loadedTrackCount = trackCountByLabel.get(label.id) ?? 0;
    const pagesDone = label.currentPage > Math.max(1, label.totalPages);
    const releasesFullyLoaded = loadedReleaseCount > 0 && fetchedReleaseCount >= loadedReleaseCount;
    const tracksFullyLoaded = pagesDone && releasesFullyLoaded;
    const summaryText =
      label.blurb ||
      `${loadedReleaseCount} release${loadedReleaseCount === 1 ? "" : "s"} loaded • page ${label.currentPage}/${Math.max(1, label.totalPages)}`;

    return {
      ...label,
      imageUrl: label.imageUrl || thumbByLabel.get(label.id) || null,
      summaryText,
      loadedTrackCount,
      loadedReleaseCount,
      fetchedReleaseCount,
      tracksFullyLoaded,
    };
  });

  const scopedTotals = await Promise.all([
    db
      .select({ value: count() })
      .from(tracks)
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .innerJoin(labels, eq(releases.labelId, labels.id))
      .where(and(eq(tracks.listened, false), eq(labels.active, true), scope.tracks, scope.releases, scope.labels)),
    db
      .select({ value: count() })
      .from(queueItems)
      .innerJoin(releases, eq(queueItems.releaseId, releases.id))
      .innerJoin(labels, eq(releases.labelId, labels.id))
      .where(and(eq(queueItems.status, "played"), eq(labels.active, true), scope.queueItems, scope.releases, scope.labels)),
    db
      .select({ value: count() })
      .from(tracks)
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .innerJoin(labels, eq(releases.labelId, labels.id))
      .where(and(eq(tracks.listened, true), eq(labels.active, true), scope.tracks, scope.releases, scope.labels)),
    db
      .select({ value: count() })
      .from(tracks)
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .innerJoin(labels, eq(releases.labelId, labels.id))
      .where(and(eq(tracks.saved, true), eq(labels.active, true), scope.tracks, scope.releases, scope.labels)),
    db
      .select({ value: count() })
      .from(releases)
      .innerJoin(labels, eq(releases.labelId, labels.id))
      .where(and(eq(releases.wishlist, true), eq(labels.active, true), scope.releases, scope.labels)),
  ]);

  const [labelsErrorCount, lowConfidenceCount] = await Promise.all([
    db.select({ value: count() }).from(labels).where(and(eq(labels.status, "error"), eq(labels.active, true), scope.labels)),
    db
      .select({ value: count() })
      .from(releases)
      .innerJoin(labels, eq(releases.labelId, labels.id))
      .where(and(eq(releases.youtubeMatched, true), lt(releases.matchConfidence, 0.4), eq(labels.active, true), scope.releases, scope.labels)),
  ]);

  const erroredLabels = await db.query.labels.findMany({
    where: and(eq(labels.status, "error"), eq(labels.active, true), scope.labels),
    orderBy: [asc(labels.updatedAt)],
    limit: 20,
  });

  const recentlyPlayed = await db.query.queueItems.findMany({
    where: and(eq(queueItems.status, "played"), scope.queueItems),
    orderBy: [desc(queueItems.id)],
    limit: 12,
    with: { track: true, release: true, label: true },
  });

  const [candidateTracks, listenedTracks, playedQueueItems] = await Promise.all([
    db.query.tracks.findMany({
      where: and(eq(tracks.listened, false), scope.tracks),
      orderBy: [asc(tracks.id)],
      limit: 3600,
      with: { release: { with: { label: true } } },
    }),
    db.query.tracks.findMany({
      where: and(eq(tracks.listened, true), scope.tracks),
      orderBy: [asc(tracks.id)],
      limit: 5200,
      with: { release: { with: { label: true } } },
    }),
    db.query.queueItems.findMany({
      where: and(eq(queueItems.status, "played"), isNotNull(queueItems.trackId), scope.queueItems),
      orderBy: [desc(queueItems.id)],
      limit: 2400,
      columns: { trackId: true, releaseId: true, labelId: true },
    }),
  ]);
  const recommendations = await buildDeepRecommendations({
    candidateTracks,
    listenedTracks,
    playedQueueItems,
    limit: 24,
  });
  let externalRecommendations: Awaited<ReturnType<typeof buildExternalRecommendations>> = [];
  try {
    externalRecommendations = await buildExternalRecommendations({
      candidateTracks,
      listenedTracks,
      activeLabels: labelRows.filter((label) => label.active).map((label) => ({ id: label.id, name: label.name })),
      existingReleaseIds,
      existingLabelNames: allLabelNameRows.map((label) => label.name),
      limit: 18,
    });
  } catch {
    externalRecommendations = [];
  }

  return {
    labels: labelsWithMetadata,
    queueCount: queueCountRows[0]?.value ?? 0,
    metrics: {
      unplayedTracks: scopedTotals[0][0]?.value ?? 0,
      playedItems: scopedTotals[1][0]?.value ?? 0,
      doneTracks: scopedTotals[2][0]?.value ?? 0,
      savedTracks: scopedTotals[3][0]?.value ?? 0,
      wishlistedRecords: scopedTotals[4][0]?.value ?? 0,
      labelsErrored: labelsErrorCount[0]?.value ?? 0,
      releasesLowConfidence: lowConfidenceCount[0]?.value ?? 0,
    },
    erroredLabels,
    recentlyPlayed,
    recommendations,
    externalRecommendations,
  };
}

export async function getLabelDetail(labelId: number) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const label = await db.query.labels.findFirst({ where: and(eq(labels.id, labelId), scope.labels) });
  if (!label) return null;

  const labelReleases = await db.query.releases.findMany({
    where: and(eq(releases.labelId, labelId), scope.releases),
    orderBy: [asc(releases.releaseOrder)],
    limit: 400,
  });

  const counts = await Promise.all([
    db.select({ value: count() }).from(releases).where(and(eq(releases.labelId, labelId), scope.releases)),
    db.select({ value: count() }).from(releases).where(and(eq(releases.labelId, labelId), eq(releases.detailsFetched, true), scope.releases)),
    db.select({ value: count() }).from(releases).where(and(eq(releases.labelId, labelId), eq(releases.youtubeMatched, true), scope.releases)),
  ]);

  return {
    label,
    releases: labelReleases,
    progress: {
      total: counts[0][0]?.value ?? 0,
      processed: counts[1][0]?.value ?? 0,
      matched: counts[2][0]?.value ?? 0,
    },
  };
}

export async function getReleaseDetail(releaseId: number) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const release = await db.query.releases.findFirst({
    where: and(eq(releases.id, releaseId), scope.releases),
    with: { label: true, tracks: { with: { matches: true }, orderBy: [asc(tracks.id)] } },
  });
  return release;
}

export async function exportQueueRows() {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const rows = await db
    .select({
      id: queueItems.id,
      status: queueItems.status,
      youtubeVideoId: queueItems.youtubeVideoId,
      trackTitle: tracks.title,
      releaseTitle: releases.title,
      labelName: labels.name,
      addedAt: queueItems.addedAt,
    })
    .from(queueItems)
    .leftJoin(tracks, eq(queueItems.trackId, tracks.id))
    .leftJoin(releases, eq(queueItems.releaseId, releases.id))
    .leftJoin(labels, eq(queueItems.labelId, labels.id))
    .where(scope.queueItems)
    .orderBy(asc(queueItems.id));

  return rows;
}

export async function getToListenData(labelId?: number, onlyPlayable = true) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const whereClause = labelId
    ? and(or(eq(tracks.listened, false), eq(tracks.saved, true)), eq(releases.labelId, labelId), eq(labels.active, true), scope.tracks, scope.releases, scope.labels)
    : and(or(eq(tracks.listened, false), eq(tracks.saved, true)), eq(labels.active, true), scope.tracks, scope.releases, scope.labels);
  const playableClause = onlyPlayable ? isNotNull(youtubeMatches.id) : undefined;
  const combinedWhere = playableClause ? and(whereClause, playableClause, scope.youtubeMatches) : whereClause;

  const rows = await db
    .select({
      trackId: tracks.id,
      trackTitle: tracks.title,
      trackArtists: tracks.artistsText,
      position: tracks.position,
      duration: tracks.duration,
      listened: tracks.listened,
      saved: tracks.saved,
      releaseId: releases.id,
      releaseTitle: releases.title,
      releaseCatno: releases.catno,
      releaseArtist: releases.artist,
      releaseDiscogsUrl: releases.discogsUrl,
      releaseThumbUrl: releases.thumbUrl,
      releaseWishlist: releases.wishlist,
      importSource: releases.importSource,
      labelId: labels.id,
      labelName: labels.name,
      hasChosenVideo: isNotNull(youtubeMatches.id),
      videoEmbeddable: youtubeMatches.embeddable,
      matchChannelTitle: youtubeMatches.channelTitle,
    })
    .from(tracks)
    .innerJoin(releases, eq(tracks.releaseId, releases.id))
    .innerJoin(labels, eq(releases.labelId, labels.id))
    .leftJoin(youtubeMatches, and(eq(youtubeMatches.trackId, tracks.id), eq(youtubeMatches.chosen, true)))
    .where(combinedWhere)
    .orderBy(desc(tracks.saved), asc(labels.name), asc(releases.releaseOrder), asc(tracks.id))
    .limit(600);

  const trackIds = rows.map((row) => row.trackId);
  const [pendingQueueRows, playedQueueRows] = trackIds.length
    ? await Promise.all([
        db
      .select({ trackId: queueItems.trackId })
          .from(queueItems)
          .where(and(inArray(queueItems.trackId, trackIds), eq(queueItems.status, "pending"), scope.queueItems)),
        db
          .select({ trackId: queueItems.trackId })
          .from(queueItems)
          .where(and(inArray(queueItems.trackId, trackIds), eq(queueItems.status, "played"), scope.queueItems)),
      ])
    : [[], []];

  const pendingSet = new Set(pendingQueueRows.map((row) => row.trackId).filter((item): item is number => typeof item === "number"));
  const playedCountByTrack = new Map<number, number>();
  for (const row of playedQueueRows) {
    if (typeof row.trackId !== "number") continue;
    playedCountByTrack.set(row.trackId, (playedCountByTrack.get(row.trackId) ?? 0) + 1);
  }

  const enrichedRows = rows.map((row) => {
    const playbackSource: "discogs" | "youtube" | null =
      row.matchChannelTitle === "Discogs" ? "discogs" : row.hasChosenVideo ? "youtube" : null;

    return {
      ...row,
      hasChosenVideo: Boolean(row.hasChosenVideo),
      isUpNext: pendingSet.has(row.trackId),
      playedCount: playedCountByTrack.get(row.trackId) ?? 0,
      wasPlayed: (playedCountByTrack.get(row.trackId) ?? 0) > 0,
      needsMark: !row.listened && (playedCountByTrack.get(row.trackId) ?? 0) > 0,
      playbackSource,
    };
  });

  const allLabels = await db.query.labels.findMany({
    where: and(eq(labels.active, true), eq(labels.sourceType, "workspace"), scope.labels),
    orderBy: [asc(labels.name)],
  });
  return { rows: enrichedRows, labels: allLabels };
}

export async function getWishlistData(labelId?: number, onlyPlayable = false) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const whereClause = labelId
    ? and(or(eq(tracks.saved, true), eq(releases.wishlist, true)), eq(releases.labelId, labelId), scope.tracks, scope.releases, scope.labels)
    : and(or(eq(tracks.saved, true), eq(releases.wishlist, true)), scope.tracks, scope.releases, scope.labels);
  const playableClause = onlyPlayable ? isNotNull(youtubeMatches.id) : undefined;
  const combinedWhere = playableClause ? and(whereClause, playableClause, scope.youtubeMatches) : whereClause;

  const rows = await db
    .select({
      trackId: tracks.id,
      trackTitle: tracks.title,
      trackArtists: tracks.artistsText,
      position: tracks.position,
      duration: tracks.duration,
      listened: tracks.listened,
      saved: tracks.saved,
      releaseId: releases.id,
      releaseTitle: releases.title,
      releaseCatno: releases.catno,
      releaseArtist: releases.artist,
      releaseDiscogsUrl: releases.discogsUrl,
      releaseThumbUrl: releases.thumbUrl,
      releaseWishlist: releases.wishlist,
      importSource: releases.importSource,
      labelId: labels.id,
      labelName: labels.name,
      hasChosenVideo: isNotNull(youtubeMatches.id),
      videoEmbeddable: youtubeMatches.embeddable,
      matchChannelTitle: youtubeMatches.channelTitle,
    })
    .from(tracks)
    .innerJoin(releases, eq(tracks.releaseId, releases.id))
    .innerJoin(labels, eq(releases.labelId, labels.id))
    .leftJoin(youtubeMatches, and(eq(youtubeMatches.trackId, tracks.id), eq(youtubeMatches.chosen, true)))
    .where(combinedWhere)
    .orderBy(asc(tracks.listened), asc(labels.name), asc(releases.releaseOrder), asc(tracks.id))
    .limit(600);

  const trackIds = rows.map((row) => row.trackId);
  const [pendingQueueRows, playedQueueRows] = trackIds.length
    ? await Promise.all([
        db
          .select({ trackId: queueItems.trackId })
          .from(queueItems)
          .where(and(inArray(queueItems.trackId, trackIds), eq(queueItems.status, "pending"), scope.queueItems)),
        db
          .select({ trackId: queueItems.trackId })
          .from(queueItems)
          .where(and(inArray(queueItems.trackId, trackIds), eq(queueItems.status, "played"), scope.queueItems)),
      ])
    : [[], []];

  const pendingSet = new Set(pendingQueueRows.map((row) => row.trackId).filter((item): item is number => typeof item === "number"));
  const playedCountByTrack = new Map<number, number>();
  for (const row of playedQueueRows) {
    if (typeof row.trackId !== "number") continue;
    playedCountByTrack.set(row.trackId, (playedCountByTrack.get(row.trackId) ?? 0) + 1);
  }

  const enrichedRows = rows.map((row) => {
    const playbackSource: "discogs" | "youtube" | null =
      row.matchChannelTitle === "Discogs" ? "discogs" : row.hasChosenVideo ? "youtube" : null;

    return {
      ...row,
      hasChosenVideo: Boolean(row.hasChosenVideo),
      isUpNext: pendingSet.has(row.trackId),
      playedCount: playedCountByTrack.get(row.trackId) ?? 0,
      wasPlayed: (playedCountByTrack.get(row.trackId) ?? 0) > 0,
      needsMark: !row.listened && (playedCountByTrack.get(row.trackId) ?? 0) > 0,
      playbackSource,
    };
  });

  const allLabels = await db.query.labels.findMany({
    where: and(eq(labels.active, true), eq(labels.sourceType, "workspace"), scope.labels),
    orderBy: [asc(labels.name)],
  });
  return { rows: enrichedRows, labels: allLabels };
}

export async function getPlayedReviewedData(labelId?: number, onlyPlayable = false) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const playedTrackRows = await db
    .select({ trackId: queueItems.trackId })
    .from(queueItems)
    .innerJoin(releases, eq(queueItems.releaseId, releases.id))
    .innerJoin(labels, eq(releases.labelId, labels.id))
    .where(and(eq(queueItems.status, "played"), eq(labels.active, true), isNotNull(queueItems.trackId), scope.queueItems, scope.releases, scope.labels));

  const playedTrackIds = [
    ...new Set(
      playedTrackRows
        .map((row) => row.trackId)
        .filter((trackId): trackId is number => typeof trackId === "number"),
    ),
  ];

  const whereClause = labelId
    ? and(or(eq(tracks.listened, true), inArray(tracks.id, playedTrackIds.length ? playedTrackIds : [-1])), eq(releases.labelId, labelId), eq(labels.active, true), scope.tracks, scope.releases, scope.labels)
    : and(or(eq(tracks.listened, true), inArray(tracks.id, playedTrackIds.length ? playedTrackIds : [-1])), eq(labels.active, true), scope.tracks, scope.releases, scope.labels);
  const playableClause = onlyPlayable ? isNotNull(youtubeMatches.id) : undefined;
  const combinedWhere = playableClause ? and(whereClause, playableClause, scope.youtubeMatches) : whereClause;

  const rows = await db
    .select({
      trackId: tracks.id,
      trackTitle: tracks.title,
      trackArtists: tracks.artistsText,
      position: tracks.position,
      duration: tracks.duration,
      listened: tracks.listened,
      saved: tracks.saved,
      releaseId: releases.id,
      releaseTitle: releases.title,
      releaseCatno: releases.catno,
      releaseArtist: releases.artist,
      releaseDiscogsUrl: releases.discogsUrl,
      releaseThumbUrl: releases.thumbUrl,
      releaseWishlist: releases.wishlist,
      importSource: releases.importSource,
      labelId: labels.id,
      labelName: labels.name,
      hasChosenVideo: isNotNull(youtubeMatches.id),
      videoEmbeddable: youtubeMatches.embeddable,
      matchChannelTitle: youtubeMatches.channelTitle,
    })
    .from(tracks)
    .innerJoin(releases, eq(tracks.releaseId, releases.id))
    .innerJoin(labels, eq(releases.labelId, labels.id))
    .leftJoin(youtubeMatches, and(eq(youtubeMatches.trackId, tracks.id), eq(youtubeMatches.chosen, true)))
    .where(combinedWhere)
    .orderBy(desc(tracks.listened), desc(tracks.saved), asc(labels.name), asc(releases.releaseOrder), asc(tracks.id))
    .limit(800);

  const trackIds = rows.map((row) => row.trackId);
  const [pendingQueueRows, playedQueueRows] = trackIds.length
    ? await Promise.all([
        db
          .select({ trackId: queueItems.trackId })
          .from(queueItems)
          .where(and(inArray(queueItems.trackId, trackIds), eq(queueItems.status, "pending"), scope.queueItems)),
        db
          .select({ trackId: queueItems.trackId })
          .from(queueItems)
          .where(and(inArray(queueItems.trackId, trackIds), eq(queueItems.status, "played"), scope.queueItems)),
      ])
    : [[], []];

  const pendingSet = new Set(pendingQueueRows.map((row) => row.trackId).filter((item): item is number => typeof item === "number"));
  const playedCountByTrack = new Map<number, number>();
  for (const row of playedQueueRows) {
    if (typeof row.trackId !== "number") continue;
    playedCountByTrack.set(row.trackId, (playedCountByTrack.get(row.trackId) ?? 0) + 1);
  }

  const enrichedRows = rows.map((row) => {
    const playbackSource: "discogs" | "youtube" | null =
      row.matchChannelTitle === "Discogs" ? "discogs" : row.hasChosenVideo ? "youtube" : null;

    return {
      ...row,
      hasChosenVideo: Boolean(row.hasChosenVideo),
      isUpNext: pendingSet.has(row.trackId),
      playedCount: playedCountByTrack.get(row.trackId) ?? 0,
      wasPlayed: (playedCountByTrack.get(row.trackId) ?? 0) > 0,
      needsMark: !row.listened && (playedCountByTrack.get(row.trackId) ?? 0) > 0,
      playbackSource,
    };
  });

  const allLabels = await db.query.labels.findMany({
    where: and(eq(labels.active, true), eq(labels.sourceType, "workspace"), scope.labels),
    orderBy: [asc(labels.name)],
  });
  return { rows: enrichedRows, labels: allLabels };
}

export async function getWishlistedRecordsData(labelId?: number) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const whereClause = labelId
    ? and(eq(releases.wishlist, true), eq(releases.labelId, labelId), scope.releases, scope.labels)
    : and(eq(releases.wishlist, true), scope.releases, scope.labels);

  const rows = await db
    .select({
      releaseId: releases.id,
      releaseTitle: releases.title,
      releaseArtist: releases.artist,
      releaseYear: releases.year,
      releaseCatno: releases.catno,
      releaseDiscogsUrl: releases.discogsUrl,
      releaseThumbUrl: releases.thumbUrl,
      importSource: releases.importSource,
      labelId: labels.id,
      labelName: labels.name,
    })
    .from(releases)
    .innerJoin(labels, eq(releases.labelId, labels.id))
    .where(whereClause)
    .orderBy(asc(labels.name), asc(releases.releaseOrder), asc(releases.id))
    .limit(600);

  return { rows };
}
