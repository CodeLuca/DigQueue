import { and, eq, inArray, or } from "drizzle-orm";
import { queueItems, releases, tracks } from "@/db/schema";
import { db } from "@/lib/db";
import { normalizePositiveIds } from "@/lib/positive-id-list";
import { buildReleaseListenedUpdatePlan } from "@/lib/release-listened-plan";
import { logFeedbackEvent } from "@/lib/recommendations";

type ReleaseTrackRow = {
  id: number;
  releaseId: number;
  listened: boolean;
  saved: boolean;
};

type TrackListenedMutation = {
  trackId: number;
  releaseId: number;
  changed: boolean;
  nextValue: boolean;
  markPendingPlayed: boolean;
  feedbackEventType: string | null;
};

export async function refreshReleaseListenedForUser(userId: string, releaseIdsInput: Iterable<number>) {
  const releaseIds = normalizePositiveIds(releaseIdsInput);
  if (releaseIds.length === 0) return { listenedIds: [] as number[], unlistenedIds: [] as number[] };

  const releaseTrackRows = await db
    .select({ releaseId: tracks.releaseId, listened: tracks.listened })
    .from(tracks)
    .where(and(inArray(tracks.releaseId, releaseIds), eq(tracks.userId, userId)));

  const updatePlan = buildReleaseListenedUpdatePlan(releaseIds, releaseTrackRows);
  if (updatePlan.listenedIds.length > 0) {
    await db
      .update(releases)
      .set({ listened: true })
      .where(and(inArray(releases.id, updatePlan.listenedIds), eq(releases.userId, userId)));
  }
  if (updatePlan.unlistenedIds.length > 0) {
    await db
      .update(releases)
      .set({ listened: false })
      .where(and(inArray(releases.id, updatePlan.unlistenedIds), eq(releases.userId, userId)));
  }
  return updatePlan;
}

export async function applyTrackListenedMutationsForUser(input: {
  userId: string;
  source: string;
  mutations: TrackListenedMutation[];
}) {
  const changedMutations = input.mutations.filter((mutation) => mutation.changed);
  if (changedMutations.length === 0) return { updatedTrackIds: [] as number[], releaseIds: [] as number[] };

  const listenedTrackIds = changedMutations.filter((mutation) => mutation.nextValue).map((mutation) => mutation.trackId);
  const unlistenedTrackIds = changedMutations.filter((mutation) => !mutation.nextValue).map((mutation) => mutation.trackId);
  if (listenedTrackIds.length > 0) {
    await db
      .update(tracks)
      .set({ listened: true })
      .where(and(inArray(tracks.id, listenedTrackIds), eq(tracks.userId, input.userId)));
  }
  if (unlistenedTrackIds.length > 0) {
    await db
      .update(tracks)
      .set({ listened: false })
      .where(and(inArray(tracks.id, unlistenedTrackIds), eq(tracks.userId, input.userId)));
  }

  const pendingTrackIds = changedMutations.filter((mutation) => mutation.markPendingPlayed).map((mutation) => mutation.trackId);
  if (pendingTrackIds.length > 0) {
    await db
      .update(queueItems)
      .set({ status: "played" })
      .where(and(inArray(queueItems.trackId, pendingTrackIds), eq(queueItems.status, "pending"), eq(queueItems.userId, input.userId)));
  }

  await Promise.allSettled(
    changedMutations
      .filter((mutation) => mutation.feedbackEventType === "listened")
      .map((mutation) =>
        logFeedbackEvent({
          eventType: "listened",
          source: input.source,
          trackId: mutation.trackId,
          releaseId: mutation.releaseId,
          userId: input.userId,
        }),
      ),
  );

  const releaseIds = normalizePositiveIds(changedMutations.map((mutation) => mutation.releaseId));
  await refreshReleaseListenedForUser(input.userId, releaseIds);
  return { updatedTrackIds: changedMutations.map((mutation) => mutation.trackId), releaseIds };
}

export async function applyTrackSavedMutationsForUser(input: {
  userId: string;
  source: string;
  mutations: TrackListenedMutation[];
}) {
  const changedMutations = input.mutations.filter((mutation) => mutation.changed);
  if (changedMutations.length === 0) return { updatedTrackIds: [] as number[] };

  const savedTrackIds = changedMutations.filter((mutation) => mutation.nextValue).map((mutation) => mutation.trackId);
  const unsavedTrackIds = changedMutations.filter((mutation) => !mutation.nextValue).map((mutation) => mutation.trackId);
  if (savedTrackIds.length > 0) {
    await db
      .update(tracks)
      .set({ saved: true })
      .where(and(inArray(tracks.id, savedTrackIds), eq(tracks.userId, input.userId)));
  }
  if (unsavedTrackIds.length > 0) {
    await db
      .update(tracks)
      .set({ saved: false })
      .where(and(inArray(tracks.id, unsavedTrackIds), eq(tracks.userId, input.userId)));
  }

  await Promise.allSettled(
    changedMutations
      .filter((mutation) => mutation.feedbackEventType === "saved_add" || mutation.feedbackEventType === "saved_remove")
      .map((mutation) =>
        logFeedbackEvent({
          eventType: mutation.feedbackEventType as "saved_add" | "saved_remove",
          source: input.source,
          trackId: mutation.trackId,
          releaseId: mutation.releaseId,
          userId: input.userId,
        }),
      ),
  );

  return { updatedTrackIds: changedMutations.map((mutation) => mutation.trackId) };
}

export async function markReleaseReviewedForUser(input: {
  userId: string;
  source: string;
  releaseTracks: ReleaseTrackRow[];
  affectedReleaseIds: number[];
  maxTrackFeedbackEvents?: number;
}) {
  const trackIds = normalizePositiveIds(input.releaseTracks.map((track) => track.id));
  const affectedReleaseIds = normalizePositiveIds(input.affectedReleaseIds);
  if (trackIds.length === 0 || affectedReleaseIds.length === 0) {
    return { updatedTrackIds: [] as number[], newlyListenedTrackIds: [] as number[] };
  }

  const newlyListened = input.releaseTracks.filter((track) => !track.listened);
  await db
    .update(tracks)
    .set({ listened: true })
    .where(and(inArray(tracks.id, trackIds), eq(tracks.userId, input.userId)));

  await db
    .update(queueItems)
    .set({ status: "played" })
    .where(
      and(
        eq(queueItems.status, "pending"),
        eq(queueItems.userId, input.userId),
        or(
          inArray(queueItems.releaseId, affectedReleaseIds),
          inArray(queueItems.trackId, trackIds),
        ),
      ),
    );

  await db
    .update(releases)
    .set({ listened: true })
    .where(and(inArray(releases.id, affectedReleaseIds), eq(releases.userId, input.userId)));

  const feedbackLimit = Math.max(0, input.maxTrackFeedbackEvents ?? 120);
  await Promise.allSettled(
    newlyListened.slice(0, feedbackLimit).map((track) =>
      logFeedbackEvent({
        eventType: "listened",
        source: input.source,
        trackId: track.id,
        releaseId: track.releaseId,
        userId: input.userId,
      }),
    ),
  );

  return {
    updatedTrackIds: trackIds,
    newlyListenedTrackIds: newlyListened.map((track) => track.id),
  };
}
