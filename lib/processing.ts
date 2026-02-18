import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { labels, queueItems, releases, tracks, youtubeMatches } from "@/db/schema";
import { db } from "@/lib/db";
import { extractYoutubeVideoId, fetchDiscogsLabelReleases, fetchDiscogsRelease, setDiscogsReleaseWishlist } from "@/lib/discogs";
import { captureReleaseSignals } from "@/lib/release-signals";
import { logFeedbackEvent } from "@/lib/recommendations";
import { getBandcampTrackVideosForRelease, getDiscogsTrackVideos } from "@/lib/track-video-sources";
import { isYoutubeFatalConfigError, searchYoutube } from "@/lib/youtube";

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 1200);
  return String(error).slice(0, 1200);
}

export async function ensureLabelReleasePage(labelId: number) {
  const label = await db.query.labels.findFirst({ where: eq(labels.id, labelId) });
  if (!label) throw new Error("Label not found.");
  if (!label.active) return;

  const pendingRelease = await db.query.releases.findFirst({
    where: and(eq(releases.labelId, labelId), eq(releases.detailsFetched, false)),
  });
  if (pendingRelease) return;
  if (label.currentPage > label.totalPages) return;

  const pageData = await fetchDiscogsLabelReleases(labelId, label.currentPage, 100);
  const now = new Date();

  for (const [index, release] of pageData.releases.entries()) {
    await db
      .insert(releases)
      .values({
        id: release.id,
        labelId,
        title: release.title,
        artist: release.artist || "Unknown Artist",
        year: release.year || null,
        catno: release.catno || null,
        discogsUrl: `https://www.discogs.com/release/${release.id}`,
        thumbUrl: release.thumb || null,
        fetchedAt: now,
        releaseOrder: index + (label.currentPage - 1) * 100,
      })
      .onConflictDoNothing();
  }

  await db
    .update(labels)
    .set({
      currentPage: label.currentPage + 1,
      totalPages: pageData.pagination.pages,
      updatedAt: now,
      lastError: null,
    })
    .where(eq(labels.id, labelId));
}

async function finalizeReleaseQueueing(params: {
  releaseId: number;
  labelId: number;
  artist: string;
  title: string;
  trackCount: number;
  weakMatchCount: number;
}) {
  const releaseLooksWeak =
    params.trackCount > 0 && params.weakMatchCount >= Math.max(2, Math.ceil(params.trackCount * 0.6));

  if (!releaseLooksWeak) return;

  const release = await fetchDiscogsRelease(params.releaseId);
  const topDiscogsVideo = (release.videos ?? [])
    .map((video) => {
      const videoId = extractYoutubeVideoId(video.uri || "");
      if (!videoId) return null;
      return { videoId, title: video.title || "Discogs release video" };
    })
    .find((item): item is { videoId: string; title: string } => Boolean(item));

  let topReleaseCandidateVideoId: string | null = topDiscogsVideo?.videoId ?? null;
  try {
    if (!topReleaseCandidateVideoId) {
      const releaseQuery = `${params.artist} ${params.title} full album`;
      const releaseCandidates = await searchYoutube(releaseQuery);
      topReleaseCandidateVideoId = releaseCandidates[0]?.id.videoId ?? null;
    }
  } catch {
    return;
  }
  if (!topReleaseCandidateVideoId) return;

  const existingReleaseQueueItem = await db.query.queueItems.findFirst({
    where: and(eq(queueItems.releaseId, params.releaseId), isNull(queueItems.trackId), eq(queueItems.status, "pending")),
  });
  if (existingReleaseQueueItem) return;

  await db.insert(queueItems).values({
    youtubeVideoId: topReleaseCandidateVideoId,
    trackId: null,
    releaseId: params.releaseId,
    labelId: params.labelId,
    source: "release_fallback",
    status: "pending",
    addedAt: new Date(),
  });
}

export async function processSingleReleaseForLabel(labelId: number) {
  const label = await db.query.labels.findFirst({ where: eq(labels.id, labelId) });
  if (!label) throw new Error("Label not found.");
  if (!label.active) return { done: false, message: "Label inactive." };

  try {
    await ensureLabelReleasePage(labelId);

    const nextRelease = await db.query.releases.findFirst({
      where: and(eq(releases.labelId, labelId), eq(releases.detailsFetched, false)),
      orderBy: [asc(releases.releaseOrder)],
    });

    if (!nextRelease) {
      const refreshedLabel = await db.query.labels.findFirst({ where: eq(labels.id, labelId) });
      if (refreshedLabel && refreshedLabel.currentPage > refreshedLabel.totalPages) {
        await db.update(labels).set({ status: "complete", updatedAt: new Date(), lastError: null }).where(eq(labels.id, labelId));
        return { done: true, message: "Label processing complete." };
      }
      return { done: false, message: "Fetching next release page..." };
    }

    const releaseDetails = await fetchDiscogsRelease(nextRelease.id);
    await captureReleaseSignals(releaseDetails, nextRelease.artist, nextRelease.year);
    await db.delete(tracks).where(eq(tracks.releaseId, nextRelease.id));

    const trackRows = releaseDetails.tracklist.filter((item) => item.title?.trim());
    for (const track of trackRows) {
      await db.insert(tracks).values({
        releaseId: nextRelease.id,
        position: track.position || "",
        title: track.title,
        duration: track.duration || null,
        artistsText: track.artists?.map((artist) => artist.name).join(", ") || releaseDetails.artists_sort || null,
        createdAt: new Date(),
      });
    }

    await db.update(releases).set({ detailsFetched: true, fetchedAt: new Date(), processingError: null }).where(eq(releases.id, nextRelease.id));

    const releaseTracks = await db.query.tracks.findMany({ where: eq(tracks.releaseId, nextRelease.id), orderBy: [asc(tracks.id)] });
    const discogsTrackMatches = getDiscogsTrackVideos(
      releaseTracks.map((track) => ({ id: track.id, title: track.title, artistsText: track.artistsText })),
      releaseDetails.videos,
    );
    const bandcampTrackMatches = await getBandcampTrackVideosForRelease(
      nextRelease.id,
      releaseTracks.map((track) => ({ id: track.id, title: track.title, artistsText: track.artistsText })),
    );

    let weakMatchCount = 0;
    let matchedCount = 0;

    for (const track of releaseTracks) {
      try {
        const seededMatchesRaw = [
          ...(discogsTrackMatches.get(track.id) ?? []),
          ...(bandcampTrackMatches.get(track.id) ?? []),
        ];
        const seededMatches = seededMatchesRaw.filter(
          (match, index, list) => list.findIndex((item) => item.videoId === match.videoId) === index,
        );

        if (seededMatches.length > 0) {
          await db.delete(youtubeMatches).where(eq(youtubeMatches.trackId, track.id));
          for (const [index, match] of seededMatches.entries()) {
            await db.insert(youtubeMatches).values({
              trackId: track.id,
              videoId: match.videoId,
              title: match.title,
              channelTitle: match.channelTitle,
              score: match.score,
              embeddable: true,
              chosen: index === 0,
              fetchedAt: new Date(),
            });
          }

          matchedCount += 1;
          const chosenVideoId = seededMatches[0]?.videoId;
          if (!chosenVideoId) continue;
          const existing = await db.query.queueItems.findFirst({
            where: and(
              eq(queueItems.trackId, track.id),
              eq(queueItems.youtubeVideoId, chosenVideoId),
              eq(queueItems.status, "pending"),
            ),
          });

          if (!existing) {
            await db.insert(queueItems).values({
              youtubeVideoId: chosenVideoId,
              trackId: track.id,
              releaseId: nextRelease.id,
              labelId,
              source: seededMatches[0]?.source === "bandcamp" ? "bandcamp_track_video" : "discogs_track_video",
              status: "pending",
              addedAt: new Date(),
            });
          }
          continue;
        }

        weakMatchCount += 1;
      } catch (error) {
        if (isYoutubeFatalConfigError(error)) {
          throw error;
        }
        weakMatchCount += 1;
        await db
          .update(releases)
          .set({ processingError: `Track match issue: ${safeErrorMessage(error)}` })
          .where(eq(releases.id, nextRelease.id));
      }
    }

    await finalizeReleaseQueueing({
      releaseId: nextRelease.id,
      labelId,
      artist: nextRelease.artist,
      title: nextRelease.title,
      trackCount: releaseTracks.length,
      weakMatchCount,
    });

    const confidence = releaseTracks.length === 0 ? 0 : matchedCount / releaseTracks.length;

    await db
      .update(releases)
      .set({
        youtubeMatched: matchedCount > 0,
        matchConfidence: confidence,
        fetchedAt: new Date(),
      })
      .where(eq(releases.id, nextRelease.id));

    await db
      .update(labels)
      .set({
        status: "processing",
        updatedAt: new Date(),
        lastError: null,
      })
      .where(eq(labels.id, labelId));

    return { done: false, message: `Processed ${nextRelease.title}` };
  } catch (error) {
    const message = safeErrorMessage(error);
    await db
      .update(labels)
      .set({
        status: "error",
        retryCount: label.retryCount + 1,
        lastError: message,
        updatedAt: new Date(),
      })
      .where(eq(labels.id, labelId));

    return { done: false, message: `Error: ${message}` };
  }
}

export async function chooseTrackMatch(trackId: number, youtubeMatchId: number) {
  const match = await db.query.youtubeMatches.findFirst({ where: eq(youtubeMatches.id, youtubeMatchId) });
  if (!match) throw new Error("Match not found");

  await db.update(youtubeMatches).set({ chosen: false }).where(eq(youtubeMatches.trackId, trackId));
  await db.update(youtubeMatches).set({ chosen: true }).where(eq(youtubeMatches.id, youtubeMatchId));

  const track = await db.query.tracks.findFirst({ where: eq(tracks.id, trackId) });
  if (!track) return;

  const release = await db.query.releases.findFirst({ where: eq(releases.id, track.releaseId) });

  const existing = await db.query.queueItems.findFirst({ where: and(eq(queueItems.trackId, trackId), eq(queueItems.status, "pending")) });
  if (!existing) {
    await db.insert(queueItems).values({
      youtubeVideoId: match.videoId,
      trackId,
      releaseId: track.releaseId,
      labelId: release?.labelId ?? null,
      source: "manual_override",
      status: "pending",
      addedAt: new Date(),
    });
    await logFeedbackEvent({
      eventType: "queued",
      source: "manual_override",
      trackId,
      releaseId: track.releaseId,
      labelId: release?.labelId ?? null,
    });
  }
}

export async function nextQueueItem(currentId?: number, mode: "track" | "release" | "hybrid" = "track") {
  if (currentId) {
    await db.update(queueItems).set({ status: "played" }).where(eq(queueItems.id, currentId));
  }

  const baseCondition = eq(queueItems.status, "pending");
  const condition =
    mode === "track"
      ? and(baseCondition, isNotNull(queueItems.trackId))
      : mode === "release"
        ? and(baseCondition, isNull(queueItems.trackId))
        : baseCondition;

  const items = await db.query.queueItems.findMany({
    where: condition,
    orderBy: [desc(queueItems.priority), desc(queueItems.bumpedAt), asc(queueItems.id)],
    limit: 200,
    with: {
      track: true,
      release: true,
      label: true,
    },
  });
  return items.find((item) => item.label?.active === true) ?? null;
}

export async function toggleTrackTodo(trackId: number, field: "listened" | "saved") {
  const track = await db.query.tracks.findFirst({ where: eq(tracks.id, trackId) });
  if (!track) return;

  if (field === "listened") {
    const nextValue = !track.listened;
    await db.update(tracks).set({ listened: nextValue }).where(eq(tracks.id, trackId));
    if (nextValue) {
      await db
        .update(queueItems)
        .set({ status: "played" })
        .where(and(eq(queueItems.trackId, trackId), eq(queueItems.status, "pending")));
      await logFeedbackEvent({ eventType: "listened", source: "toggle_track_todo", trackId, releaseId: track.releaseId });
    }
  } else {
    const nextSaved = !track.saved;
    await db
      .update(tracks)
      .set({ saved: nextSaved })
      .where(eq(tracks.id, trackId));
    await logFeedbackEvent({
      eventType: nextSaved ? "saved_add" : "saved_remove",
      source: "toggle_track_todo",
      trackId,
      releaseId: track.releaseId,
    });
  }
}

export async function toggleReleaseWishlist(releaseId: number) {
  const release = await db.query.releases.findFirst({ where: eq(releases.id, releaseId) });
  if (!release) return;
  const nextWishlist = !release.wishlist;
  await db.update(releases).set({ wishlist: nextWishlist }).where(eq(releases.id, releaseId));
  try {
    await setDiscogsReleaseWishlist(releaseId, nextWishlist);
  } catch {
    // Keep local state even if external sync fails.
  }
}

export async function upNext(limit = 20) {
  const items = await db.query.queueItems.findMany({
    where: eq(queueItems.status, "pending"),
    limit: Math.max(limit * 3, 60),
    orderBy: [desc(queueItems.priority), desc(queueItems.bumpedAt), asc(queueItems.id)],
    with: {
      track: true,
      release: true,
      label: true,
    },
  });
  return items.filter((item) => item.label?.active === true).slice(0, limit);
}

export async function recommendationCandidates(limit = 12) {
  return db.query.tracks.findMany({
    where: and(eq(tracks.listened, false), eq(tracks.saved, true)),
    limit,
    orderBy: [asc(tracks.createdAt)],
    with: { release: true },
  });
}
