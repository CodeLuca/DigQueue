"use server";

import { and, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { labels, queueItems, releases, tracks } from "@/db/schema";
import { getEffectiveApiKeys } from "@/lib/api-keys";
import { db } from "@/lib/db";
import { parseLabelIdFromInput, searchDiscogsLabels } from "@/lib/discogs";
import { syncDiscogsWantsToLocal } from "@/lib/discogs-wants-sync";
import { refreshLabelMetadata } from "@/lib/label-metadata";
import { chooseTrackMatch, processSingleReleaseForLabel, toggleReleaseWishlist, toggleTrackTodo } from "@/lib/processing";
import { logFeedbackEvent } from "@/lib/recommendations";
import { seedLabels, seedSearchLabels } from "@/lib/seed-data";

async function upsertLabelById(id: number, fallbackName?: string) {
  const now = new Date();
  await db
    .insert(labels)
    .values({
      id,
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
}

async function recomputeReleaseListened(releaseId: number) {
  const releaseTracks = await db.query.tracks.findMany({ where: eq(tracks.releaseId, releaseId) });
  const listened = releaseTracks.length > 0 && releaseTracks.every((item) => item.listened);
  await db.update(releases).set({ listened }).where(eq(releases.id, releaseId));
}

async function seedLabelsInternal() {
  const keys = await getEffectiveApiKeys();
  const hasDiscogsToken = Boolean(keys.discogsToken);

  for (const label of seedLabels) {
    const id = parseLabelIdFromInput(label.discogs_url);
    if (!id) continue;
    await upsertLabelById(id, label.name);
  }

  if (hasDiscogsToken) {
    for (const searchName of seedSearchLabels) {
      try {
        const search = await searchDiscogsLabels(searchName);
        const first = search.results[0];
        if (!first) continue;
        await upsertLabelById(first.id, searchName);
      } catch {
        // Best-effort: skip unresolved search labels so direct-ID seeds still succeed.
      }
    }
  }
}

export async function addLabelAction(formData: FormData) {
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

  await upsertLabelById(id, name);
  try {
    await refreshLabelMetadata(id);
  } catch {
    // Non-blocking: metadata enrichment should not block adding labels.
  }
  revalidatePath("/");
}

export async function refreshLabelMetadataAction(formData: FormData) {
  const labelId = Number(formData.get("labelId"));
  if (!labelId) return;

  try {
    await refreshLabelMetadata(labelId);
  } catch {
    // Keep current label data when Discogs metadata lookup fails.
  }

  revalidatePath("/");
  revalidatePath(`/labels/${labelId}`);
}

export async function refreshMissingLabelMetadataAction() {
  const allLabels = await db.query.labels.findMany();
  const missingMetadata = allLabels
    .filter((label) => label.sourceType === "workspace" && (!label.imageUrl || !label.blurb))
    .slice(0, 12);

  for (const label of missingMetadata) {
    try {
      await refreshLabelMetadata(label.id);
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
  const labelId = Number(formData.get("labelId"));
  const status = String(formData.get("status") || "queued");
  await db.update(labels).set({ status, updatedAt: new Date() }).where(eq(labels.id, labelId));
  revalidatePath("/");
  revalidatePath(`/labels/${labelId}`);
}

export async function retryErroredLabelsAction() {
  const erroredLabels = await db.query.labels.findMany({ where: and(eq(labels.status, "error"), eq(labels.active, true)) });
  const now = new Date();
  for (const label of erroredLabels) {
    await db
      .update(labels)
      .set({ status: "queued", lastError: null, retryCount: 0, updatedAt: now })
      .where(eq(labels.id, label.id));
  }
  revalidatePath("/");
}

export async function retryLabelAction(formData: FormData) {
  const labelId = Number(formData.get("labelId"));
  if (!labelId) return;
  await db
    .update(labels)
    .set({ status: "queued", lastError: null, retryCount: 0, updatedAt: new Date() })
    .where(eq(labels.id, labelId));
  revalidatePath("/");
  revalidatePath(`/labels/${labelId}`);
}

export async function deleteLabelAction(formData: FormData) {
  const labelId = Number(formData.get("labelId"));
  if (!labelId) return;

  const labelReleases = await db.query.releases.findMany({
    where: eq(releases.labelId, labelId),
    columns: { id: true },
  });
  const releaseIds = labelReleases.map((item) => item.id);

  await db
    .delete(queueItems)
    .where(
      releaseIds.length > 0
        ? or(eq(queueItems.labelId, labelId), inArray(queueItems.releaseId, releaseIds))
        : eq(queueItems.labelId, labelId),
    );
  await db.delete(labels).where(eq(labels.id, labelId));

  revalidatePath("/");
  revalidatePath(`/labels/${labelId}`);
}

export async function clearPlayedQueueAction() {
  await db.delete(queueItems).where(eq(queueItems.status, "played"));
  revalidatePath("/");
}

export async function pullDiscogsWantsAction() {
  await syncDiscogsWantsToLocal({ force: true });
  revalidatePath("/");
}

export async function oneClickFirstRunAction() {
  const keys = await getEffectiveApiKeys();
  await seedLabelsInternal();

  if (!keys.discogsToken) {
    revalidatePath("/");
    return;
  }

  const firstLabel = await db.query.labels.findFirst({ where: and(eq(labels.status, "queued"), eq(labels.active, true)) });
  if (firstLabel) {
    await db.update(labels).set({ status: "processing", updatedAt: new Date(), lastError: null }).where(eq(labels.id, firstLabel.id));
    await processSingleReleaseForLabel(firstLabel.id);
  }

  revalidatePath("/");
}

export async function processLabelAction(formData: FormData) {
  const labelId = Number(formData.get("labelId"));
  if (!labelId) return;

  await db.update(labels).set({ status: "processing", updatedAt: new Date() }).where(eq(labels.id, labelId));
  await processSingleReleaseForLabel(labelId);

  revalidatePath("/");
  revalidatePath(`/labels/${labelId}`);
}

export async function chooseMatchAction(formData: FormData) {
  const trackId = Number(formData.get("trackId"));
  const matchId = Number(formData.get("matchId"));
  const releaseId = Number(formData.get("releaseId"));
  await chooseTrackMatch(trackId, matchId);
  revalidatePath(`/releases/${releaseId}`);
  revalidatePath("/");
}

export async function toggleTrackAction(formData: FormData) {
  const trackId = Number(formData.get("trackId"));
  const fieldRaw = String(formData.get("field"));
  const field = fieldRaw === "wishlist" ? "saved" : (fieldRaw as "listened" | "saved");
  const releaseId = Number(formData.get("releaseId"));
  await toggleTrackTodo(trackId, field);

  if (field === "listened") {
    await recomputeReleaseListened(releaseId);
  }

  revalidatePath(`/releases/${releaseId}`);
  revalidatePath("/");
}

export async function bulkTrackAction(formData: FormData) {
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
      await db.update(tracks).set({ listened: value }).where(eq(tracks.id, trackId));
      if (value) {
        await logFeedbackEvent({ eventType: "listened", source: "action_bulk_track", trackId });
      }
    } else {
      await db
        .update(tracks)
        .set({ saved: value })
        .where(eq(tracks.id, trackId));
      await logFeedbackEvent({
        eventType: value ? "saved_add" : "saved_remove",
        source: "action_bulk_track",
        trackId,
      });
    }
  }

  if (field === "listened") {
    if (value) {
      await db
        .update(queueItems)
        .set({ status: "played" })
        .where(and(inArray(queueItems.trackId, trackIds), eq(queueItems.status, "pending")));
    }
    const touchedTracks = await Promise.all(trackIds.map((trackId) => db.query.tracks.findFirst({ where: eq(tracks.id, trackId) })));
    const releaseIds = new Set(touchedTracks.map((item) => item?.releaseId).filter((item): item is number => typeof item === "number"));
    for (const releaseId of releaseIds) {
      await recomputeReleaseListened(releaseId);
    }
  }

  revalidatePath("/listen");
  revalidatePath("/");
}

export async function toggleReleaseWishlistAction(formData: FormData) {
  const releaseId = Number(formData.get("releaseId"));
  await toggleReleaseWishlist(releaseId);
  const release = await db.query.releases.findFirst({ where: eq(releases.id, releaseId) });
  await logFeedbackEvent({
    eventType: release?.wishlist ? "record_wishlist_add" : "record_wishlist_remove",
    source: "action_toggle_release",
    releaseId,
    labelId: release?.labelId ?? null,
  });
  revalidatePath(`/releases/${releaseId}`);
  revalidatePath("/");
}
