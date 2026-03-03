"use server";

import { and, asc, desc, eq, inArray, like, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiCache, labels, queueItems, releases, sourceReleases, tracks } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { getEffectiveApiKeys } from "@/lib/api-keys";
import { db } from "@/lib/db";
import { parseArtistIdFromInput, parseLabelIdFromInput, searchDiscogsArtists, searchDiscogsLabels } from "@/lib/discogs";
import { syncDiscogsWantsToLocal } from "@/lib/discogs-wants-sync";
import { toExternalDiscogsId, toStoredDiscogsId } from "@/lib/discogs-id";
import { refreshSourceMetadata } from "@/lib/label-metadata";
import { chooseTrackMatch, processSingleReleaseForSource, toggleReleaseWishlist, toggleTrackTodo } from "@/lib/processing";
import { deriveReleaseListenedFromTracks } from "@/lib/release-listened";
import { logFeedbackEvent } from "@/lib/recommendations";
import { seedLabels, seedSearchLabels } from "@/lib/seed-data";
import { purgeExpiredWorkerLocks } from "@/lib/worker-locks";

function userScope(userId: string) {
  return {
    labels: eq(labels.userId, userId),
    releases: eq(releases.userId, userId),
    tracks: eq(tracks.userId, userId),
    queueItems: eq(queueItems.userId, userId),
  };
}

function normalizeForFuzzy(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(\d+\)\s*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isSubsequence(needle: string, haystack: string) {
  if (!needle) return true;
  let idx = 0;
  for (const ch of haystack) {
    if (ch === needle[idx]) idx += 1;
    if (idx >= needle.length) return true;
  }
  return false;
}

function scoreLabelName(query: string, candidate: string) {
  const q = normalizeForFuzzy(query);
  const c = normalizeForFuzzy(candidate);
  if (!q || !c) return 0;
  if (q === c) return 120;
  if (c.startsWith(q)) return 102;
  if (q.startsWith(c) && c.length >= 4) return 95;
  if (c.includes(q)) return 88;

  const qTokens = new Set(q.split(" ").filter(Boolean));
  const cTokens = new Set(c.split(" ").filter(Boolean));
  let overlap = 0;
  for (const token of qTokens) {
    if (cTokens.has(token)) overlap += 1;
  }
  const tokenScore = qTokens.size > 0 ? Math.round((overlap / qTokens.size) * 70) : 0;
  const subseqScore = isSubsequence(q.replace(/\s+/g, ""), c.replace(/\s+/g, "")) ? 18 : 0;
  return tokenScore + subseqScore;
}

function deriveNameFromDiscogsUrl(urlLike: string, kind: "label" | "artist", id: number) {
  const fallback = `${kind === "artist" ? "Artist" : "Label"} ${id}`;
  const trimmed = urlLike.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed || fallback;
  try {
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/\/(?:label|artist)\/\d+-([^/?#]+)/i);
    if (!match?.[1]) return fallback;
    const slug = decodeURIComponent(match[1]).replace(/[-_]+/g, " ").trim();
    return slug || fallback;
  } catch {
    return fallback;
  }
}

type LocalLabelCandidate = { id: number; title: string; score: number };

function chooseBestDiscogsSearchResult(
  query: string,
  results: Array<{ id: number; title: string }>,
): { id: number; title: string } | null {
  const ranked = results
    .map((item) => ({ ...item, score: scoreLabelName(query, item.title) }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top) return null;
  return { id: top.id, title: top.title };
}

async function findBestLocalLabelCandidate(
  userId: string,
  query: string,
  kind: "label" | "artist" = "label",
): Promise<LocalLabelCandidate | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  const scope = userScope(userId);
  const candidateMap = new Map<number, LocalLabelCandidate>();

  const knownLabels = await db.query.labels.findMany({
    where: and(scope.labels, eq(labels.entityKind, kind)),
    columns: { id: true, name: true, externalDiscogsId: true },
  });
  for (const label of knownLabels) {
    const externalId = label.externalDiscogsId ?? toExternalDiscogsId(label.id);
    if (!externalId || externalId <= 0) continue;
    const score = scoreLabelName(q, label.name);
    if (score <= 0) continue;
    const previous = candidateMap.get(externalId);
    if (!previous || score > previous.score) {
      candidateMap.set(externalId, { id: externalId, title: label.name, score });
    }
  }

  const cachedSearchRows = await db
    .select({ responseJson: apiCache.responseJson })
    .from(apiCache)
    .where(
      and(
        eq(apiCache.userId, userId),
        like(apiCache.key, `discogs:${userId}:/database/search?%type=${kind}%`),
      ),
    )
    .orderBy(desc(apiCache.fetchedAt))
    .limit(220);

  for (const row of cachedSearchRows) {
    try {
      const parsed = JSON.parse(row.responseJson) as { results?: Array<{ id?: number; title?: string }> };
      for (const item of parsed.results ?? []) {
        const id = item.id;
        const title = item.title?.trim();
        if (!id || !title) continue;
        const score = scoreLabelName(q, title);
        if (score <= 0) continue;
        const previous = candidateMap.get(id);
        if (!previous || score > previous.score) {
          candidateMap.set(id, { id, title, score });
        }
      }
    } catch {
      // Ignore malformed cache rows and continue.
    }
  }

  const ranked = [...candidateMap.values()].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const second = ranked[1];
  if (!top) return null;
  if (top.score < 64) return null;
  if (second && top.score - second.score < 4) return null;
  return top;
}

async function resolveBestSourceCandidate(userId: string, query: string) {
  const [bestLabel, bestArtist] = await Promise.all([
    findBestLocalLabelCandidate(userId, query, "label"),
    findBestLocalLabelCandidate(userId, query, "artist"),
  ]);

  if (bestLabel && bestArtist) {
    return bestArtist.score > bestLabel.score
      ? { kind: "artist" as const, candidate: bestArtist }
      : { kind: "label" as const, candidate: bestLabel };
  }
  if (bestLabel) return { kind: "label" as const, candidate: bestLabel };
  if (bestArtist) return { kind: "artist" as const, candidate: bestArtist };

  const [labelSearch, artistSearch] = await Promise.all([
    searchDiscogsLabels(query).catch(() => ({ results: [] as Array<{ id: number; title: string }> })),
    searchDiscogsArtists(query).catch(() => ({ results: [] as Array<{ id: number; title: string }> })),
  ]);

  const ranked = [
    ...labelSearch.results.slice(0, 6).map((item) => ({ kind: "label" as const, id: item.id, title: item.title, score: scoreLabelName(query, item.title) })),
    ...artistSearch.results.slice(0, 6).map((item) => ({ kind: "artist" as const, id: item.id, title: item.title, score: scoreLabelName(query, item.title) })),
  ]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (!top) return null;
  return { kind: top.kind, candidate: { id: top.id, title: top.title, score: top.score } };
}

async function upsertSourceById(userId: string, kind: "label" | "artist", id: number, fallbackName?: string) {
  const storedLabelId = toStoredDiscogsId(userId, id, "label");
  const now = new Date();
  await db
    .insert(labels)
    .values({
      id: storedLabelId,
      userId,
      entityKind: kind,
      externalDiscogsId: id,
      name: fallbackName || `${kind === "artist" ? "Artist" : "Label"} ${id}`,
      discogsUrl: `https://www.discogs.com/${kind}/${id}`,
      sourceType: "workspace",
      active: true,
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
        entityKind: kind,
        externalDiscogsId: id,
        name: fallbackName || `${kind === "artist" ? "Artist" : "Label"} ${id}`,
        discogsUrl: `https://www.discogs.com/${kind}/${id}`,
        updatedAt: now,
        sourceType: "workspace",
        active: true,
        status: "queued",
        lastError: null,
      },
    });
  return storedLabelId;
}

async function recomputeReleaseListened(userId: string, releaseId: number) {
  const scope = userScope(userId);
  const releaseTracks = await db.query.tracks.findMany({ where: and(eq(tracks.releaseId, releaseId), scope.tracks) });
  const listened = deriveReleaseListenedFromTracks(releaseTracks);
  await db.update(releases).set({ listened }).where(and(eq(releases.id, releaseId), scope.releases));
}

async function seedLabelsInternal() {
  const userId = await requireCurrentAppUserId();
  const keys = await getEffectiveApiKeys();
  const hasDiscogsToken = Boolean(keys.discogsToken);

  for (const label of seedLabels) {
    const id = parseLabelIdFromInput(label.discogs_url);
    if (!id) continue;
    await upsertSourceById(userId, "label", id, label.name);
  }

  if (hasDiscogsToken) {
    for (const searchName of seedSearchLabels) {
      try {
        const search = await searchDiscogsLabels(searchName);
        const first = search.results[0];
        if (!first) continue;
        await upsertSourceById(userId, "label", first.id, searchName);
      } catch {
        // Best-effort: skip unresolved search labels so direct-ID seeds still succeed.
      }
    }
  }
}

export async function addSourceAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const raw = String(formData.get("source") ?? formData.get("label") ?? "").trim();
  if (!raw) return;

  const requestedKindRaw = String(formData.get("entityKind") || "").toLowerCase();
  const requestedKind: "label" | "artist" | null =
    requestedKindRaw === "artist" ? "artist" : requestedKindRaw === "label" ? "label" : null;

  const explicitArtistUrl = /\/artist\/\d+/i.test(raw);
  const explicitLabelUrl = /\/label\/\d+/i.test(raw);
  const parsedArtistId = parseArtistIdFromInput(raw);
  const parsedLabelId = parseLabelIdFromInput(raw);

  let entityKind: "label" | "artist" =
    requestedKind ??
    (explicitArtistUrl && !explicitLabelUrl
      ? "artist"
      : explicitLabelUrl && !explicitArtistUrl
        ? "label"
        : "label");
  let id = entityKind === "artist" ? parsedArtistId : parsedLabelId;
  let name = raw;

  if (!id && !requestedKind && /^\d+$/.test(raw)) {
    const numericId = Number(raw);
    const existingByExternalId = await db.query.labels.findFirst({
      where: and(scope.labels, eq(labels.externalDiscogsId, numericId)),
      columns: { entityKind: true, name: true },
    });
    if (existingByExternalId) {
      entityKind = existingByExternalId.entityKind === "artist" ? "artist" : "label";
      id = numericId;
      name = existingByExternalId.name;
    }
  }

  if (!id) {
    if (!requestedKind) {
      const best = await resolveBestSourceCandidate(userId, raw);
      if (!best) throw new Error("No source found from search.");
      entityKind = best.kind;
      id = best.candidate.id;
      name = best.candidate.title;
    } else {
      const cachedMatch = await findBestLocalLabelCandidate(userId, raw, entityKind);
      if (cachedMatch) {
        id = cachedMatch.id;
        name = cachedMatch.title;
      } else {
        const search = entityKind === "artist" ? await searchDiscogsArtists(raw) : await searchDiscogsLabels(raw);
        const best = chooseBestDiscogsSearchResult(raw, search.results);
        if (!best) throw new Error(`No ${entityKind} found from search.`);
        id = best.id;
        name = best.title;
      }
    }
  }

  if (/^https?:\/\//i.test(name)) {
    name = deriveNameFromDiscogsUrl(name, entityKind, id);
  }
  const storedLabelId = await upsertSourceById(userId, entityKind, id, name);
  try {
    await refreshSourceMetadata(storedLabelId, entityKind, userId);
  } catch {
    // Non-blocking: metadata enrichment should not block adding labels.
  }
  try {
    // Kick one immediate processing step so newly added sources do not sit in queued state.
    await processSingleReleaseForSource(storedLabelId, userId);
  } catch {
    // Background daemon continues processing even if the immediate kick fails.
  }
  revalidatePath("/");
  const sourceName = encodeURIComponent(name.length > 80 ? `${name.slice(0, 77)}...` : name);
  redirect(`/?tab=step-1&notice=${encodeURIComponent(`Queued ${entityKind} source`)}&source=${sourceName}`);
}

export async function addLabelAction(formData: FormData) {
  const cloned = new FormData();
  for (const [key, value] of formData.entries()) cloned.append(key, value);
  if (!cloned.get("entityKind")) cloned.set("entityKind", "label");
  return addSourceAction(cloned);
}

export async function refreshLabelMetadataAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const labelId = Number(formData.get("labelId"));
  if (!labelId) return;
  const label = await db.query.labels.findFirst({ where: and(eq(labels.id, labelId), scope.labels) });
  if (!label) return;

  try {
    await refreshSourceMetadata(labelId, label.entityKind === "artist" ? "artist" : "label", userId);
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
      await refreshSourceMetadata(label.id, label.entityKind === "artist" ? "artist" : "label", userId);
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

function parseBatchLimit(formData: FormData, fallback = 5) {
  const raw = Number(formData.get("limit") ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(25, Math.floor(raw)));
}

export async function queueActiveSourcesBatchAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const limit = parseBatchLimit(formData, 5);
  const now = new Date();

  const candidates = await db.query.labels.findMany({
    where: and(eq(labels.active, true), scope.labels),
    orderBy: [asc(labels.updatedAt)],
    columns: { id: true, status: true },
  });

  let applied = 0;
  for (const source of candidates) {
    if (applied >= limit) break;
    if (source.status === "processing" || source.status === "complete") continue;
    await db
      .update(labels)
      .set({ status: "queued", lastError: null, updatedAt: now })
      .where(and(eq(labels.id, source.id), scope.labels));
    applied += 1;
  }

  revalidatePath("/");
}

export async function startSyncAction() {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const now = new Date();

  const allSources = await db.query.labels.findMany({
    where: scope.labels,
    orderBy: [asc(labels.updatedAt)],
    columns: { id: true, active: true, status: true },
  });

  for (const source of allSources) {
    // Resume/activate inactive sources unless they are already fully complete.
    if (!source.active && source.status !== "complete") {
      await db
        .update(labels)
        .set({ active: true, status: "queued", lastError: null, updatedAt: now })
        .where(and(eq(labels.id, source.id), scope.labels));
      continue;
    }

    // Queue active sources that are not currently processing/queued.
    if (source.active && source.status !== "processing" && source.status !== "queued") {
      await db
        .update(labels)
        .set({ status: "queued", lastError: null, updatedAt: now })
        .where(and(eq(labels.id, source.id), scope.labels));
    }
  }

  // Kick one source step immediately so Sync does not sit in "idle" after clicking Start.
  const firstQueued = await db.query.labels.findFirst({
    where: and(eq(labels.active, true), eq(labels.status, "queued"), scope.labels),
    orderBy: [asc(labels.updatedAt)],
    columns: { id: true },
  });
  if (firstQueued) {
    await db
      .update(labels)
      .set({ status: "processing", lastError: null, updatedAt: new Date() })
      .where(and(eq(labels.id, firstQueued.id), scope.labels));
    try {
      await processSingleReleaseForSource(firstQueued.id, userId);
    } catch {
      // Keep daemon-driven retries; start action should stay resilient.
    }
  }

  revalidatePath("/");
}

export async function retryErroredSourcesBatchAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const limit = parseBatchLimit(formData, 5);
  const now = new Date();

  const errored = await db.query.labels.findMany({
    where: and(eq(labels.status, "error"), eq(labels.active, true), scope.labels),
    orderBy: [asc(labels.updatedAt)],
    limit,
    columns: { id: true },
  });

  for (const source of errored) {
    await db
      .update(labels)
      .set({ status: "queued", lastError: null, retryCount: 0, updatedAt: now })
      .where(and(eq(labels.id, source.id), scope.labels));
  }

  revalidatePath("/");
}

export async function retrySpecificSourcesAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const rawIds = String(formData.get("sourceIds") || "");
  const ids = [...new Set(
    rawIds
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item > 0),
  )].slice(0, 30);
  if (ids.length === 0) return;

  const now = new Date();
  const targets = await db.query.labels.findMany({
    where: and(inArray(labels.id, ids), eq(labels.active, true), scope.labels),
    columns: { id: true, status: true },
  });

  for (const source of targets) {
    if (source.status !== "error") continue;
    await db
      .update(labels)
      .set({ status: "queued", lastError: null, retryCount: 0, updatedAt: now })
      .where(and(eq(labels.id, source.id), scope.labels));
  }

  revalidatePath("/");
}

export async function pauseAllActiveSourcesAction() {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const now = new Date();

  const activeSources = await db.query.labels.findMany({
    where: and(eq(labels.active, true), scope.labels),
    columns: { id: true, status: true },
  });

  for (const source of activeSources) {
    const nextStatus = source.status === "complete" ? "complete" : "paused";
    await db
      .update(labels)
      .set({ active: false, status: nextStatus, updatedAt: now })
      .where(and(eq(labels.id, source.id), scope.labels));
  }

  revalidatePath("/");
}

export async function clearStaleWorkerLocksAction() {
  await requireCurrentAppUserId();
  await purgeExpiredWorkerLocks();
  revalidatePath("/");
}

export async function resumePausedSourcesBatchAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const limit = parseBatchLimit(formData, 5);
  const now = new Date();

  const paused = await db.query.labels.findMany({
    where: and(eq(labels.active, false), eq(labels.status, "paused"), scope.labels),
    orderBy: [asc(labels.updatedAt)],
    limit,
    columns: { id: true },
  });

  for (const source of paused) {
    await db
      .update(labels)
      .set({ active: true, status: "queued", lastError: null, updatedAt: now })
      .where(and(eq(labels.id, source.id), scope.labels));
  }

  revalidatePath("/");
}

export async function retryLabelAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const labelId = Number(formData.get("labelId"));
  if (!labelId) return;
  const label = await db.query.labels.findFirst({ where: and(eq(labels.id, labelId), scope.labels) });
  if (!label) return;

  await db
    .update(labels)
    .set({ active: true, status: "processing", lastError: null, updatedAt: new Date() })
    .where(and(eq(labels.id, labelId), scope.labels));

  // Kick one processing step immediately so "Reload tracks" has visible progress without requiring queue runner.
  await processSingleReleaseForSource(labelId, userId);

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

  for (const releaseId of releaseIds) {
    const fallbackMappings = await db.query.sourceReleases.findMany({
      where: and(eq(sourceReleases.releaseId, releaseId), eq(sourceReleases.userId, userId)),
      orderBy: [desc(sourceReleases.discoveredAt)],
      limit: 4,
    });
    const fallback = fallbackMappings.find((item) => item.sourceId !== labelId);
    if (fallback && fallback.sourceId !== labelId) {
      await db
        .update(releases)
        .set({ labelId: fallback.sourceId })
        .where(and(eq(releases.id, releaseId), scope.releases));
    }
  }

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
  await syncDiscogsWantsToLocal({ force: true, maxItems: 200 });
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
  await processSingleReleaseForSource(firstLabel.id, userId);
  }

  revalidatePath("/");
}

export async function processLabelAction(formData: FormData) {
  const userId = await requireCurrentAppUserId();
  const scope = userScope(userId);
  const labelId = Number(formData.get("labelId"));
  if (!labelId) return;

  await db.update(labels).set({ status: "processing", updatedAt: new Date() }).where(and(eq(labels.id, labelId), scope.labels));
  await processSingleReleaseForSource(labelId, userId);

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
