import { and, eq, inArray, isNull } from "drizzle-orm";
import { queueItems, youtubeMatches } from "@/db/schema";
import { db } from "@/lib/db";
import { planChosenYoutubeMatchSelection } from "@/lib/queue-duplicates";
import { normalizeYoutubeMatchCandidates } from "@/lib/youtube-match-identity";
import { shouldAllowRequestedYoutubeMatch } from "@/lib/youtube-match-selection";

type YoutubeMatchInsert = {
  videoId: string;
  title: string;
  channelTitle: string;
  score: number;
  embeddable: boolean;
  chosen?: boolean;
};

type YoutubeMatchSelection = {
  id: number;
  videoId: string;
  title: string;
  channelTitle: string;
  score: number;
  embeddable: boolean;
};

type PendingTrackQueueInsert = {
  userId: string;
  youtubeVideoId: string;
  trackId: number;
  releaseId: number | null;
  labelId: number | null;
  source: string;
  priority?: number;
  bumpedAt?: Date | null;
  addedAt?: Date;
};

type PendingReleaseQueueInsert = {
  userId: string;
  youtubeVideoId: string;
  releaseId: number;
  labelId: number | null;
  source: string;
  priority?: number;
  bumpedAt?: Date | null;
  addedAt?: Date;
};

function isNamedUniqueViolation(error: unknown, constraintName: string) {
  if (!(error instanceof Error)) return false;
  const message = error.message || "";
  const code = typeof (error as { code?: unknown }).code === "string" ? String((error as { code?: string }).code) : "";
  return code === "23505" && message.includes(constraintName);
}

export async function replaceTrackYoutubeMatches(userId: string, trackId: number, matches: YoutubeMatchInsert[]) {
  return db.transaction(async (tx) => {
    await tx.delete(youtubeMatches).where(and(eq(youtubeMatches.trackId, trackId), eq(youtubeMatches.userId, userId)));
    const normalizedMatches = normalizeYoutubeMatchCandidates(matches);
    if (normalizedMatches.length === 0) return [];

    const chosenIndex = Math.max(0, normalizedMatches.findIndex((match) => match.chosen));
    const inserted = await tx
      .insert(youtubeMatches)
      .values(
        normalizedMatches.map((match) => ({
          userId,
          trackId,
          videoId: match.videoId,
          title: match.title,
          channelTitle: match.channelTitle,
          score: match.score,
          embeddable: match.embeddable,
          chosen: false,
          fetchedAt: new Date(),
        })),
      )
      .returning({ id: youtubeMatches.id });

    const selected = inserted[chosenIndex];
    if (selected) {
      await tx.update(youtubeMatches).set({ chosen: true }).where(eq(youtubeMatches.id, selected.id));
    }

    return inserted;
  });
}

export async function setChosenYoutubeMatch(userId: string, trackId: number, youtubeMatchId: number) {
  await db.transaction(async (tx) => {
    const rows = await tx.query.youtubeMatches.findMany({
      where: and(eq(youtubeMatches.userId, userId), eq(youtubeMatches.trackId, trackId)),
      columns: { id: true, chosen: true, score: true, fetchedAt: true },
    });
    const plan = planChosenYoutubeMatchSelection(rows, youtubeMatchId);
    if (typeof plan.chosenId !== "number") return;

    await tx
      .update(youtubeMatches)
      .set({ chosen: true })
      .where(and(eq(youtubeMatches.id, plan.chosenId), eq(youtubeMatches.userId, userId), eq(youtubeMatches.trackId, trackId)));

    if (plan.clearIds.length > 0) {
      await tx
        .update(youtubeMatches)
        .set({ chosen: false })
      .where(and(inArray(youtubeMatches.id, plan.clearIds), eq(youtubeMatches.userId, userId), eq(youtubeMatches.trackId, trackId)));
    }
  });
}

export async function selectTrackYoutubeMatch(
  userId: string,
  trackId: number,
  youtubeMatchId: number,
  options?: { embeddableOnly?: boolean },
): Promise<YoutubeMatchSelection | null> {
  return db.transaction(async (tx) => {
    const rows = await tx.query.youtubeMatches.findMany({
      where: and(eq(youtubeMatches.userId, userId), eq(youtubeMatches.trackId, trackId)),
      columns: {
        id: true,
        chosen: true,
        score: true,
        fetchedAt: true,
        videoId: true,
        title: true,
        channelTitle: true,
        embeddable: true,
      },
    });
    if (!shouldAllowRequestedYoutubeMatch(rows, youtubeMatchId, options)) {
      return null;
    }
    const plan = planChosenYoutubeMatchSelection(rows, youtubeMatchId);
    if (!plan.matchedRequestedId || typeof plan.chosenId !== "number") {
      return null;
    }

    await tx
      .update(youtubeMatches)
      .set({ chosen: true })
      .where(and(eq(youtubeMatches.id, plan.chosenId), eq(youtubeMatches.userId, userId), eq(youtubeMatches.trackId, trackId)));

    if (plan.clearIds.length > 0) {
      await tx
        .update(youtubeMatches)
        .set({ chosen: false })
        .where(and(inArray(youtubeMatches.id, plan.clearIds), eq(youtubeMatches.userId, userId), eq(youtubeMatches.trackId, trackId)));
    }

    const selected = rows.find((row) => row.id === plan.chosenId) ?? null;
    return selected
      ? {
          id: selected.id,
          videoId: selected.videoId,
          title: selected.title,
          channelTitle: selected.channelTitle,
          score: selected.score,
          embeddable: selected.embeddable,
        }
      : null;
  });
}

export async function ensurePendingTrackQueueItem(input: PendingTrackQueueInsert) {
  const addedAt = input.addedAt ?? new Date();
  try {
    await db.insert(queueItems).values({
      userId: input.userId,
      youtubeVideoId: input.youtubeVideoId,
      trackId: input.trackId,
      releaseId: input.releaseId,
      labelId: input.labelId,
      source: input.source,
      priority: input.priority ?? 0,
      bumpedAt: input.bumpedAt ?? null,
      status: "pending",
      addedAt,
    });
    return { inserted: true as const };
  } catch (error) {
    if (!isNamedUniqueViolation(error, "queue_items_user_pending_track_uq")) {
      throw error;
    }
    await db
      .update(queueItems)
      .set({
        youtubeVideoId: input.youtubeVideoId,
        releaseId: input.releaseId,
        labelId: input.labelId,
        source: input.source,
        priority: input.priority ?? 0,
        bumpedAt: input.bumpedAt ?? null,
      })
      .where(and(eq(queueItems.userId, input.userId), eq(queueItems.trackId, input.trackId), eq(queueItems.status, "pending")));
    return { inserted: false as const };
  }
}

export async function ensurePendingReleaseQueueItem(input: PendingReleaseQueueInsert) {
  const addedAt = input.addedAt ?? new Date();
  try {
    await db.insert(queueItems).values({
      userId: input.userId,
      youtubeVideoId: input.youtubeVideoId,
      trackId: null,
      releaseId: input.releaseId,
      labelId: input.labelId,
      source: input.source,
      priority: input.priority ?? 0,
      bumpedAt: input.bumpedAt ?? null,
      status: "pending",
      addedAt,
    });
    return { inserted: true as const };
  } catch (error) {
    if (!isNamedUniqueViolation(error, "queue_items_user_pending_release_uq")) {
      throw error;
    }
    await db
      .update(queueItems)
      .set({
        youtubeVideoId: input.youtubeVideoId,
        labelId: input.labelId,
        source: input.source,
        priority: input.priority ?? 0,
        bumpedAt: input.bumpedAt ?? null,
      })
      .where(and(eq(queueItems.userId, input.userId), eq(queueItems.releaseId, input.releaseId), eq(queueItems.status, "pending"), isNull(queueItems.trackId)));
    return { inserted: false as const };
  }
}
