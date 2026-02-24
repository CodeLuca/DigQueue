import { and, eq, gt, inArray } from "drizzle-orm";
import { apiCache, labels, releases, sourceReleases, tracks } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { DISCOGS_WANTS_LABEL_ID } from "@/lib/constants";
import { fetchDiscogsWantItems } from "@/lib/discogs";
import { toStoredDiscogsId } from "@/lib/discogs-id";

const AUTO_SYNC_CACHE_KEY = "discogs:wants:auto-sync:v1";
const AUTO_SYNC_STATUS_CACHE_KEY = "discogs:wants:auto-sync:status:v1";
const AUTO_SYNC_TTL_MS = 1000 * 60;
const AUTO_SYNC_STATUS_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let idx = 0; idx < items.length; idx += size) {
    chunks.push(items.slice(idx, idx + size));
  }
  return chunks;
}

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
      target: apiCache.key,
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
      target: apiCache.key,
      set: { responseJson: payload, fetchedAt: now, expiresAt: throttleExpiresAt },
    });
  await writeAutoSyncStatus(userId, snapshot);
}

function parseReleaseIdFromDiscogsUrl(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/\/release\/(\d+)/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function syncDiscogsWantsToLocal(options?: { force?: boolean; maxItems?: number }) {
  const userId = await requireCurrentAppUserId();
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

      const sourceId = toStoredDiscogsId(userId, externalLabelId, "label");
      const now = new Date();
      const name = labelName?.trim() || `Label ${externalLabelId}`;
      await db
        .insert(labels)
        .values({
          id: sourceId,
          userId,
          entityKind: "label",
          externalDiscogsId: externalLabelId,
          name,
          discogsUrl: `https://www.discogs.com/label/${externalLabelId}`,
          sourceType: "derived_want",
          active: false,
          status: "complete",
          currentPage: 1,
          totalPages: 1,
          retryCount: 0,
          lastError: null,
          addedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: labels.id,
          set: {
            externalDiscogsId: externalLabelId,
            name,
            discogsUrl: `https://www.discogs.com/label/${externalLabelId}`,
            sourceType: "derived_want",
            updatedAt: now,
          },
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
      columns: { id: true, discogsUrl: true },
    });
    const allReleaseIds = allReleaseRows.map((item) => item.id);
    const existingReleaseIdsByExternal = new Map<number, number[]>();
    for (const row of allReleaseRows) {
      const externalId = parseReleaseIdFromDiscogsUrl(row.discogsUrl);
      if (!externalId) continue;
      const existing = existingReleaseIdsByExternal.get(externalId) ?? [];
      existing.push(row.id);
      existingReleaseIdsByExternal.set(externalId, existing);
    }
    const loadedWantedReleaseIds = allReleaseRows
      .filter((row) => {
        const externalId = parseReleaseIdFromDiscogsUrl(row.discogsUrl);
        return externalId ? wantedExternalSet.has(externalId) : false;
      })
      .map((row) => row.id);

    const releaseIdChunks = chunk(allReleaseIds, 500);
    for (const ids of releaseIdChunks) {
      if (ids.length === 0) continue;
      await db.update(releases).set({ wishlist: false }).where(and(inArray(releases.id, ids), releasesScope));
    }

    const loadedWantedChunks = chunk(loadedWantedReleaseIds, 500);
    for (const ids of loadedWantedChunks) {
      if (ids.length === 0) continue;
      await db.update(releases).set({ wishlist: true }).where(and(inArray(releases.id, ids), releasesScope));
    }

    const missingWanted = wantedItems.filter((item) => (existingReleaseIdsByExternal.get(item.releaseId) ?? []).length === 0);
    const now = new Date();

    for (let idx = 0; idx < wantedItems.length; idx += 1) {
      const item = wantedItems[idx];
      const matchedReleaseIds = existingReleaseIdsByExternal.get(item.releaseId) ?? [];
      const labelSourceId = await ensureWantLabelSource(item.labelId, item.labelName);

      if (matchedReleaseIds.length > 0) {
        if (labelSourceId) {
          await db
            .update(releases)
            .set({
              labelId: labelSourceId,
              importSource: "discogs_want",
            })
            .where(and(inArray(releases.id, matchedReleaseIds), releasesScope));
          for (const releaseId of matchedReleaseIds) {
            await db
              .insert(sourceReleases)
              .values({
                sourceId: labelSourceId,
                releaseId,
                userId,
                releaseOrder: 0,
                discoveredAt: now,
              })
              .onConflictDoNothing();
          }
        } else {
          await db
            .update(releases)
            .set({ importSource: "discogs_want" })
            .where(and(inArray(releases.id, matchedReleaseIds), releasesScope));
        }
      }
      if ((idx + 1) % 50 === 0 || idx + 1 === wantedItems.length) {
        await writeAutoSyncStatus(userId, {
          mode,
          status: "running",
          phase: "updating_existing",
          startedAt: startedAt.toISOString(),
          processedCount: idx + 1,
          totalCount: wantedItems.length,
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

    for (let idx = 0; idx < missingWanted.length; idx += 1) {
      const item = missingWanted[idx];
      const labelSourceId = await ensureWantLabelSource(item.labelId, item.labelName);
      if (!labelSourceId) continue;
      const storedReleaseId = toStoredDiscogsId(userId, item.releaseId, "release");

      await db
        .insert(releases)
        .values({
          id: storedReleaseId,
          userId,
          labelId: labelSourceId,
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
          releaseOrder: idx,
          importSource: "discogs_want",
        })
        .onConflictDoNothing();

      await db
        .insert(sourceReleases)
        .values({
          sourceId: labelSourceId,
          releaseId: storedReleaseId,
          userId,
          releaseOrder: idx,
          discoveredAt: now,
        })
        .onConflictDoNothing();
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

    if (missingWanted.length > 0) {
      const importedReleaseIds = missingWanted.map((item) => toStoredDiscogsId(userId, item.releaseId, "release"));
      const existingTrackRows = await db
        .select({ releaseId: tracks.releaseId })
        .from(tracks)
        .where(and(inArray(tracks.releaseId, importedReleaseIds), tracksScope));
      const existingTrackReleaseIds = new Set(existingTrackRows.map((row) => row.releaseId));

      for (const item of missingWanted) {
        const storedReleaseId = toStoredDiscogsId(userId, item.releaseId, "release");
        if (existingTrackReleaseIds.has(storedReleaseId)) continue;
        await db.insert(tracks).values({
          userId,
          releaseId: storedReleaseId,
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
      importedMissingCount: missingWanted.length,
      maxItems,
    });
    return {
      synced: true as const,
      wantedCount: wantedItems.length,
      loadedWantedCount: loadedWantedReleaseIds.length,
      importedMissingCount: missingWanted.length,
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

export async function getDiscogsWantsSyncStatus() {
  const userId = await requireCurrentAppUserId();
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
