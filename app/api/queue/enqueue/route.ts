export const dynamic = "force-dynamic";

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { labels, queueItems, releases, tracks, youtubeMatches } from "@/db/schema";
import { requireMutationUser, parseMutationBody } from "@/lib/api-mutation";
import { notFoundJson, okJson } from "@/lib/api-response";
import { db } from "@/lib/db";
import {
  QUEUE_ENQUEUE_REASON_NO_MATCH,
  QUEUE_ENQUEUE_REASON_YOUTUBE_ERROR,
  QUEUE_ENQUEUE_REASON_YOUTUBE_QUOTA_EXCEEDED,
} from "@/lib/queue-enqueue-contract";
import { dedupePendingQueueItems } from "@/lib/queue-maintenance";
import { getFirstDiscogsReleaseYoutubeVideoId } from "@/lib/discogs";
import { enqueuePendingTrackForUser } from "@/lib/track-queue-enqueue";
import { findTrackSeedVideos } from "@/lib/track-video-sources";
import { ensurePendingTrackQueueItem, replaceTrackYoutubeMatches, selectTrackYoutubeMatch } from "@/lib/track-youtube-matches";
import { buildTrackYoutubeSearchQueries, collectYoutubeSearchMatches } from "@/lib/youtube-match-search";
import {
  isYoutubeQuotaExceededError,
} from "@/lib/youtube";

const schema = z.object({
  trackId: z.number().int().positive(),
  matchId: z.number().int().positive().optional(),
  queueMode: z.enum(["normal", "next"]).default("normal"),
});

async function nextQueuePriority(userId: string) {
  const maxPriorityRow = await db
    .select({ value: queueItems.priority })
    .from(queueItems)
    .where(and(eq(queueItems.status, "pending"), eq(queueItems.userId, userId)))
    .orderBy(desc(queueItems.priority), desc(queueItems.id))
    .limit(1);
  return (maxPriorityRow[0]?.value ?? 0) + 1;
}

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "queue/enqueue",
    limit: 30,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const parsed = await parseMutationBody(request, schema);
  if (parsed.response) return parsed.response;

  const track = await db.query.tracks.findFirst({ where: and(eq(tracks.id, parsed.data.trackId), eq(tracks.userId, userId)) });
  if (!track) {
    return notFoundJson("Track not found");
  }

  // Keep pending queue clean for this track to avoid runaway duplicates from prior races/imports.
  await dedupePendingQueueItems(userId, { trackId: track.id });

  const release = await db.query.releases.findFirst({ where: and(eq(releases.id, track.releaseId), eq(releases.userId, userId)) });
  const label = release ? await db.query.labels.findFirst({ where: and(eq(labels.id, release.labelId), eq(labels.userId, userId)) }) : null;

  let chosenMatch = null;
  if (parsed.data.matchId) {
    const explicitMatch = await selectTrackYoutubeMatch(userId, track.id, parsed.data.matchId, { embeddableOnly: true });
    if (!explicitMatch) {
      return NextResponse.json({ ok: false, reason: QUEUE_ENQUEUE_REASON_NO_MATCH, error: "Match not found for track." });
    }
    chosenMatch = explicitMatch;
  } else {
    chosenMatch =
      (await db.query.youtubeMatches.findFirst({
        where: and(
          eq(youtubeMatches.trackId, track.id),
          eq(youtubeMatches.chosen, true),
          eq(youtubeMatches.embeddable, true),
          eq(youtubeMatches.userId, userId),
        ),
      })) ?? (await db.query.youtubeMatches.findFirst({
        where: and(eq(youtubeMatches.trackId, track.id), eq(youtubeMatches.embeddable, true), eq(youtubeMatches.userId, userId)),
      }));
  }

  if (!chosenMatch) {
    const seeded = release
      ? await findTrackSeedVideos({
          releaseId: release.id,
          track: { id: track.id, title: track.title, artistsText: track.artistsText },
        })
      : [];
    if (seeded.length > 0) {
      await replaceTrackYoutubeMatches(userId, track.id, seeded.map((seed, index) => ({
        videoId: seed.videoId,
        title: seed.title,
        channelTitle: seed.channelTitle,
        score: seed.score,
        embeddable: true,
        chosen: index === 0,
      })));
      chosenMatch = await db.query.youtubeMatches.findFirst({
        where: and(eq(youtubeMatches.trackId, track.id), eq(youtubeMatches.chosen, true), eq(youtubeMatches.userId, userId)),
      });
    }
  }

  // Fallback for historical tracks: reuse the most recent queued/played video
  // so old library items can still play even if match rows were pruned/missed.
  if (!chosenMatch) {
    const historicalQueueItem = await db.query.queueItems.findFirst({
      where: and(eq(queueItems.trackId, track.id), eq(queueItems.userId, userId)),
      columns: { youtubeVideoId: true, id: true },
      orderBy: [desc(queueItems.id)],
    });
    if (historicalQueueItem?.youtubeVideoId) {
      chosenMatch = {
        videoId: historicalQueueItem.youtubeVideoId,
        title: "Previously played",
        channelTitle: "History",
        embeddable: true,
      };
    }
  }

  if (!chosenMatch) {
    if (release) {
      const discogsReleaseVideo = await getFirstDiscogsReleaseYoutubeVideoId(release.id);
      if (discogsReleaseVideo?.videoId) {
        await replaceTrackYoutubeMatches(userId, track.id, [{
          videoId: discogsReleaseVideo.videoId,
          title: discogsReleaseVideo.title,
          channelTitle: "Discogs",
          score: 2,
          embeddable: true,
          chosen: true,
        }]);
        chosenMatch = await db.query.youtubeMatches.findFirst({
          where: and(eq(youtubeMatches.trackId, track.id), eq(youtubeMatches.chosen, true), eq(youtubeMatches.userId, userId)),
        });
      }
    }
  }

  if (!chosenMatch) {
    try {
      const scored = await collectYoutubeSearchMatches(
        buildTrackYoutubeSearchQueries({
          primaryArtist: track.artistsText || release?.artist,
          trackTitle: track.title,
          labelName: label?.name,
          catno: release?.catno,
        }),
        { limit: 8 },
      );

      if (scored.length > 0) {
        await replaceTrackYoutubeMatches(userId, track.id, scored.map((match, idx) => ({
          videoId: match.videoId,
          title: match.title,
          channelTitle: match.channelTitle,
          score: match.score,
          embeddable: true,
          chosen: idx === 0,
        })));

        chosenMatch = await db.query.youtubeMatches.findFirst({
          where: and(eq(youtubeMatches.trackId, track.id), eq(youtubeMatches.chosen, true), eq(youtubeMatches.userId, userId)),
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const reason = isYoutubeQuotaExceededError(error)
        ? QUEUE_ENQUEUE_REASON_YOUTUBE_QUOTA_EXCEEDED
        : QUEUE_ENQUEUE_REASON_YOUTUBE_ERROR;
      return NextResponse.json(
        {
          ok: false,
          reason,
          error: detail,
        },
        { status: reason === QUEUE_ENQUEUE_REASON_YOUTUBE_QUOTA_EXCEEDED ? 200 : 502 },
      );
    }
  }

  if (!chosenMatch) {
    return NextResponse.json({
      ok: false,
      reason: QUEUE_ENQUEUE_REASON_NO_MATCH,
      error: "Track unavailable for playback.",
    });
  }

  const existing = await db.query.queueItems.findFirst({
    where: and(eq(queueItems.trackId, track.id), eq(queueItems.status, "pending"), eq(queueItems.userId, userId)),
    with: {
      track: true,
      release: true,
      label: true,
    },
  });

  if (existing) {
    if (parsed.data.queueMode === "next") {
      const priority = await nextQueuePriority(userId);
      await ensurePendingTrackQueueItem({
        userId,
        youtubeVideoId: chosenMatch.videoId,
        trackId: track.id,
        releaseId: track.releaseId,
        labelId: release?.labelId ?? null,
        source: "inbox",
        priority,
        bumpedAt: new Date(),
      });
      const promoted = await db.query.queueItems.findFirst({
        where: and(eq(queueItems.id, existing.id), eq(queueItems.userId, userId)),
        with: { track: true, release: true, label: true },
      });
      return okJson({ item: promoted ?? existing, reused: existing.youtubeVideoId === chosenMatch.videoId, queuedNext: true });
    }
    if (existing.youtubeVideoId === chosenMatch.videoId) {
      return okJson({ item: existing, reused: true });
    }
    await ensurePendingTrackQueueItem({
      userId,
      youtubeVideoId: chosenMatch.videoId,
      trackId: track.id,
      releaseId: track.releaseId,
      labelId: release?.labelId ?? null,
      source: "inbox",
      priority: existing.priority,
      bumpedAt: existing.bumpedAt,
    });
    const replaced = await db.query.queueItems.findFirst({
      where: and(eq(queueItems.id, existing.id), eq(queueItems.userId, userId)),
      with: { track: true, release: true, label: true },
    });
    return okJson({ item: replaced ?? existing, reused: false });
  }

  const priority = parsed.data.queueMode === "next" ? await nextQueuePriority(userId) : 0;
  await enqueuePendingTrackForUser({
    userId,
    youtubeVideoId: chosenMatch.videoId,
    trackId: track.id,
    releaseId: track.releaseId,
    labelId: release?.labelId ?? null,
    queueSource: "inbox",
    feedbackSource: "api_queue_enqueue",
    priority,
    bumpedAt: parsed.data.queueMode === "next" ? new Date() : null,
  });

  const inserted = await db.query.queueItems.findMany({
    where: and(eq(queueItems.trackId, track.id), eq(queueItems.status, "pending"), eq(queueItems.userId, userId)),
    orderBy: [desc(queueItems.id)],
    limit: 1,
    with: {
      track: true,
      release: true,
      label: true,
    },
  });

  return okJson({
    item: inserted[0] ?? null,
    reused: false,
    queuedNext: parsed.data.queueMode === "next",
  });
}
