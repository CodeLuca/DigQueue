import { and, asc, count, desc, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { labels, queueItems, releases, sourceReleases, tracks, youtubeMatches } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { parseBpmFromTexts } from "@/lib/bpm";
import { db } from "@/lib/db";
import { parseDiscogsReleaseIdFromUrl } from "@/lib/discogs-release-id";
import { buildDeepRecommendations, buildExternalRecommendations } from "@/lib/recommendations";
import { isTransientLabelError } from "@/lib/utils";

function userScope(userId: string) {
  return {
    labels: sql`${labels.userId} = ${userId}::uuid`,
    sourceReleases: sql`${sourceReleases.userId} = ${userId}::uuid`,
    releases: sql`${releases.userId} = ${userId}::uuid`,
    tracks: sql`${tracks.userId} = ${userId}::uuid`,
    queueItems: sql`${queueItems.userId} = ${userId}::uuid`,
    youtubeMatches: sql`${youtubeMatches.userId} = ${userId}::uuid`,
  };
}

type InboxRow = {
  trackId: number;
  trackTitle: string;
  trackArtists: string | null;
  position: string;
  duration: string | null;
  bpm: number | null;
  listened: boolean;
  saved: boolean;
  releaseId: number;
  releaseTitle: string;
  releaseCatno: string | null;
  releaseArtist: string | null;
  releaseDiscogsUrl: string;
  releaseThumbUrl: string | null;
  releaseWishlist: boolean;
  importSource: string;
  labelId: number;
  labelName: string;
  labelActive: boolean;
  hasChosenVideo: boolean;
  youtubeVideoId: string | null;
  videoEmbeddable: boolean | null;
  isUpNext: boolean;
  playedCount: number;
  wasPlayed: boolean;
  needsMark: boolean;
  playbackSource: "discogs" | "youtube" | null;
  lastPlayedQueueId?: number;
};

function normalizeValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function dedupeInboxRows(rows: InboxRow[]) {
  const grouped = new Map<string, InboxRow[]>();
  for (const row of rows) {
    const key = [
      normalizeValue(row.releaseDiscogsUrl),
      normalizeValue(row.position),
      normalizeValue(row.trackTitle),
    ].join("::");
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  const deduped: InboxRow[] = [];
  for (const variants of grouped.values()) {
    if (variants.length === 1) {
      deduped.push(variants[0]);
      continue;
    }

    const primary =
      variants.find((row) => row.saved && row.importSource !== "discogs_want") ??
      variants.find((row) => row.saved) ??
      variants.find((row) => row.importSource !== "discogs_want") ??
      variants[0];

    const hasWishlistTrue = variants.some((row) => row.releaseWishlist);
    const hasWishlistFalse = variants.some((row) => !row.releaseWishlist);
    const nonWantWishlist = variants.find((row) => row.importSource !== "discogs_want")?.releaseWishlist;
    const releaseWishlist =
      hasWishlistTrue && hasWishlistFalse && typeof nonWantWishlist === "boolean"
        ? nonWantWishlist
        : hasWishlistTrue;

    const playedCount = Math.max(...variants.map((row) => row.playedCount));
    const listened = variants.some((row) => row.listened);

    const hasEmbeddableTrue = variants.some((row) => row.videoEmbeddable === true);
    const hasEmbeddableFalse = variants.some((row) => row.videoEmbeddable === false);
    const hasEmbeddableKnown = variants.some((row) => row.videoEmbeddable !== null);

    deduped.push({
      ...primary,
      labelActive: variants.some((row) => row.labelActive),
      bpm: variants.find((row) => typeof row.bpm === "number")?.bpm ?? primary.bpm ?? null,
      listened,
      saved: variants.some((row) => row.saved),
      releaseWishlist,
      hasChosenVideo: variants.some((row) => row.hasChosenVideo),
      youtubeVideoId: variants.find((row) => row.youtubeVideoId)?.youtubeVideoId ?? null,
      videoEmbeddable: hasEmbeddableTrue ? true : hasEmbeddableFalse ? false : hasEmbeddableKnown ? (variants.find((row) => row.videoEmbeddable !== null)?.videoEmbeddable ?? null) : null,
      isUpNext: variants.some((row) => row.isUpNext),
      playedCount,
      wasPlayed: playedCount > 0,
      needsMark: !listened && playedCount > 0,
      lastPlayedQueueId: Math.max(...variants.map((row) => row.lastPlayedQueueId ?? 0)),
    });
  }

  return deduped;
}

type PlaybackRow = {
  trackId: number;
  hasChosenVideo: unknown;
  youtubeVideoId: string | null;
  videoEmbeddable: boolean | null;
  matchChannelTitle?: string | null;
};

const inboxRowSelection = {
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
  labelActive: labels.active,
  hasChosenVideo: isNotNull(youtubeMatches.id),
  youtubeVideoId: youtubeMatches.videoId,
  videoEmbeddable: youtubeMatches.embeddable,
  matchChannelTitle: youtubeMatches.channelTitle,
};

const wishlistedReleaseRowSelection = {
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
};

type InboxQueryRow = Omit<
  InboxRow,
  "bpm" | "hasChosenVideo" | "isUpNext" | "playedCount" | "wasPlayed" | "needsMark" | "playbackSource" | "lastPlayedQueueId"
> & PlaybackRow;

async function backfillPlayableRows<T extends PlaybackRow>(rows: T[], userId: string) {
  const missingTrackIds = [
    ...new Set(
      rows
        .filter((row) => !row.youtubeVideoId)
        .map((row) => row.trackId)
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (missingTrackIds.length === 0) return rows;

  const matchRows = await db.query.youtubeMatches.findMany({
    where: and(inArray(youtubeMatches.trackId, missingTrackIds), eq(youtubeMatches.userId, userId)),
    columns: {
      trackId: true,
      videoId: true,
      channelTitle: true,
      embeddable: true,
      chosen: true,
      score: true,
      id: true,
    },
    orderBy: [desc(youtubeMatches.chosen), desc(youtubeMatches.embeddable), desc(youtubeMatches.score), desc(youtubeMatches.id)],
  });
  const bestMatchByTrack = new Map<number, (typeof matchRows)[number]>();
  for (const row of matchRows) {
    if (!bestMatchByTrack.has(row.trackId)) bestMatchByTrack.set(row.trackId, row);
  }

  const stillMissingTrackIds = missingTrackIds.filter((trackId) => !bestMatchByTrack.has(trackId));
  const queueRows =
    stillMissingTrackIds.length > 0
      ? await db.query.queueItems.findMany({
          where: and(
            inArray(queueItems.trackId, stillMissingTrackIds),
            eq(queueItems.userId, userId),
            eq(queueItems.status, "pending"),
          ),
          columns: { trackId: true, youtubeVideoId: true, id: true },
          orderBy: [desc(queueItems.id)],
        })
      : [];
  const queuedVideoByTrack = new Map<number, string>();
  for (const row of queueRows) {
    if (typeof row.trackId !== "number" || !row.youtubeVideoId) continue;
    if (!queuedVideoByTrack.has(row.trackId)) queuedVideoByTrack.set(row.trackId, row.youtubeVideoId);
  }

  return rows.map((row) => {
    if (row.youtubeVideoId) return row;
    const match = bestMatchByTrack.get(row.trackId);
    if (match) {
      return {
        ...row,
        hasChosenVideo: true,
        youtubeVideoId: match.videoId,
        videoEmbeddable: match.embeddable,
        matchChannelTitle: match.channelTitle,
      };
    }
    const queuedVideoId = queuedVideoByTrack.get(row.trackId);
    if (queuedVideoId) {
      return {
        ...row,
        hasChosenVideo: true,
        youtubeVideoId: queuedVideoId,
        videoEmbeddable: true,
        matchChannelTitle: row.matchChannelTitle ?? "Queue",
      };
    }
    return row;
  });
}

type DashboardTab = "step-1" | "step-2" | "library" | "wishlist" | "played-reviewed" | "recommendations";

async function getQueueTrackState(trackIds: number[], queueScope: ReturnType<typeof userScope>["queueItems"]) {
  if (trackIds.length === 0) {
    return {
      pendingSet: new Set<number>(),
      playedCountByTrack: new Map<number, number>(),
      playedLastIdByTrack: new Map<number, number>(),
    };
  }

  const [pendingQueueRows, playedQueueRows] = await Promise.all([
    db
      .select({ trackId: queueItems.trackId })
      .from(queueItems)
      .where(and(inArray(queueItems.trackId, trackIds), eq(queueItems.status, "pending"), queueScope))
      .groupBy(queueItems.trackId),
    db
      .select({
        trackId: queueItems.trackId,
        value: count(),
        lastId: sql<number>`max(${queueItems.id})`,
      })
      .from(queueItems)
      .where(and(inArray(queueItems.trackId, trackIds), eq(queueItems.status, "played"), queueScope))
      .groupBy(queueItems.trackId),
  ]);

  const pendingSet = new Set(
    pendingQueueRows.map((row) => row.trackId).filter((item): item is number => typeof item === "number"),
  );
  const playedCountByTrack = new Map<number, number>();
  const playedLastIdByTrack = new Map<number, number>();
  for (const row of playedQueueRows) {
    if (typeof row.trackId !== "number") continue;
    playedCountByTrack.set(row.trackId, Number(row.value) || 0);
    playedLastIdByTrack.set(row.trackId, Number(row.lastId) || 0);
  }

  return { pendingSet, playedCountByTrack, playedLastIdByTrack };
}

function uniqueTrackIds(rows: Array<{ trackId: number | null }>) {
  return [
    ...new Set(
      rows
        .map((row) => row.trackId)
        .filter((trackId): trackId is number => typeof trackId === "number"),
    ),
  ];
}

function trackIdsOrFallback(trackIds: number[]) {
  return trackIds.length ? trackIds : [-1];
}

function mapCountRowsByLabel(rows: Array<{ labelId: number; value: number }>) {
  const counts = new Map<number, number>();
  for (const row of rows) {
    counts.set(row.labelId, row.value);
  }
  return counts;
}

type LabelMetadataInput = {
  active?: boolean;
  discogsUrl?: string | null;
  entityKind?: string;
  externalDiscogsId?: number | null;
  id: number;
  lastError?: string | null;
  name?: string;
  notableReleasesJson?: unknown;
  retryCount?: number | null;
  status?: string;
  blurb: string | null;
  currentPage: number;
  totalPages: number;
  updatedAt?: Date | string | null;
  imageUrl?: string | null;
};

type LabelDetailRelease = NonNullable<
  Awaited<ReturnType<typeof db.query.releases.findMany>>[number]
>;

type LabelMetadataRow<TLabel extends LabelMetadataInput> = TLabel & {
  imageUrl: string | null;
  summaryText: string;
  loadedTrackCount: number;
  loadedReleaseCount: number;
  fetchedReleaseCount: number;
  tracksFullyLoaded: boolean;
};

type DashboardLabel = LabelMetadataRow<
  Awaited<ReturnType<typeof db.query.labels.findMany>>[number]
>;

type DashboardMetrics = {
  unplayedTracks: number;
  playedItems: number;
  doneTracks: number;
  savedTracks: number;
  wishlistedRecords: number;
  labelsErrored: number;
  releasesLowConfidence: number;
};

type DashboardResult = {
  labels: DashboardLabel[];
  queueCount: number;
  metrics: DashboardMetrics;
  erroredLabels: Awaited<ReturnType<typeof db.query.labels.findMany>>;
  recentlyPlayed: [];
  recommendations: Awaited<ReturnType<typeof buildDeepRecommendations>>;
  externalRecommendations: Awaited<ReturnType<typeof buildExternalRecommendations>>;
};

type WorkspaceLabel = Awaited<ReturnType<typeof db.query.labels.findMany>>[number];
type LabelProgressSummary = {
  total: number;
  processed: number;
  matched: number;
};
type InboxResult = {
  rows: InboxRow[];
  labels: WorkspaceLabel[];
};
type WishlistedRecordsResult = {
  rows: Awaited<ReturnType<typeof loadWishlistedReleaseRowsForMode>>;
};
type LabelDetailResult = {
  label: WorkspaceLabel;
  releases: LabelDetailRelease[];
  progress: LabelProgressSummary;
} | null;

type CountRows = Array<{ value: number }>;
type LabelCountRows = Array<{ labelId: number; value: number }>;
type InboxOrderBy = Array<ReturnType<typeof asc> | ReturnType<typeof desc>>;
type QueryJoinMode = "sourceBacked" | "legacy";

function buildLabelMetadataRows<TLabel extends LabelMetadataInput>(
  labels: TLabel[],
  counts: {
    releaseCountByLabel: Map<number, number>;
    fetchedReleaseCountByLabel: Map<number, number>;
    trackCountByLabel: Map<number, number>;
  },
  options?: { thumbByLabel?: Map<number, string> },
): Array<LabelMetadataRow<TLabel>> {
  return labels.map((label) => {
    const loadedReleaseCount = counts.releaseCountByLabel.get(label.id) ?? 0;
    const fetchedReleaseCount = counts.fetchedReleaseCountByLabel.get(label.id) ?? 0;
    const loadedTrackCount = counts.trackCountByLabel.get(label.id) ?? 0;
    const pagesDone = label.currentPage > Math.max(1, label.totalPages);
    const releasesFullyLoaded = loadedReleaseCount > 0 && fetchedReleaseCount >= loadedReleaseCount;
    const tracksFullyLoaded = pagesDone && releasesFullyLoaded;
    const summaryText =
      label.blurb ||
      `${loadedReleaseCount} release${loadedReleaseCount === 1 ? "" : "s"} loaded • page ${label.currentPage}/${Math.max(1, label.totalPages)}`;

    return {
      ...label,
      imageUrl: label.imageUrl || options?.thumbByLabel?.get(label.id) || null,
      summaryText,
      loadedTrackCount,
      loadedReleaseCount,
      fetchedReleaseCount,
      tracksFullyLoaded,
    };
  });
}

function buildLabelProgress(counts: Array<Array<{ value: number }>>) {
  return {
    total: counts[0][0]?.value ?? 0,
    processed: counts[1][0]?.value ?? 0,
    matched: counts[2][0]?.value ?? 0,
  };
}

function buildEmptyDashboardMetrics(): DashboardMetrics {
  return {
    unplayedTracks: 0,
    playedItems: 0,
    doneTracks: 0,
    savedTracks: 0,
    wishlistedRecords: 0,
    labelsErrored: 0,
    releasesLowConfidence: 0,
  };
}

function zeroCountRows(): CountRows {
  return [{ value: 0 }];
}

function emptyLabelCountRows(): LabelCountRows {
  return [];
}

function buildEmptyLabelMetadataCounts() {
  return {
    thumbByLabel: new Map<number, string>(),
    releaseCountByLabel: mapCountRowsByLabel(emptyLabelCountRows()),
    fetchedReleaseCountByLabel: mapCountRowsByLabel(emptyLabelCountRows()),
    trackCountByLabel: mapCountRowsByLabel(emptyLabelCountRows()),
  };
}

function buildDashboardResult({
  labels,
  queueCount = 0,
  metrics,
  erroredLabels = [],
  recommendations = [],
  externalRecommendations = [],
}: {
  labels: DashboardResult["labels"];
  queueCount?: number;
  metrics?: Partial<DashboardMetrics>;
  erroredLabels?: DashboardResult["erroredLabels"];
  recommendations?: DashboardResult["recommendations"];
  externalRecommendations?: DashboardResult["externalRecommendations"];
}): DashboardResult {
  return {
    labels,
    queueCount,
    metrics: {
      ...buildEmptyDashboardMetrics(),
      ...metrics,
    },
    erroredLabels,
    recentlyPlayed: [],
    recommendations,
    externalRecommendations,
  };
}

function buildDashboardMetricsFromTotals(options: {
  scopedTotals: CountRows[];
  erroredLabels: DashboardResult["erroredLabels"];
  lowConfidenceCount: CountRows;
}): DashboardMetrics {
  return {
    unplayedTracks: options.scopedTotals[0][0]?.value ?? 0,
    playedItems: options.scopedTotals[1][0]?.value ?? 0,
    doneTracks: options.scopedTotals[2][0]?.value ?? 0,
    savedTracks: options.scopedTotals[3][0]?.value ?? 0,
    wishlistedRecords: options.scopedTotals[4][0]?.value ?? 0,
    labelsErrored: options.erroredLabels.length,
    releasesLowConfidence: options.lowConfidenceCount[0]?.value ?? 0,
  };
}

function buildThumbByLabel(rows: Array<{ labelId: number; thumbUrl: string | null }>) {
  const thumbByLabel = new Map<number, string>();
  for (const row of rows) {
    if (!row.thumbUrl) continue;
    if (!thumbByLabel.has(row.labelId)) {
      thumbByLabel.set(row.labelId, row.thumbUrl);
    }
  }
  return thumbByLabel;
}

async function getDashboardLabelMetadataCountsForMode(
  mode: QueryJoinMode,
  scope: ReturnType<typeof userScope>,
) {
  if (mode === "sourceBacked") {
    const [releaseThumbRows, releaseCountRows, fetchedReleaseRows, trackCountRows] = await Promise.all([
      db
        .select({ labelId: sourceReleases.sourceId, thumbUrl: releases.thumbUrl })
        .from(sourceReleases)
        .innerJoin(releases, eq(sourceReleases.releaseId, releases.id))
        .where(and(isNotNull(releases.thumbUrl), scope.sourceReleases, scope.releases))
        .orderBy(asc(sourceReleases.sourceId), asc(sourceReleases.releaseOrder)),
      db
        .select({ labelId: sourceReleases.sourceId, value: count() })
        .from(sourceReleases)
        .where(scope.sourceReleases)
        .groupBy(sourceReleases.sourceId),
      db
        .select({ labelId: sourceReleases.sourceId, value: count() })
        .from(sourceReleases)
        .innerJoin(releases, eq(sourceReleases.releaseId, releases.id))
        .where(and(eq(releases.detailsFetched, true), scope.sourceReleases, scope.releases))
        .groupBy(sourceReleases.sourceId),
      db
        .select({ labelId: sourceReleases.sourceId, value: count() })
        .from(tracks)
        .innerJoin(releases, eq(tracks.releaseId, releases.id))
        .innerJoin(sourceReleases, eq(sourceReleases.releaseId, releases.id))
        .where(and(scope.tracks, scope.releases, scope.sourceReleases))
        .groupBy(sourceReleases.sourceId),
    ]);

    return {
      thumbByLabel: buildThumbByLabel(releaseThumbRows),
      releaseCountByLabel: mapCountRowsByLabel(releaseCountRows),
      fetchedReleaseCountByLabel: mapCountRowsByLabel(fetchedReleaseRows),
      trackCountByLabel: mapCountRowsByLabel(trackCountRows),
    };
  }

  const [releaseCountRows, fetchedReleaseRows, trackCountRows] = await Promise.all([
    db
      .select({ labelId: releases.labelId, value: count() })
      .from(releases)
      .where(scope.releases)
      .groupBy(releases.labelId),
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

  return {
    thumbByLabel: new Map<number, string>(),
    releaseCountByLabel: mapCountRowsByLabel(releaseCountRows),
    fetchedReleaseCountByLabel: mapCountRowsByLabel(fetchedReleaseRows),
    trackCountByLabel: mapCountRowsByLabel(trackCountRows),
  };
}

async function countPendingUnlistenedQueueItemsForActiveSources(
  scope: ReturnType<typeof userScope>,
) {
  return db
    .select({ value: count() })
    .from(queueItems)
    .innerJoin(tracks, eq(queueItems.trackId, tracks.id))
    .innerJoin(releases, eq(tracks.releaseId, releases.id))
    .innerJoin(sourceReleases, eq(sourceReleases.releaseId, releases.id))
    .innerJoin(labels, eq(sourceReleases.sourceId, labels.id))
    .where(
      and(
        eq(queueItems.status, "pending"),
        eq(tracks.listened, false),
        eq(labels.active, true),
        scope.queueItems,
        scope.tracks,
        scope.releases,
        scope.sourceReleases,
        scope.labels,
      ),
    );
}

async function countActiveSourceTracks(
  scope: ReturnType<typeof userScope>,
  trackCondition: ReturnType<typeof eq>,
) {
  return db
    .select({ value: count() })
    .from(tracks)
    .innerJoin(releases, eq(tracks.releaseId, releases.id))
    .innerJoin(sourceReleases, eq(sourceReleases.releaseId, releases.id))
    .innerJoin(labels, eq(sourceReleases.sourceId, labels.id))
    .where(and(trackCondition, eq(labels.active, true), scope.tracks, scope.releases, scope.sourceReleases, scope.labels));
}

async function countActiveSourceQueueItems(
  scope: ReturnType<typeof userScope>,
  queueCondition: ReturnType<typeof eq>,
) {
  return db
    .select({ value: count() })
    .from(queueItems)
    .innerJoin(releases, eq(queueItems.releaseId, releases.id))
    .innerJoin(sourceReleases, eq(sourceReleases.releaseId, releases.id))
    .innerJoin(labels, eq(sourceReleases.sourceId, labels.id))
    .where(and(queueCondition, eq(labels.active, true), scope.queueItems, scope.releases, scope.sourceReleases, scope.labels));
}

async function countActiveSourceReleases(
  scope: ReturnType<typeof userScope>,
  releaseCondition: ReturnType<typeof eq> | ReturnType<typeof and>,
) {
  return db
    .select({ value: count() })
    .from(releases)
    .innerJoin(sourceReleases, eq(sourceReleases.releaseId, releases.id))
    .innerJoin(labels, eq(sourceReleases.sourceId, labels.id))
    .where(and(releaseCondition, eq(labels.active, true), scope.releases, scope.sourceReleases, scope.labels));
}

async function getLabelReleasesForMode(
  mode: QueryJoinMode,
  labelId: number,
  scope: ReturnType<typeof userScope>,
) {
  if (mode === "sourceBacked") {
    const labelMappings = await db.query.sourceReleases.findMany({
      where: and(eq(sourceReleases.sourceId, labelId), scope.sourceReleases),
      orderBy: [asc(sourceReleases.releaseOrder)],
      limit: 400,
      with: { release: true },
    });

    return labelMappings
      .map((item) => item.release)
      .filter((item): item is LabelDetailRelease => Boolean(item));
  }

  return db.query.releases.findMany({
    where: and(eq(releases.labelId, labelId), scope.releases),
    orderBy: [asc(releases.releaseOrder)],
    limit: 400,
  });
}

async function getLabelProgressCountsForMode(
  mode: QueryJoinMode,
  labelId: number,
  scope: ReturnType<typeof userScope>,
) {
  if (mode === "sourceBacked") {
    return Promise.all([
      db.select({ value: count() }).from(sourceReleases).where(and(eq(sourceReleases.sourceId, labelId), scope.sourceReleases)),
      db
        .select({ value: count() })
        .from(sourceReleases)
        .innerJoin(releases, eq(sourceReleases.releaseId, releases.id))
        .where(and(eq(sourceReleases.sourceId, labelId), eq(releases.detailsFetched, true), scope.sourceReleases, scope.releases)),
      db
        .select({ value: count() })
        .from(sourceReleases)
        .innerJoin(releases, eq(sourceReleases.releaseId, releases.id))
        .where(and(eq(sourceReleases.sourceId, labelId), eq(releases.youtubeMatched, true), scope.sourceReleases, scope.releases)),
    ]);
  }

  return Promise.all([
    db.select({ value: count() }).from(releases).where(and(eq(releases.labelId, labelId), scope.releases)),
    db.select({ value: count() }).from(releases).where(and(eq(releases.labelId, labelId), eq(releases.detailsFetched, true), scope.releases)),
    db.select({ value: count() }).from(releases).where(and(eq(releases.labelId, labelId), eq(releases.youtubeMatched, true), scope.releases)),
  ]);
}

async function getLabelDetailForMode(
  mode: QueryJoinMode,
  labelId: number,
  scope: ReturnType<typeof userScope>,
) {
  const [labelReleases, counts] = await Promise.all([
    getLabelReleasesForMode(mode, labelId, scope),
    getLabelProgressCountsForMode(mode, labelId, scope),
  ]);

  return {
    releases: labelReleases,
    progress: buildLabelProgress(counts),
  };
}

async function getLegacyDashboardLabels(scope: ReturnType<typeof userScope>) {
  const [legacyLabelRows, counts] = await Promise.all([
    db.query.labels.findMany({
      where: and(eq(labels.sourceType, "workspace"), scope.labels),
      orderBy: [asc(labels.addedAt)],
    }),
    getDashboardLabelMetadataCountsForMode("legacy", scope),
  ]);

  return buildLabelMetadataRows(legacyLabelRows, counts);
}

async function withLegacySourceFallback<T>(
  primary: () => Promise<T>,
  legacy: () => Promise<T>,
  emptyValue: T,
) {
  try {
    return await primary();
  } catch {
    try {
      return await legacy();
    } catch {
      return emptyValue;
    }
  }
}

async function withQueryJoinModeFallback<T>(
  loadForMode: (mode: QueryJoinMode) => Promise<T>,
  emptyValue: T,
) {
  return withLegacySourceFallback(
    () => loadForMode("sourceBacked"),
    () => loadForMode("legacy"),
    emptyValue,
  );
}

function enrichInboxRows<TRow extends InboxQueryRow>(
  rows: TRow[],
  queueState: Awaited<ReturnType<typeof getQueueTrackState>>,
): InboxRow[] {
  return rows.map((row) => {
    const playedCount = queueState.playedCountByTrack.get(row.trackId) ?? 0;
    const playbackSource: "discogs" | "youtube" | null =
      row.matchChannelTitle === "Discogs" ? "discogs" : row.hasChosenVideo ? "youtube" : null;

    return {
      ...row,
      bpm: parseBpmFromTexts([row.trackTitle, row.releaseTitle]),
      hasChosenVideo: Boolean(row.hasChosenVideo),
      isUpNext: queueState.pendingSet.has(row.trackId),
      playedCount,
      wasPlayed: playedCount > 0,
      needsMark: !row.listened && playedCount > 0,
      playbackSource,
      lastPlayedQueueId: queueState.playedLastIdByTrack.get(row.trackId) ?? 0,
    };
  });
}

async function getActiveWorkspaceLabels(scope: ReturnType<typeof userScope>) {
  return db.query.labels.findMany({
    where: and(eq(labels.active, true), eq(labels.sourceType, "workspace"), scope.labels),
    orderBy: [asc(labels.name)],
  });
}

function withPlayableInboxWhere(
  whereClause: ReturnType<typeof and>,
  onlyPlayable: boolean,
  scope: ReturnType<typeof userScope>,
) {
  const playableClause = onlyPlayable ? isNotNull(youtubeMatches.id) : undefined;
  return playableClause ? and(whereClause, playableClause, scope.youtubeMatches) : whereClause;
}

function buildInboxModeWhere(args: {
  mode: QueryJoinMode;
  labelId?: number;
  scope: ReturnType<typeof userScope>;
  baseWhereClause: ReturnType<typeof and>;
  requireActive?: boolean;
}) {
  const scopedLabelClause = args.labelId
    ? args.mode === "sourceBacked"
      ? eq(sourceReleases.sourceId, args.labelId)
      : eq(releases.labelId, args.labelId)
    : undefined;
  const activeClause = args.requireActive ? eq(labels.active, true) : undefined;

  return and(
    args.baseWhereClause,
    scopedLabelClause,
    activeClause,
    args.scope.tracks,
    args.scope.releases,
    args.scope.labels,
    args.mode === "sourceBacked" ? args.scope.sourceReleases : undefined,
  );
}

async function loadInboxRowsForMode(args: {
  mode: QueryJoinMode;
  labelId?: number;
  scope: ReturnType<typeof userScope>;
  baseWhereClause: ReturnType<typeof and>;
  onlyPlayable: boolean;
  orderBy: InboxOrderBy;
  limit: number;
}) {
  const whereClause = withPlayableInboxWhere(
    buildInboxModeWhere({
      mode: args.mode,
      labelId: args.labelId,
      scope: args.scope,
      baseWhereClause: args.baseWhereClause,
      requireActive: true,
    }),
    args.onlyPlayable,
    args.scope,
  );

  return args.mode === "sourceBacked"
    ? loadSourceBackedInboxRows({
        whereClause,
        orderBy: args.orderBy,
        limit: args.limit,
      })
    : loadReleaseLabelInboxRows({
        whereClause,
        orderBy: args.orderBy,
        limit: args.limit,
      });
}

async function loadInboxResultForMode(args: {
  mode: QueryJoinMode;
  labelId?: number;
  scope: ReturnType<typeof userScope>;
  userId: string;
  baseWhereClause: ReturnType<typeof and>;
  onlyPlayable: boolean;
  orderBy: InboxOrderBy;
  limit: number;
  hydratePlayable?: boolean;
}) {
  const rows = await loadInboxRowsForMode({
    mode: args.mode,
    labelId: args.labelId,
    scope: args.scope,
    baseWhereClause: args.baseWhereClause,
    onlyPlayable: args.onlyPlayable,
    orderBy: args.orderBy,
    limit: args.limit,
  });

  return finalizeInboxResult(rows, args.scope, {
    hydratePlayable: args.hydratePlayable,
    userId: args.userId,
  });
}

async function loadSourceBackedInboxRows(args: {
  whereClause: ReturnType<typeof and>;
  orderBy: InboxOrderBy;
  limit: number;
}) {
  return db
    .select(inboxRowSelection)
    .from(tracks)
    .innerJoin(releases, eq(tracks.releaseId, releases.id))
    .innerJoin(sourceReleases, eq(sourceReleases.releaseId, releases.id))
    .innerJoin(labels, eq(sourceReleases.sourceId, labels.id))
    .leftJoin(youtubeMatches, and(eq(youtubeMatches.trackId, tracks.id), eq(youtubeMatches.chosen, true)))
    .where(args.whereClause)
    .orderBy(...args.orderBy)
    .limit(args.limit);
}

async function loadReleaseLabelInboxRows(args: {
  whereClause: ReturnType<typeof and>;
  orderBy: InboxOrderBy;
  limit: number;
}) {
  return db
    .select(inboxRowSelection)
    .from(tracks)
    .innerJoin(releases, eq(tracks.releaseId, releases.id))
    .innerJoin(labels, eq(releases.labelId, labels.id))
    .leftJoin(youtubeMatches, and(eq(youtubeMatches.trackId, tracks.id), eq(youtubeMatches.chosen, true)))
    .where(args.whereClause)
    .orderBy(...args.orderBy)
    .limit(args.limit);
}

async function getPlayedTrackIdsFromQueue(
  scope: ReturnType<typeof userScope>,
  mode: QueryJoinMode,
) {
  const playedTrackRows = mode === "sourceBacked"
    ? await db
        .select({ trackId: queueItems.trackId })
        .from(queueItems)
        .innerJoin(releases, eq(queueItems.releaseId, releases.id))
        .innerJoin(sourceReleases, eq(sourceReleases.releaseId, releases.id))
        .innerJoin(labels, eq(sourceReleases.sourceId, labels.id))
        .where(and(eq(queueItems.status, "played"), eq(labels.active, true), isNotNull(queueItems.trackId), scope.queueItems, scope.releases, scope.sourceReleases, scope.labels))
        .groupBy(queueItems.trackId)
    : await db
        .select({ trackId: queueItems.trackId })
        .from(queueItems)
        .innerJoin(releases, eq(queueItems.releaseId, releases.id))
        .innerJoin(labels, eq(releases.labelId, labels.id))
        .where(and(eq(queueItems.status, "played"), eq(labels.active, true), isNotNull(queueItems.trackId), scope.queueItems, scope.releases, scope.labels))
        .groupBy(queueItems.trackId);

  return uniqueTrackIds(playedTrackRows);
}

async function loadWishlistedReleaseRowsForMode(args: {
  mode: QueryJoinMode;
  labelId?: number;
  scope: ReturnType<typeof userScope>;
  limit: number;
}) {
  if (args.mode === "sourceBacked") {
    const whereClause = and(
      eq(releases.wishlist, true),
      args.labelId ? eq(sourceReleases.sourceId, args.labelId) : undefined,
      args.scope.releases,
      args.scope.sourceReleases,
      args.scope.labels,
    );

    return db
      .select(wishlistedReleaseRowSelection)
      .from(releases)
      .innerJoin(sourceReleases, eq(sourceReleases.releaseId, releases.id))
      .innerJoin(labels, eq(sourceReleases.sourceId, labels.id))
      .where(whereClause)
      .orderBy(asc(labels.name), asc(sourceReleases.releaseOrder), asc(releases.id))
      .limit(args.limit);
  }

  const whereClause = and(
    eq(releases.wishlist, true),
    args.labelId ? eq(releases.labelId, args.labelId) : undefined,
    args.scope.releases,
    args.scope.labels,
  );

  return db
    .select(wishlistedReleaseRowSelection)
    .from(releases)
    .innerJoin(labels, eq(releases.labelId, labels.id))
    .where(whereClause)
    .orderBy(asc(labels.name), asc(releases.releaseOrder), asc(releases.id))
    .limit(args.limit);
}

async function finalizeInboxResult<TRow extends InboxQueryRow>(
  rows: TRow[],
  scope: ReturnType<typeof userScope>,
  options?: { userId?: string; hydratePlayable?: boolean },
) {
  const playableRows = options?.hydratePlayable ? await backfillPlayableRows(rows, options.userId ?? "") : rows;
  const queueState = await getQueueTrackState(
    playableRows.map((row) => row.trackId),
    scope.queueItems,
  );
  const [allLabels] = await Promise.all([
    getActiveWorkspaceLabels(scope),
  ]);
  return {
    rows: dedupeInboxRows(enrichInboxRows(playableRows, queueState)),
    labels: allLabels,
  };
}

export async function getDashboardData(options?: { includeRecommendations?: boolean; tab?: DashboardTab }): Promise<DashboardResult> {
  const tab = options?.tab ?? "step-1";
  const includeRecommendations = options?.includeRecommendations ?? tab === "recommendations";
  const needsLabelProgress = tab === "step-1";
  const needsListeningMetrics = tab === "step-2";
  const needsWishlistMetric = tab === "wishlist" || tab === "library";
  const needsPlayedMetrics = tab === "played-reviewed" || tab === "library";
  const needsQueueCount = tab === "step-2";
  const needsErrorSummary = tab === "step-2";
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  try {
    const [
      labelRows,
      allLabelNameRows,
      labelProgress,
      queueCountRows,
    ] = await Promise.all([
      db.query.labels.findMany({
        where: and(eq(labels.sourceType, "workspace"), scope.labels),
        orderBy: [asc(labels.addedAt)],
      }),
      includeRecommendations
        ? db.query.labels.findMany({
            where: scope.labels,
            columns: { name: true },
            orderBy: [asc(labels.name)],
          })
        : Promise.resolve([]),
      needsLabelProgress
        ? getDashboardLabelMetadataCountsForMode("sourceBacked", scope)
        : Promise.resolve(buildEmptyLabelMetadataCounts()),
      needsQueueCount
        ? countPendingUnlistenedQueueItemsForActiveSources(scope)
        : Promise.resolve(zeroCountRows()),
    ]);
    const existingExternalDiscogsReleaseIds = includeRecommendations
      ? (
          await db
            .select({ discogsUrl: releases.discogsUrl })
            .from(releases)
            .where(scope.releases)
        )
          .map((row) => parseDiscogsReleaseIdFromUrl(row.discogsUrl))
          .filter((releaseId): releaseId is number => typeof releaseId === "number")
      : [];

    const labelsWithMetadata = buildLabelMetadataRows(
      labelRows,
      {
        releaseCountByLabel: labelProgress.releaseCountByLabel,
        fetchedReleaseCountByLabel: labelProgress.fetchedReleaseCountByLabel,
        trackCountByLabel: labelProgress.trackCountByLabel,
      },
      { thumbByLabel: labelProgress.thumbByLabel },
    );

    const needsUnplayedTracksMetric = needsListeningMetrics;
    const needsPlayedItemsMetric = needsListeningMetrics || needsPlayedMetrics;
    const needsDoneTracksMetric = needsListeningMetrics || needsPlayedMetrics;
    const needsSavedTracksMetric = needsListeningMetrics;

    const scopedTotals = await Promise.all([
      needsUnplayedTracksMetric
        ? countActiveSourceTracks(scope, eq(tracks.listened, false))
        : Promise.resolve(zeroCountRows()),
      needsPlayedItemsMetric
        ? countActiveSourceQueueItems(scope, eq(queueItems.status, "played"))
        : Promise.resolve(zeroCountRows()),
      needsDoneTracksMetric
        ? countActiveSourceTracks(scope, eq(tracks.listened, true))
        : Promise.resolve(zeroCountRows()),
      needsSavedTracksMetric
        ? countActiveSourceTracks(scope, eq(tracks.saved, true))
        : Promise.resolve(zeroCountRows()),
      needsWishlistMetric
        ? countActiveSourceReleases(scope, eq(releases.wishlist, true))
        : Promise.resolve(zeroCountRows()),
    ]);

    const lowConfidenceCount = needsErrorSummary
      ? await countActiveSourceReleases(
          scope,
          and(eq(releases.youtubeMatched, true), lt(releases.matchConfidence, 0.4)),
        )
      : zeroCountRows();

    const rawErroredLabels = needsErrorSummary
      ? await db.query.labels.findMany({
          where: and(eq(labels.status, "error"), eq(labels.active, true), scope.labels),
          orderBy: [asc(labels.updatedAt)],
          limit: 20,
        })
      : [];
    const erroredLabels = rawErroredLabels.filter((label) => !isTransientLabelError(label.lastError));

    let recommendations: Awaited<ReturnType<typeof buildDeepRecommendations>> = [];
    let externalRecommendations: Awaited<ReturnType<typeof buildExternalRecommendations>> = [];
    if (includeRecommendations) {
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
      recommendations = await buildDeepRecommendations({
        candidateTracks,
        listenedTracks,
        playedQueueItems,
        userId,
        limit: 24,
      });
      try {
        externalRecommendations = await buildExternalRecommendations({
          candidateTracks,
          listenedTracks,
          activeLabels: labelRows.filter((label) => label.active).map((label) => ({ id: label.id, name: label.name })),
          existingExternalDiscogsReleaseIds,
          existingLabelNames: allLabelNameRows.map((label) => label.name),
          userId,
          limit: 18,
        });
      } catch {
        externalRecommendations = [];
      }
    }

    return buildDashboardResult({
      labels: labelsWithMetadata,
      queueCount: queueCountRows[0]?.value ?? 0,
      metrics: buildDashboardMetricsFromTotals({
        scopedTotals,
        erroredLabels,
        lowConfidenceCount,
      }),
      erroredLabels,
      recommendations,
      externalRecommendations,
    });
  } catch {
    try {
      const userId = await requireCurrentAppUserId();
      const scope = userScope(userId);
      return buildDashboardResult({
        labels: await getLegacyDashboardLabels(scope),
      });
    } catch {
      return buildDashboardResult({
        labels: [],
      });
    }
  }
}

export async function getLabelDetail(labelId: number): Promise<LabelDetailResult> {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const label = await db.query.labels.findFirst({ where: and(eq(labels.id, labelId), scope.labels) });
  if (!label) return null;

  const detail = await withQueryJoinModeFallback(
    (mode) => getLabelDetailForMode(mode, labelId, scope),
    { releases: [], progress: { total: 0, processed: 0, matched: 0 } },
  );

  return {
    label,
    releases: detail.releases,
    progress: detail.progress,
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

export async function getToListenData(labelId?: number, onlyPlayable = true): Promise<InboxResult> {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const orderBy: InboxOrderBy = [desc(tracks.saved), asc(labels.name), asc(releases.releaseOrder), asc(tracks.id)];
  return withQueryJoinModeFallback(
    (mode) => loadInboxResultForMode({
      mode,
      labelId,
      scope,
      userId,
      baseWhereClause: and(or(eq(tracks.listened, false), eq(tracks.saved, true))),
      onlyPlayable,
      orderBy,
      limit: 600,
      hydratePlayable: true,
    }),
    { rows: [], labels: [] },
  );
}

export async function getWishlistData(labelId?: number, onlyPlayable = false): Promise<InboxResult> {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const whereClause = labelId
    ? and(or(eq(tracks.saved, true), eq(releases.wishlist, true)), eq(releases.labelId, labelId), scope.tracks, scope.releases, scope.labels)
    : and(or(eq(tracks.saved, true), eq(releases.wishlist, true)), scope.tracks, scope.releases, scope.labels);
  const rows = await loadReleaseLabelInboxRows({
    whereClause: withPlayableInboxWhere(whereClause, onlyPlayable, scope),
    orderBy: [asc(tracks.listened), asc(labels.name), asc(releases.releaseOrder), asc(tracks.id)],
    limit: 450,
  });

  return finalizeInboxResult(rows, scope, { hydratePlayable: true, userId });
}

export async function getPlayedReviewedData(labelId?: number, onlyPlayable = false): Promise<InboxResult> {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const orderBy: InboxOrderBy = [desc(tracks.listened), desc(tracks.saved), asc(labels.name), asc(releases.releaseOrder), asc(tracks.id)];
  return withQueryJoinModeFallback(
    async (mode) => {
      const playedTrackIds = await getPlayedTrackIdsFromQueue(scope, mode);
      return loadInboxResultForMode({
        mode,
        labelId,
        scope,
        userId,
        baseWhereClause: and(or(eq(tracks.listened, true), inArray(tracks.id, trackIdsOrFallback(playedTrackIds)))),
        onlyPlayable,
        orderBy,
        limit: 800,
      });
    },
    { rows: [], labels: [] },
  );
}

export async function getWishlistedRecordsData(labelId?: number): Promise<WishlistedRecordsResult> {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  return withQueryJoinModeFallback(
    async (mode) => ({
      rows: await loadWishlistedReleaseRowsForMode({
        mode,
        labelId,
        scope,
        limit: 600,
      }),
    }),
    { rows: [] },
  );
}
