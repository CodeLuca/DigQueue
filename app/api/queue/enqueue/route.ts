export const dynamic = "force-dynamic";

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { labels, queueItems, releases, tracks, youtubeMatches } from "@/db/schema";
import { db } from "@/lib/db";
import { getFirstDiscogsReleaseYoutubeVideoId } from "@/lib/discogs";
import { logFeedbackEvent } from "@/lib/recommendations";
import { findTrackSeedVideos } from "@/lib/track-video-sources";
import {
  buildYoutubeQuery,
  isYoutubeQuotaExceededError,
  scoreYoutubeMatch,
  searchYoutube,
} from "@/lib/youtube";

const schema = z.object({
  trackId: z.number().int().positive(),
  matchId: z.number().int().positive().optional(),
  queueMode: z.enum(["normal", "next"]).default("normal"),
});

async function nextQueuePriority() {
  const maxPriorityRow = await db
    .select({ value: queueItems.priority })
    .from(queueItems)
    .where(eq(queueItems.status, "pending"))
    .orderBy(desc(queueItems.priority), desc(queueItems.id))
    .limit(1);
  return (maxPriorityRow[0]?.value ?? 0) + 1;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const track = await db.query.tracks.findFirst({ where: eq(tracks.id, parsed.data.trackId) });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const release = await db.query.releases.findFirst({ where: eq(releases.id, track.releaseId) });
  const label = release ? await db.query.labels.findFirst({ where: eq(labels.id, release.labelId) }) : null;
  if (label && !label.active) {
    return NextResponse.json(
      { ok: false, reason: "label_inactive", error: "Label is inactive. Activate it to queue tracks." },
      { status: 409 },
    );
  }

  let chosenMatch = null;
  if (parsed.data.matchId) {
    const explicitMatch = await db.query.youtubeMatches.findFirst({
      where: and(eq(youtubeMatches.id, parsed.data.matchId), eq(youtubeMatches.trackId, track.id)),
    });
    if (!explicitMatch) {
      return NextResponse.json({ ok: false, reason: "match_not_found", error: "Match not found for track." }, { status: 404 });
    }
    await db.update(youtubeMatches).set({ chosen: false }).where(eq(youtubeMatches.trackId, track.id));
    await db.update(youtubeMatches).set({ chosen: true }).where(eq(youtubeMatches.id, explicitMatch.id));
    chosenMatch = explicitMatch;
  } else {
    chosenMatch =
      (await db.query.youtubeMatches.findFirst({
        where: and(eq(youtubeMatches.trackId, track.id), eq(youtubeMatches.chosen, true)),
      })) ?? (await db.query.youtubeMatches.findFirst({ where: eq(youtubeMatches.trackId, track.id) }));
  }

  if (!chosenMatch) {
    const seeded = release
      ? await findTrackSeedVideos({
          releaseId: release.id,
          track: { id: track.id, title: track.title, artistsText: track.artistsText },
        })
      : [];
    if (seeded.length > 0) {
      await db.delete(youtubeMatches).where(eq(youtubeMatches.trackId, track.id));
      for (const [index, seed] of seeded.entries()) {
        await db.insert(youtubeMatches).values({
          trackId: track.id,
          videoId: seed.videoId,
          title: seed.title,
          channelTitle: seed.channelTitle,
          score: seed.score,
          embeddable: true,
          chosen: index === 0,
          fetchedAt: new Date(),
        });
      }
      chosenMatch = await db.query.youtubeMatches.findFirst({
        where: and(eq(youtubeMatches.trackId, track.id), eq(youtubeMatches.chosen, true)),
      });
    }
  }

  if (!chosenMatch) {
    if (release) {
      const discogsReleaseVideo = await getFirstDiscogsReleaseYoutubeVideoId(release.id);
      if (discogsReleaseVideo?.videoId) {
        await db.delete(youtubeMatches).where(eq(youtubeMatches.trackId, track.id));
        await db.insert(youtubeMatches).values({
          trackId: track.id,
          videoId: discogsReleaseVideo.videoId,
          title: discogsReleaseVideo.title,
          channelTitle: "Discogs",
          score: 2,
          embeddable: true,
          chosen: true,
          fetchedAt: new Date(),
        });
        chosenMatch = await db.query.youtubeMatches.findFirst({
          where: and(eq(youtubeMatches.trackId, track.id), eq(youtubeMatches.chosen, true)),
        });
      }
    }
  }

  if (!chosenMatch) {
    try {
      const query = buildYoutubeQuery({
        primaryArtist: track.artistsText || release?.artist,
        trackTitle: track.title,
        labelName: label?.name,
        catno: release?.catno,
      });
      const ytResults = await searchYoutube(query);
      const scored = ytResults.map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        score: scoreYoutubeMatch(query, item.snippet.title),
      }));

      if (scored.length > 0) {
        await db.delete(youtubeMatches).where(eq(youtubeMatches.trackId, track.id));

        for (const [idx, match] of scored.entries()) {
          await db.insert(youtubeMatches).values({
            trackId: track.id,
            videoId: match.videoId,
            title: match.title,
            channelTitle: match.channelTitle,
            score: match.score,
            embeddable: true,
            chosen: idx === 0,
            fetchedAt: new Date(),
          });
        }

        chosenMatch = await db.query.youtubeMatches.findFirst({
          where: and(eq(youtubeMatches.trackId, track.id), eq(youtubeMatches.chosen, true)),
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const reason = isYoutubeQuotaExceededError(error) ? "youtube_quota_exceeded" : "youtube_error";
      return NextResponse.json(
        {
          ok: false,
          reason,
          error: detail,
        },
        { status: reason === "youtube_quota_exceeded" ? 200 : 502 },
      );
    }
  }

  if (!chosenMatch) {
    return NextResponse.json({
      ok: false,
      reason: "no_match",
      error: "Track unavailable for playback.",
    });
  }

  const existing = await db.query.queueItems.findFirst({
    where: and(
      eq(queueItems.trackId, track.id),
      eq(queueItems.youtubeVideoId, chosenMatch.videoId),
      eq(queueItems.status, "pending"),
    ),
    with: {
      track: true,
      release: true,
      label: true,
    },
  });

  if (existing) {
    if (parsed.data.queueMode === "next") {
      const priority = await nextQueuePriority();
      await db
        .update(queueItems)
        .set({ priority, bumpedAt: new Date() })
        .where(eq(queueItems.id, existing.id));
      const promoted = await db.query.queueItems.findFirst({
        where: eq(queueItems.id, existing.id),
        with: { track: true, release: true, label: true },
      });
      return NextResponse.json({ ok: true, item: promoted ?? existing, reused: true, queuedNext: true });
    }
    return NextResponse.json({ ok: true, item: existing, reused: true });
  }

  const priority = parsed.data.queueMode === "next" ? await nextQueuePriority() : 0;
  await db.insert(queueItems).values({
    youtubeVideoId: chosenMatch.videoId,
    trackId: track.id,
    releaseId: track.releaseId,
    labelId: release?.labelId ?? null,
    source: "inbox",
    priority,
    bumpedAt: parsed.data.queueMode === "next" ? new Date() : null,
    status: "pending",
    addedAt: new Date(),
  });
  await logFeedbackEvent({
    eventType: "queued",
    source: "api_queue_enqueue",
    trackId: track.id,
    releaseId: track.releaseId,
    labelId: release?.labelId ?? null,
  });

  const inserted = await db.query.queueItems.findMany({
    where: and(eq(queueItems.trackId, track.id), eq(queueItems.status, "pending")),
    orderBy: [desc(queueItems.id)],
    limit: 1,
    with: {
      track: true,
      release: true,
      label: true,
    },
  });

  return NextResponse.json({
    ok: true,
    item: inserted[0] ?? null,
    reused: false,
    queuedNext: parsed.data.queueMode === "next",
  });
}
