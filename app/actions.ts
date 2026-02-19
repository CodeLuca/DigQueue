"use server";

import { and, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { labels, queueItems, releases, tracks } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { getEffectiveApiKeys } from "@/lib/api-keys";
import { db } from "@/lib/db";
import { parseLabelIdFromInput, searchDiscogsLabels } from "@/lib/discogs";
import { syncDiscogsWantsToLocal } from "@/lib/discogs-wants-sync";
import { toStoredDiscogsId } from "@/lib/discogs-id";
import { refreshLabelMetadata } from "@/lib/label-metadata";
import { chooseTrackMatch, processSingleReleaseForLabel, toggleReleaseWishlist, toggleTrackTodo } from "@/lib/processing";
import { logFeedbackEvent } from "@/lib/recommendations";
import { seedLabels, seedSearchLabels } from "@/lib/seed-data";

function userScope(userId: string) {
  return {
    labels: eq(labels.userId, userId),
    releases: eq(releases.userId, userId),
    tracks: eq(tracks.userId, userId),
    queueItems: eq(queueItems.userId, userId),
  };
}

async function upsertLabelById(userId: string, id: number, fallbackName?: string) {
  const storedLabelId = toStoredDiscogsId(userId, id, "label");
  const now = new Date();
  await db
    .insert(labels)
    .values({
      id: storedLabelId,
      userId,
      name: fallbackName || `Label ${id}`,
      discogsUrl: `https://www.discogs.com/label/${id}`,
      sourceType: "workspace",
      active: false,
      status: "queued",
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
        updatedAt: now,
        sourceType: "workspace",
        status: "queued",
        lastError: null,
      },
    });
  return storedLabelId;
}

async function recomputeReleaseListened(userId: string, releaseId: number) {
  const scope = userScope(userId);
  const releaseTracks = await db.query.tracks.findMany({ where: and(eq(tracks.releaseId, releaseId), scope.tracks) });
  const listened = releaseTracks.length > 0 && releaseTracks.every((item) => item.listened);
  await db.update(releases).set({ listened }).where(and(eq(releases.id, releaseId), scope.releases));
}

async function seedLabelsInternal() {
  const userId = await requireCurrentAppUserId();
  const keys = await getEffectiveApiKeys();
  const hasDiscogsToken = Boolean(keys.discogsToken);

  for (const label of seedLabels) {
    const id = parseLabelIdFromInput(label.discogs_url);
    if (!id) continue;
    await upsertLabelById(userId, id, label.name);
  }

  if (hasDiscogsToken) {
    for (const searchName of seedSearchLabels) {
      try {
        const search = await searchDiscogsLabels(searchName);
        const first = search.results[0];
        if (!first) continue;
        await upsertLabelById(userId, first.id, searchName);
      } catch {
        // Best-effort: skip unresolved search labels so direct-ID seeds still succeed.
      }
    }
  }
}

export async function addLabelAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const raw = String(formData.get("label") || "").trim();
  if (!raw) return;

  let id = parseLabelIdFromInput(raw);
  let name = raw;

  if (!id) {
    const search = await searchDiscogsLabels(raw);
    const first = search.results[0];
    if (!first) throw new Error("No label found from search.");
    id = first.id;
    name = first.title;
  }

  const storedLabelId = await upsertLabelById(userId, id, name);
  try {
    await refreshLabelMetadata(storedLabelId, userId);
  } catch {
    // Non-blocking: metadata enrichment should not block adding labels.
  }
  revalidatePath("/");
}

export async function refreshLabelMetadataAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const labelId = Number(formData.get("labelId"));
  if (!labelId) return;
  const label = await db.query.labels.findFirst({ where: and(eq(labels.id, labelId), scope.labels) });
  if (!label) return;

  try {
    await refreshLabelMetadata(labelId, userId);
  } catch {
    // Keep current label data when Discogs metadata lookup fails.
  }

  revalidatePath("/");
  revalidatePath(`/labels/${labelId}`);
}

export async function refreshMissingLabelMetadataAction() {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const allLabels = await db.query.labels.findMany({ where: scope.labels });
  const missingMetadata = allLabels
    .filter((label) => label.sourceType === "workspace" && (!label.imageUrl || !label.blurb))
    .slice(0, 12);

  for (const label of missingMetadata) {
    try {
      await refreshLabelMetadata(label.id, userId);
    } catch {
      // Keep existing values and continue with the next label.
    }
  }

  revalidatePath("/");
}

export async function seedLabelsAction() {
  await seedLabelsInternal();

  revalidatePath("/");
}

export async function setLabelStatusAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const labelId = Number(formData.get("labelId"));
  const status = String(formData.get("status") || "queued");
  await db.update(labels).set({ status, updatedAt: new Date() }).where(and(eq(labels.id, labelId), scope.labels));
  revalidatePath("/");
  revalidatePath(`/labels/${labelId}`);
}

export async function retryErroredLabelsAction() {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const erroredLabels = await db.query.labels.findMany({ where: and(eq(labels.status, "error"), eq(labels.active, true), scope.labels) });
  const now = new Date();
  for (const label of erroredLabels) {
    await db
      .update(labels)
      .set({ status: "queued", lastError: null, retryCount: 0, updatedAt: now })
      .where(and(eq(labels.id, label.id), scope.labels));
  }
  revalidatePath("/");
}

export async function retryLabelAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const labelId = Number(formData.get("labelId"));
  if (!labelId) return;
  await db
    .update(labels)
    .set({ status: "queued", lastError: null, retryCount: 0, updatedAt: new Date() })
    .where(and(eq(labels.id, labelId), scope.labels));
  revalidatePath("/");
  revalidatePath(`/labels/${labelId}`);
}

export async function deleteLabelAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const labelId = Number(formData.get("labelId"));
  if (!labelId) return;

  const labelReleases = await db.query.releases.findMany({
    where: and(eq(releases.labelId, labelId), scope.releases),
    columns: { id: true },
  });
  const releaseIds = labelReleases.map((item) => item.id);

  await db
    .delete(queueItems)
    .where(
      releaseIds.length > 0
        ? and(scope.queueItems, or(eq(queueItems.labelId, labelId), inArray(queueItems.releaseId, releaseIds)))
        : and(scope.queueItems, eq(queueItems.labelId, labelId)),
    );
  await db.delete(labels).where(and(eq(labels.id, labelId), scope.labels));

  revalidatePath("/");
  revalidatePath(`/labels/${labelId}`);
}

export async function clearPlayedQueueAction() {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  await db.delete(queueItems).where(and(eq(queueItems.status, "played"), scope.queueItems));
  revalidatePath("/");
}

export async function pullDiscogsWantsAction() {
  await syncDiscogsWantsToLocal({ force: true });
  revalidatePath("/");
}

export async function oneClickFirstRunAction() {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const keys = await getEffectiveApiKeys();
  await seedLabelsInternal();

  if (!keys.discogsToken) {
    revalidatePath("/");
    return;
  }

  const firstLabel = await db.query.labels.findFirst({ where: and(eq(labels.status, "queued"), eq(labels.active, true), scope.labels) });
  if (firstLabel) {
    await db.update(labels).set({ status: "processing", updatedAt: new Date(), lastError: null }).where(and(eq(labels.id, firstLabel.id), scope.labels));
    await processSingleReleaseForLabel(firstLabel.id, userId);
  }

  revalidatePath("/");
}

export async function processLabelAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const labelId = Number(formData.get("labelId"));
  if (!labelId) return;

  await db.update(labels).set({ status: "processing", updatedAt: new Date() }).where(and(eq(labels.id, labelId), scope.labels));
  await processSingleReleaseForLabel(labelId, userId);

  revalidatePath("/");
  revalidatePath(`/labels/${labelId}`);
}

export async function chooseMatchAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const trackId = Number(formData.get("trackId"));
  const matchId = Number(formData.get("matchId"));
  const releaseId = Number(formData.get("releaseId"));
  await chooseTrackMatch(trackId, matchId, userId);
  revalidatePath(`/releases/${releaseId}`);
  revalidatePath("/");
}

export async function toggleTrackAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const trackId = Number(formData.get("trackId"));
  const fieldRaw = String(formData.get("field"));
  const field = fieldRaw === "wishlist" ? "saved" : (fieldRaw as "listened" | "saved");
  const releaseId = Number(formData.get("releaseId"));
  await toggleTrackTodo(trackId, field, userId);

  if (field === "listened") {
    await recomputeReleaseListened(userId, releaseId);
  }

  revalidatePath(`/releases/${releaseId}`);
  revalidatePath("/");
}

export async function bulkTrackAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const trackIdsRaw = String(formData.get("trackIds") || "");
  const fieldRaw = String(formData.get("field"));
  const field = fieldRaw === "wishlist" ? "saved" : (fieldRaw as "listened" | "saved");
  const value = String(formData.get("value")) === "true";
  const trackIds = trackIdsRaw
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);

  if (trackIds.length === 0) return;

  for (const trackId of trackIds) {
    if (field === "listened") {
      await db.update(tracks).set({ listened: value }).where(and(eq(tracks.id, trackId), scope.tracks));
      if (value) {
        await logFeedbackEvent({ eventType: "listened", source: "action_bulk_track", trackId, userId });
      }
    } else {
      await db
        .update(tracks)
        .set({ saved: value })
        .where(and(eq(tracks.id, trackId), scope.tracks));
      await logFeedbackEvent({
        eventType: value ? "saved_add" : "saved_remove",
        source: "action_bulk_track",
        trackId,
        userId,
      });
    }
  }

  if (field === "listened") {
    if (value) {
      await db
        .update(queueItems)
        .set({ status: "played" })
        .where(and(inArray(queueItems.trackId, trackIds), eq(queueItems.status, "pending"), scope.queueItems));
    }
    const touchedTracks = await Promise.all(trackIds.map((trackId) => db.query.tracks.findFirst({ where: and(eq(tracks.id, trackId), scope.tracks) })));
    const releaseIds = new Set(touchedTracks.map((item) => item?.releaseId).filter((item): item is number => typeof item === "number"));
    for (const releaseId of releaseIds) {
      await recomputeReleaseListened(userId, releaseId);
    }
  }

  revalidatePath("/listen");
  revalidatePath("/");
}

export async function toggleReleaseWishlistAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const releaseId = Number(formData.get("releaseId"));
  await toggleReleaseWishlist(releaseId, userId);
  const release = await db.query.releases.findFirst({ where: and(eq(releases.id, releaseId), scope.releases) });
  await logFeedbackEvent({
    eventType: release?.wishlist ? "record_wishlist_add" : "record_wishlist_remove",
    source: "action_toggle_release",
    releaseId,
    labelId: release?.labelId ?? null,
    userId,
  });
  revalidatePath(`/releases/${releaseId}`);
  revalidatePath("/");
}
