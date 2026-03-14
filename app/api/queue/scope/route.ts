export const dynamic = "force-dynamic";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { labels, queueItems, releases, tracks, youtubeMatches } from "@/db/schema";
import { requireMutationUser, parseMutationBody } from "@/lib/api-mutation";
import { okJson } from "@/lib/api-response";
import { db } from "@/lib/db";
import { normalizePositiveIds } from "@/lib/positive-id-list";
import { buildQueueScopeMutationResponse } from "@/lib/queue-mutation-contract";
import { enqueuePendingTrackForUser } from "@/lib/track-queue-enqueue";

const schema = z.object({
  enabled: z.boolean().optional().default(true),
  trackIds: z.array(z.number().int().positive()).max(2000).default([]),
});

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "queue/scope",
    limit: 30,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const parsed = await parseMutationBody(request, schema, { fallbackBody: null });
  if (parsed.response) return parsed.response;

  if (!parsed.data.enabled) {
    return okJson(buildQueueScopeMutationResponse({ removed: 0 }));
  }

  const orderedTrackIds = normalizePositiveIds(parsed.data.trackIds, { max: 2000 });
  const allowedTrackIds = new Set(orderedTrackIds);
  const pendingItems = await db
    .select({ id: queueItems.id, trackId: queueItems.trackId, source: queueItems.source })
    .from(queueItems)
    .where(and(eq(queueItems.status, "pending"), eq(queueItems.userId, userId)));

  const playedTrackIds = orderedTrackIds.length
    ? new Set(
        (
          await db
            .select({ trackId: queueItems.trackId })
            .from(queueItems)
            .where(and(eq(queueItems.status, "played"), inArray(queueItems.trackId, orderedTrackIds), eq(queueItems.userId, userId)))
        )
          .map((row) => row.trackId)
          .filter((trackId): trackId is number => typeof trackId === "number"),
      )
    : new Set<number>();

  const shouldRemovePending = (item: { trackId: number | null; source: string }) =>
    !item.trackId ||
    !allowedTrackIds.has(item.trackId) ||
    (item.source === "scope_sync" && playedTrackIds.has(item.trackId));

  const idsToRemove = pendingItems.filter((item) => shouldRemovePending(item)).map((item) => item.id);
  const existingPendingTrackIds = new Set(
    pendingItems
      .filter((item) => !shouldRemovePending(item))
      .map((item) => item.trackId)
      .filter((trackId): trackId is number => typeof trackId === "number" && allowedTrackIds.has(trackId)),
  );

  if (idsToRemove.length > 0) {
    for (let start = 0; start < idsToRemove.length; start += 200) {
      const chunk = idsToRemove.slice(start, start + 200);
      await db.delete(queueItems).where(and(eq(queueItems.status, "pending"), inArray(queueItems.id, chunk), eq(queueItems.userId, userId)));
    }
  }

  const missingTrackIds = orderedTrackIds.filter(
    (trackId) => !existingPendingTrackIds.has(trackId) && !playedTrackIds.has(trackId),
  );
  if (missingTrackIds.length === 0) {
    return okJson(buildQueueScopeMutationResponse({
      removed: idsToRemove.length,
      added: 0,
      skipped: 0,
    }));
  }

  const candidateMatches = await db
    .select({
      trackId: youtubeMatches.trackId,
      videoId: youtubeMatches.videoId,
      chosen: youtubeMatches.chosen,
      score: youtubeMatches.score,
      id: youtubeMatches.id,
    })
    .from(youtubeMatches)
    .where(and(inArray(youtubeMatches.trackId, missingTrackIds), eq(youtubeMatches.userId, userId)))
    .orderBy(desc(youtubeMatches.chosen), desc(youtubeMatches.score), asc(youtubeMatches.id));

  const videoByTrackId = new Map<number, string>();
  for (const match of candidateMatches) {
    if (!videoByTrackId.has(match.trackId)) {
      videoByTrackId.set(match.trackId, match.videoId);
    }
  }

  const trackRows = await db
    .select({ id: tracks.id, releaseId: tracks.releaseId })
    .from(tracks)
    .where(and(inArray(tracks.id, missingTrackIds), eq(tracks.userId, userId)));
  const releaseIds = normalizePositiveIds(trackRows.map((row) => row.releaseId));
  const releaseRows = releaseIds.length
    ? await db
        .select({ id: releases.id, labelId: releases.labelId })
        .from(releases)
        .where(and(inArray(releases.id, releaseIds), eq(releases.userId, userId)))
    : [];
  const labelIds = normalizePositiveIds(releaseRows.map((row) => row.labelId));
  const labelRows = labelIds.length
    ? await db
        .select({ id: labels.id, active: labels.active })
        .from(labels)
        .where(and(inArray(labels.id, labelIds), eq(labels.userId, userId)))
    : [];

  const releaseById = new Map(releaseRows.map((row) => [row.id, row]));
  const labelById = new Map(labelRows.map((row) => [row.id, row]));
  const trackById = new Map(trackRows.map((row) => [row.id, row]));

  const now = new Date();
  const rowsToInsert: Array<{
    userId: string;
    youtubeVideoId: string;
    trackId: number;
    releaseId: number;
    labelId: number | null;
    source: string;
    priority: number;
    status: string;
    addedAt: Date;
  }> = [];
  let skipped = 0;

  for (const trackId of missingTrackIds) {
    const track = trackById.get(trackId);
    const youtubeVideoId = videoByTrackId.get(trackId);
    if (!track || !youtubeVideoId) {
      skipped += 1;
      continue;
    }
    const release = releaseById.get(track.releaseId);
    if (!release) {
      skipped += 1;
      continue;
    }
    const label = labelById.get(release.labelId);
    if (!label?.active) {
      skipped += 1;
      continue;
    }
    rowsToInsert.push({
      userId,
      youtubeVideoId,
      trackId,
      releaseId: track.releaseId,
      labelId: release.labelId ?? null,
      source: "scope_sync",
      priority: 0,
      status: "pending",
      addedAt: now,
    });
  }

  let insertedCount = 0;
  for (const row of rowsToInsert) {
    const inserted = await enqueuePendingTrackForUser({
      userId: row.userId,
      youtubeVideoId: row.youtubeVideoId,
      trackId: row.trackId,
      releaseId: row.releaseId,
      labelId: row.labelId,
      queueSource: row.source,
      feedbackSource: "queue_scope_sync",
      priority: row.priority,
      addedAt: row.addedAt,
    });
    if (inserted.inserted) insertedCount += 1;
  }

  return okJson(buildQueueScopeMutationResponse({
    removed: idsToRemove.length,
    added: insertedCount,
    skipped,
  }));
}
