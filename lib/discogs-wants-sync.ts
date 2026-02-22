import { and, eq, gt, inArray, ne } from "drizzle-orm";
import { apiCache, labels, releases, sourceReleases, tracks } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { DISCOGS_WANTS_LABEL_ID, DISCOGS_WANTS_LABEL_NAME } from "@/lib/constants";
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

async function ensureDiscogsWantsSource(userId: string) {
  const now = new Date();
  const labelScope = eq(labels.userId, userId);
  const existing = await db.query.labels.findFirst({ where: and(eq(labels.id, DISCOGS_WANTS_LABEL_ID), labelScope) });
  if (!existing) {
    await db.insert(labels).values({
      id: DISCOGS_WANTS_LABEL_ID,
      userId,
      entityKind: "label", // Synthetic source for Discogs wantlist imports.
      externalDiscogsId: null,
      name: DISCOGS_WANTS_LABEL_NAME,
      discogsUrl: "https://www.discogs.com/mywants",
      blurb: null,
      imageUrl: null,
      notableReleasesJson: "[]",
      sourceType: "derived_want",
      active: false,
      status: "complete",
      currentPage: 1,
      totalPages: 1,
      retryCount: 0,
      lastError: null,
      addedAt: now,
      updatedAt: now,
    });
    return;
  }

  await db
    .update(labels)
    .set({
      entityKind: "label",
      externalDiscogsId: existing.externalDiscogsId ?? null,
      name: existing.name || DISCOGS_WANTS_LABEL_NAME,
      discogsUrl: existing.discogsUrl || "https://www.discogs.com/mywants",
      sourceType: "derived_want",
      updatedAt: now,
    })
    .where(and(eq(labels.id, DISCOGS_WANTS_LABEL_ID), labelScope));
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
    await ensureDiscogsWantsSource(userId);

    const wantedItemsFull = await fetchDiscogsWantItems();
    const wantedItems = maxItems ? wantedItemsFull.slice(0, maxItems) : wantedItemsFull;
    await writeAutoSyncStatus(userId, {
      mode,
      status: "running",
      phase: "updating_existing",
      startedAt: startedAt.toISOString(),
      processedCount: 0,
      totalCount: wantedItems.length,
      maxItems,
    });
    const derivedWantSources = await db.query.labels.findMany({
      where: and(eq(labels.sourceType, "derived_want"), ne(labels.id, DISCOGS_WANTS_LABEL_ID), eq(labels.userId, userId)),
      columns: { id: true },
    });
    const legacyDerivedSourceIds = derivedWantSources.map((row) => row.id);
    if (legacyDerivedSourceIds.length > 0) {
      for (const ids of chunk(legacyDerivedSourceIds, 500)) {
        await db.update(releases).set({ labelId: DISCOGS_WANTS_LABEL_ID }).where(and(inArray(releases.labelId, ids), releasesScope));
        await db.delete(sourceReleases).where(and(inArray(sourceReleases.sourceId, ids), eq(sourceReleases.userId, userId)));
        await db.delete(labels).where(and(inArray(labels.id, ids), eq(labels.userId, userId)));
      }
    }

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

      if (matchedReleaseIds.length > 0) {
        await db
          .update(releases)
          .set({
            labelId: DISCOGS_WANTS_LABEL_ID,
            importSource: "discogs_want",
          })
          .where(and(inArray(releases.id, matchedReleaseIds), releasesScope));
        for (const releaseId of matchedReleaseIds) {
          await db
            .insert(sourceReleases)
            .values({
              sourceId: DISCOGS_WANTS_LABEL_ID,
              releaseId,
              userId,
              releaseOrder: 0,
              discoveredAt: now,
            })
            .onConflictDoNothing();
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
      const storedReleaseId = toStoredDiscogsId(userId, item.releaseId, "release");

      await db
        .insert(releases)
        .values({
          id: storedReleaseId,
          userId,
          labelId: DISCOGS_WANTS_LABEL_ID,
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
          sourceId: DISCOGS_WANTS_LABEL_ID,
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
  const row = await db.query.apiCache.findFirst({
    where: and(eq(apiCache.key, statusKey), eq(apiCache.userId, userId)),
    columns: { responseJson: true, fetchedAt: true },
  });
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
