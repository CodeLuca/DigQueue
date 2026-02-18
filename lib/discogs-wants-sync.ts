import { and, eq, gt, inArray } from "drizzle-orm";
import { apiCache, labels, releases, tracks } from "@/db/schema";
import { db } from "@/lib/db";
import { DISCOGS_WANTS_LABEL_ID } from "@/lib/constants";
import { fetchDiscogsRelease, fetchDiscogsWantItems } from "@/lib/discogs";

const AUTO_SYNC_CACHE_KEY = "discogs:wants:auto-sync:v1";
const AUTO_SYNC_TTL_MS = 1000 * 60;

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let idx = 0; idx < items.length; idx += size) {
    chunks.push(items.slice(idx, idx + size));
  }
  return chunks;
}

async function shouldSkipAutoSync(force: boolean) {
  if (force) return false;
  const cached = await db.query.apiCache.findFirst({
    where: and(eq(apiCache.key, AUTO_SYNC_CACHE_KEY), gt(apiCache.expiresAt, new Date())),
  });
  return Boolean(cached);
}

async function touchAutoSyncCache() {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTO_SYNC_TTL_MS);
  await db
    .insert(apiCache)
    .values({ key: AUTO_SYNC_CACHE_KEY, responseJson: JSON.stringify({ ok: true }), fetchedAt: now, expiresAt })
    .onConflictDoUpdate({
      target: apiCache.key,
      set: { responseJson: JSON.stringify({ ok: true }), fetchedAt: now, expiresAt },
    });
}

function parseLabelIdFromResourceUrl(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/\/labels?\/(\d+)/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function resolveWantLabel(
  item: Awaited<ReturnType<typeof fetchDiscogsWantItems>>[number],
) {
  if (item.labelId && item.labelId > 0) {
    return { labelId: item.labelId, labelName: item.labelName ?? `Label ${item.labelId}` };
  }

  try {
    const release = await fetchDiscogsRelease(item.releaseId);
    const first = (release.labels ?? []).find((entry) => typeof entry?.id === "number" || entry?.resource_url);
    const labelId = typeof first?.id === "number" ? first.id : parseLabelIdFromResourceUrl(first?.resource_url);
    if (!labelId) return null;
    return { labelId, labelName: first?.name?.trim() || `Label ${labelId}` };
  } catch {
    return null;
  }
}

async function ensureLabelForWantedRelease(labelId: number, labelName: string) {
  const now = new Date();
  const existing = await db.query.labels.findFirst({ where: eq(labels.id, labelId) });
  if (!existing) {
    await db.insert(labels).values({
      id: labelId,
      name: labelName,
      discogsUrl: `https://www.discogs.com/label/${labelId}`,
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
      name: labelName || existing.name,
      discogsUrl: `https://www.discogs.com/label/${labelId}`,
      sourceType: existing.sourceType === "workspace" ? "workspace" : "derived_want",
      updatedAt: now,
    })
    .where(eq(labels.id, labelId));
}

export async function syncDiscogsWantsToLocal(options?: { force?: boolean }) {
  const force = Boolean(options?.force);
  if (await shouldSkipAutoSync(force)) return { synced: false as const, reason: "throttled" as const };

  const wantedItems = await fetchDiscogsWantItems();
  const wantedReleaseIds = wantedItems.map((item) => item.releaseId);
  const wantedSet = new Set(wantedReleaseIds);
  const allReleaseRows = await db.query.releases.findMany({ columns: { id: true } });
  const allReleaseIds = allReleaseRows.map((item) => item.id);
  const loadedWantedReleaseIds = allReleaseIds.filter((id) => wantedSet.has(id));

  const releaseIdChunks = chunk(allReleaseIds, 500);
  for (const ids of releaseIdChunks) {
    if (ids.length === 0) continue;
    await db.update(releases).set({ wishlist: false }).where(inArray(releases.id, ids));
  }

  const loadedWantedChunks = chunk(loadedWantedReleaseIds, 500);
  for (const ids of loadedWantedChunks) {
    if (ids.length === 0) continue;
    await db.update(releases).set({ wishlist: true }).where(inArray(releases.id, ids));
  }

  const releaseRowsById = new Set(allReleaseIds);
  const missingWanted = wantedItems.filter((item) => !releaseRowsById.has(item.releaseId));
  const now = new Date();

  for (const item of wantedItems) {
    const resolvedLabel = await resolveWantLabel(item);
    if (!resolvedLabel) continue;
    await ensureLabelForWantedRelease(resolvedLabel.labelId, resolvedLabel.labelName);

    await db
      .update(releases)
      .set({
        labelId: resolvedLabel.labelId,
        importSource: "discogs_want",
      })
      .where(and(eq(releases.id, item.releaseId), eq(releases.labelId, DISCOGS_WANTS_LABEL_ID)));
  }

  for (const [idx, item] of missingWanted.entries()) {
    const resolvedLabel = await resolveWantLabel(item);
    if (!resolvedLabel) continue;
    await ensureLabelForWantedRelease(resolvedLabel.labelId, resolvedLabel.labelName);

    await db
      .insert(releases)
      .values({
        id: item.releaseId,
        labelId: resolvedLabel.labelId,
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
  }

  if (missingWanted.length > 0) {
    const importedReleaseIds = missingWanted.map((item) => item.releaseId);
    const existingTrackRows = await db
      .select({ releaseId: tracks.releaseId })
      .from(tracks)
      .where(inArray(tracks.releaseId, importedReleaseIds));
    const existingTrackReleaseIds = new Set(existingTrackRows.map((row) => row.releaseId));

    for (const item of missingWanted) {
      if (existingTrackReleaseIds.has(item.releaseId)) continue;
      await db.insert(tracks).values({
        releaseId: item.releaseId,
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

  await touchAutoSyncCache();
  return {
    synced: true as const,
    wantedCount: wantedReleaseIds.length,
    loadedWantedCount: loadedWantedReleaseIds.length,
    importedMissingCount: missingWanted.length,
  };
}
