import { and, eq, gt, inArray } from "drizzle-orm";
import { apiCache, labels, releases, sourceReleases, tracks } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { DISCOGS_WANTS_LABEL_ID } from "@/lib/constants";
import { fetchDiscogsWantItems } from "@/lib/discogs";
import { buildMissingWantTrackSeedPlan } from "@/lib/discogs-wants-import";
import { planDiscogsWantSourceAssignment } from "@/lib/discogs-wants-source-assignment";
import { logReleaseWishlistFeedbackTargets } from "@/lib/release-wishlist-feedback-log";
import {
  selectConfirmedReleaseWishlistFeedbackTargets,
} from "@/lib/release-wishlist-feedback";
import { ensureTrackForUser } from "@/lib/library-upsert";
import { buildLocalReleaseWishlistSyncPlan } from "@/lib/release-wishlist-local-sync";
import { applyLocalReleaseWishlistSyncPlanForUser } from "@/lib/release-wishlist-local-state";
import { persistReleaseUnderSourceForUser } from "@/lib/source-release-materialization";
import { upsertSourceReleaseMapping } from "@/lib/source-release-mapping";
import { upsertSourceForUser } from "@/lib/source-upsert";
import { buildUserReleaseIdsByExternalDiscogsId } from "@/lib/user-release-external-identity";
import {
  buildReleaseWishlistSyncTargetsForLocalReleaseIds,
} from "@/lib/release-wishlist-sync";

const AUTO_SYNC_CACHE_KEY = "discogs:wants:auto-sync:v1";
const AUTO_SYNC_STATUS_CACHE_KEY = "discogs:wants:auto-sync:status:v1";
const AUTO_SYNC_TTL_MS = 1000 * 60;
const AUTO_SYNC_STATUS_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function scopedAutoSyncCacheKey(userId: string) {
  return `${AUTO_SYNC_CACHE_KEY}:${userId}`;
}

function scopedAutoSyncStatusCacheKey(userId: string) {
  return `${AUTO_SYNC_STATUS_CACHE_KEY}:${userId}`;
}

async function shouldSkipAutoSync(force: boolean, userId: string) {
  if (force) return false;
  const cacheKey = scopedAutoSyncCacheKey(userId);
  const cached = await db.query.apiCache.findFirst({
    where: and(eq(apiCache.key, cacheKey), eq(apiCache.userId, userId), gt(apiCache.expiresAt, new Date())),
  });
  return Boolean(cached);
}

type WantsSyncSnapshot = {
  mode: "auto" | "manual";
  status: "running" | "synced" | "throttled" | "error";
  startedAt: string;
  finishedAt?: string;
  phase?: "fetching_wants" | "updating_existing" | "importing_missing" | "complete" | "error";
  processedCount?: number;
  totalCount?: number;
  wantedCount?: number;
  loadedWantedCount?: number;
  importedMissingCount?: number;
  maxItems?: number | null;
  reason?: string;
  error?: string;
};

async function writeAutoSyncStatus(userId: string, snapshot: WantsSyncSnapshot) {
  const now = new Date();
  const statusExpiresAt = new Date(now.getTime() + AUTO_SYNC_STATUS_TTL_MS);
  const statusKey = scopedAutoSyncStatusCacheKey(userId);
  const payload = JSON.stringify(snapshot);
  await db
    .insert(apiCache)
    .values({ key: statusKey, userId, responseJson: payload, fetchedAt: now, expiresAt: statusExpiresAt })
    .onConflictDoUpdate({
      target: [apiCache.userId, apiCache.key],
      set: { responseJson: payload, fetchedAt: now, expiresAt: statusExpiresAt },
    });
}

async function touchAutoSyncCache(userId: string, snapshot: WantsSyncSnapshot) {
  const now = new Date();
  const throttleExpiresAt = new Date(now.getTime() + AUTO_SYNC_TTL_MS);
  const cacheKey = scopedAutoSyncCacheKey(userId);
  const payload = JSON.stringify(snapshot);
  await db
    .insert(apiCache)
    .values({ key: cacheKey, userId, responseJson: payload, fetchedAt: now, expiresAt: throttleExpiresAt })
    .onConflictDoUpdate({
      target: [apiCache.userId, apiCache.key],
      set: { responseJson: payload, fetchedAt: now, expiresAt: throttleExpiresAt },
    });
  await writeAutoSyncStatus(userId, snapshot);
}

export async function syncDiscogsWantsToLocalForUser(userId: string, options?: { force?: boolean; maxItems?: number }) {
  const startedAt = new Date();
  const force = Boolean(options?.force);
  const mode: "auto" | "manual" = force ? "manual" : "auto";
  const maxItems = Number.isFinite(options?.maxItems) && Number(options?.maxItems) > 0
    ? Math.min(500, Math.floor(Number(options?.maxItems)))
    : null;
  await writeAutoSyncStatus(userId, {
    mode,
    status: "running",
    phase: "fetching_wants",
    startedAt: startedAt.toISOString(),
    processedCount: 0,
    totalCount: 0,
    maxItems,
  });
  if (await shouldSkipAutoSync(force, userId)) {
    await touchAutoSyncCache(userId, {
      mode,
      status: "throttled",
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      maxItems,
      reason: "throttled",
    });
    return { synced: false as const, reason: "throttled" as const };
  }
  const releasesScope = eq(releases.userId, userId);
  const tracksScope = eq(tracks.userId, userId);
  try {
    const wantedItemsFull = await fetchDiscogsWantItems();
    const wantedItems = maxItems ? wantedItemsFull.slice(0, maxItems) : wantedItemsFull;
    const labelSourceIdByExternalLabelId = new Map<number, number>();
    const ensureWantLabelSource = async (labelId: number | null, labelName: string | null) => {
      if (!Number.isFinite(labelId) || !labelId || labelId <= 0) return null;
      const externalLabelId = Math.floor(labelId);
      const cached = labelSourceIdByExternalLabelId.get(externalLabelId);
      if (cached) return cached;

      const sourceId = await upsertSourceForUser({
        userId,
        kind: "label",
        externalDiscogsId: externalLabelId,
        fallbackName: labelName?.trim() || `Label ${externalLabelId}`,
        active: false,
        sourceType: "derived_want",
      });

      labelSourceIdByExternalLabelId.set(externalLabelId, sourceId);
      return sourceId;
    };

    await writeAutoSyncStatus(userId, {
      mode,
      status: "running",
      phase: "updating_existing",
      startedAt: startedAt.toISOString(),
      processedCount: 0,
      totalCount: wantedItems.length,
      maxItems,
    });

    const wantedExternalSet = new Set(wantedItems.map((item) => item.releaseId));
    const allReleaseRows = await db.query.releases.findMany({
      where: releasesScope,
      columns: { id: true, labelId: true, discogsUrl: true, wishlist: true, importSource: true },
    });
    const releaseById = new Map(allReleaseRows.map((row) => [row.id, row] as const));
    const activeLabelRows = await db.query.labels.findMany({
      where: and(eq(labels.userId, userId), eq(labels.active, true)),
      columns: { id: true },
    });
    const activeLabelIds = new Set(activeLabelRows.map((row) => row.id));
    const existingReleaseIdsByExternal = buildUserReleaseIdsByExternalDiscogsId(allReleaseRows);
    const { toSetReleaseIds: toSetWishlist, toUnsetReleaseIds: toUnsetWishlist } =
      buildLocalReleaseWishlistSyncPlan(allReleaseRows, wantedExternalSet);
    const loadedWantedReleaseIds = [...new Set(
      [...wantedExternalSet].flatMap((externalDiscogsReleaseId) => existingReleaseIdsByExternal.get(externalDiscogsReleaseId) ?? []),
    )];

    let progressCount = 0;
    const totalProgressSteps = wantedItems.length + toUnsetWishlist.length + toSetWishlist.length;
    await writeAutoSyncStatus(userId, {
      mode,
      status: "running",
      phase: "updating_existing",
      startedAt: startedAt.toISOString(),
      processedCount: progressCount,
      totalCount: totalProgressSteps,
      maxItems,
    });

    const localWishlistUpdate = await applyLocalReleaseWishlistSyncPlanForUser({
      userId,
      toSetReleaseIds: toSetWishlist,
      toUnsetReleaseIds: toUnsetWishlist,
      chunkSize: 250,
      onChunkApplied: async ({ appliedCount }) => {
        progressCount += appliedCount;
        await writeAutoSyncStatus(userId, {
          mode,
          status: "running",
          phase: "updating_existing",
          startedAt: startedAt.toISOString(),
          processedCount: progressCount,
          totalCount: totalProgressSteps,
          maxItems,
        });
      },
    });
    const confirmedWishlistAddTargets = selectConfirmedReleaseWishlistFeedbackTargets({
      targets: buildReleaseWishlistSyncTargetsForLocalReleaseIds(allReleaseRows, toSetWishlist),
      confirmedReleaseIds: localWishlistUpdate.setResult.confirmedIds,
    });
    const confirmedWishlistRemoveTargets = selectConfirmedReleaseWishlistFeedbackTargets({
      targets: buildReleaseWishlistSyncTargetsForLocalReleaseIds(allReleaseRows, toUnsetWishlist),
      confirmedReleaseIds: localWishlistUpdate.unsetResult.confirmedIds,
    });
    await logReleaseWishlistFeedbackTargets({
      eventType: "record_wishlist_add",
      source: "discogs_wants_sync",
      userId,
      targets: confirmedWishlistAddTargets,
    });
    await logReleaseWishlistFeedbackTargets({
      eventType: "record_wishlist_remove",
      source: "discogs_wants_sync",
      userId,
      targets: confirmedWishlistRemoveTargets,
    });

    const missingWanted = wantedItems.filter((item) => (existingReleaseIdsByExternal.get(item.releaseId) ?? []).length === 0);
    const now = new Date();

    for (let idx = 0; idx < wantedItems.length; idx += 1) {
      const item = wantedItems[idx];
      const matchedReleaseIds = existingReleaseIdsByExternal.get(item.releaseId) ?? [];
      const matchedReleaseRows = matchedReleaseIds
        .map((releaseId) => {
          const row = releaseById.get(releaseId);
          if (!row) return null;
          return {
            releaseId,
            labelId: row.labelId ?? null,
            wishlist: row.wishlist,
            importSource: row.importSource,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
      const assignmentPlan = planDiscogsWantSourceAssignment(matchedReleaseRows, activeLabelIds);
      const labelSourceId = await ensureWantLabelSource(item.labelId, item.labelName);

      if (assignmentPlan.relabelReleaseIds.length > 0) {
        if (labelSourceId) {
          await db
            .update(releases)
            .set({
              labelId: labelSourceId,
              importSource: "discogs_want",
            })
            .where(and(inArray(releases.id, assignmentPlan.relabelReleaseIds), releasesScope));
          for (const releaseId of assignmentPlan.relabelReleaseIds) {
            await upsertSourceReleaseMapping({
              sourceId: labelSourceId,
              releaseId,
              userId,
              releaseOrder: 0,
              discoveredAt: now,
            });
          }
        } else {
          await db
            .update(releases)
            .set({ importSource: "discogs_want" })
            .where(and(inArray(releases.id, assignmentPlan.relabelReleaseIds), releasesScope));
        }
      }
      progressCount += 1;
      if ((idx + 1) % 20 === 0 || idx + 1 === wantedItems.length) {
        await writeAutoSyncStatus(userId, {
          mode,
          status: "running",
          phase: "updating_existing",
          startedAt: startedAt.toISOString(),
          processedCount: progressCount,
          totalCount: totalProgressSteps,
          maxItems,
        });
      }
    }

    await writeAutoSyncStatus(userId, {
      mode,
      status: "running",
      phase: "importing_missing",
      startedAt: startedAt.toISOString(),
      processedCount: 0,
      totalCount: missingWanted.length,
      maxItems,
    });

    const importedReleaseIdsByExternalId = new Map<number, number>();
    for (let idx = 0; idx < missingWanted.length; idx += 1) {
      const item = missingWanted[idx];
      const labelSourceId = await ensureWantLabelSource(item.labelId, item.labelName);
      if (!labelSourceId) continue;
      const persistedRelease = await persistReleaseUnderSourceForUser({
        userId,
        sourceId: labelSourceId,
        externalDiscogsReleaseId: item.releaseId,
        releaseOrder: idx,
        discoveredAt: now,
        release: {
          title: item.title,
          artist: item.artist,
          year: null,
          catno: item.catno,
          discogsUrl: item.discogsUrl,
          thumbUrl: item.thumbUrl,
          detailsFetched: true,
          youtubeMatched: false,
          listened: false,
          wishlist: true,
          matchConfidence: 0,
          processingError: null,
          fetchedAt: now,
          importSource: "discogs_want",
        },
      });
      importedReleaseIdsByExternalId.set(item.releaseId, persistedRelease.id);
      if ((idx + 1) % 25 === 0 || idx + 1 === missingWanted.length) {
        await writeAutoSyncStatus(userId, {
          mode,
          status: "running",
          phase: "importing_missing",
          startedAt: startedAt.toISOString(),
          processedCount: idx + 1,
          totalCount: missingWanted.length,
          maxItems,
        });
      }
    }

    if (importedReleaseIdsByExternalId.size > 0) {
      const importedReleaseIds = [...new Set(importedReleaseIdsByExternalId.values())];
      const importedReleaseRows = await db.query.releases.findMany({
        where: and(inArray(releases.id, importedReleaseIds), releasesScope),
        columns: { id: true, discogsUrl: true, wishlist: true, labelId: true },
      });
      const importedWishlistAddTargets = selectConfirmedReleaseWishlistFeedbackTargets({
        targets: buildReleaseWishlistSyncTargetsForLocalReleaseIds(importedReleaseRows, importedReleaseIds),
        confirmedReleaseIds: importedReleaseIds,
      });
      await logReleaseWishlistFeedbackTargets({
        eventType: "record_wishlist_add",
        source: "discogs_wants_sync_import",
        userId,
        targets: importedWishlistAddTargets,
      });

      const existingTrackRows = await db
        .select({ releaseId: tracks.releaseId })
        .from(tracks)
        .where(and(inArray(tracks.releaseId, importedReleaseIds), tracksScope));
      const existingTrackReleaseIds = new Set(existingTrackRows.map((row) => row.releaseId));

      const trackSeedPlan = buildMissingWantTrackSeedPlan({
        missingWanted,
        importedReleaseIdsByExternalId,
        existingTrackReleaseIds,
      });

      for (const item of trackSeedPlan) {
        await ensureTrackForUser({
          userId,
          releaseId: item.persistedReleaseId,
          position: "",
          title: item.title,
          duration: null,
          artistsText: item.artist,
          listened: false,
          saved: false,
          wishlist: true,
          createdAt: now,
        });
      }
    }

    // Remove legacy synthetic "Discogs Wishlist" source/mappings now that wants map to real labels.
    await db.delete(sourceReleases).where(and(eq(sourceReleases.sourceId, DISCOGS_WANTS_LABEL_ID), eq(sourceReleases.userId, userId)));
    const legacyWantsRelease = await db.query.releases.findFirst({
      where: and(eq(releases.labelId, DISCOGS_WANTS_LABEL_ID), releasesScope),
      columns: { id: true },
    });
    if (!legacyWantsRelease) {
      await db.delete(labels).where(and(eq(labels.id, DISCOGS_WANTS_LABEL_ID), eq(labels.userId, userId)));
    }

    await touchAutoSyncCache(userId, {
      mode,
      status: "synced",
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      phase: "complete",
      processedCount: wantedItems.length,
      totalCount: wantedItems.length,
      wantedCount: wantedItems.length,
      loadedWantedCount: loadedWantedReleaseIds.length,
      importedMissingCount: importedReleaseIdsByExternalId.size,
      maxItems,
    });
    return {
      synced: true as const,
      wantedCount: wantedItems.length,
      loadedWantedCount: loadedWantedReleaseIds.length,
      importedMissingCount: importedReleaseIdsByExternalId.size,
    };
  } catch (error) {
    await touchAutoSyncCache(userId, {
      mode,
      status: "error",
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      phase: "error",
      maxItems,
      error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
    });
    throw error;
  }
}

export async function syncDiscogsWantsToLocal(options?: { force?: boolean; maxItems?: number }) {
  const userId = await requireCurrentAppUserId();
  return syncDiscogsWantsToLocalForUser(userId, options);
}

export async function getDiscogsWantsSyncStatusForUser(userId: string) {
  const statusKey = scopedAutoSyncStatusCacheKey(userId);
  let row: { responseJson: string; fetchedAt: Date } | null = null;
  try {
    row = await db.query.apiCache.findFirst({
      where: and(eq(apiCache.key, statusKey), eq(apiCache.userId, userId)),
      columns: { responseJson: true, fetchedAt: true },
    }) ?? null;
  } catch {
    return null;
  }
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.responseJson) as WantsSyncSnapshot;
    return {
      ...parsed,
      fetchedAt: row.fetchedAt,
    };
  } catch {
    return null;
  }
}

export async function getDiscogsWantsSyncStatus() {
  const userId = await requireCurrentAppUserId();
  return getDiscogsWantsSyncStatusForUser(userId);
}
