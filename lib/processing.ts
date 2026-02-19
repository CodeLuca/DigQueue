import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { labels, queueItems, releases, tracks, youtubeMatches } from "@/db/schema";
import { db } from "@/lib/db";
import { extractYoutubeVideoId, fetchDiscogsLabelReleases, fetchDiscogsRelease, setDiscogsReleaseWishlist } from "@/lib/discogs";
import { toStoredDiscogsId } from "@/lib/discogs-id";
import { captureReleaseSignals } from "@/lib/release-signals";
import { logFeedbackEvent } from "@/lib/recommendations";
import { getBandcampTrackVideosForRelease, getDiscogsTrackVideos } from "@/lib/track-video-sources";
import { isYoutubeFatalConfigError, searchYoutube } from "@/lib/youtube";

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 1200);
  return String(error).slice(0, 1200);
}

function userScope(userId: string) {
  return {
    labels: eq(labels.userId, userId),
    releases: eq(releases.userId, userId),
    tracks: eq(tracks.userId, userId),
    youtubeMatches: eq(youtubeMatches.userId, userId),
    queueItems: eq(queueItems.userId, userId),
  };
}

export async function ensureLabelReleasePage(labelId: number, userId: string) {
  const scope = userScope(userId);
  const label = await db.query.labels.findFirst({ where: and(eq(labels.id, labelId), scope.labels) });
  if (!label) throw new Error("Label not found.");
  if (!label.active) return;

  const pendingRelease = await db.query.releases.findFirst({
    where: and(eq(releases.labelId, labelId), eq(releases.detailsFetched, false), scope.releases),
  });
  if (pendingRelease) return;
  if (label.currentPage > label.totalPages) return;

  const pageData = await fetchDiscogsLabelReleases(labelId, label.currentPage, 100);
  const now = new Date();

  for (const [index, release] of pageData.releases.entries()) {
    const storedReleaseId = toStoredDiscogsId(userId, release.id, "release");
    await db
      .insert(releases)
      .values({
        id: storedReleaseId,
        userId,
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
    .where(and(eq(labels.id, labelId), scope.labels));
}

async function finalizeReleaseQueueing(params: {
  userId: string;
  releaseId: number;
  labelId: number;
  artist: string;
  title: string;
  trackCount: number;
  weakMatchCount: number;
}) {
  const scope = userScope(params.userId);
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
    where: and(eq(queueItems.releaseId, params.releaseId), isNull(queueItems.trackId), eq(queueItems.status, "pending"), scope.queueItems),
  });
  if (existingReleaseQueueItem) return;

  await db.insert(queueItems).values({
    userId: params.userId,
    youtubeVideoId: topReleaseCandidateVideoId,
    trackId: null,
    releaseId: params.releaseId,
    labelId: params.labelId,
    source: "release_fallback",
    status: "pending",
    addedAt: new Date(),
  });
}

export async function processSingleReleaseForLabel(labelId: number, userId: string) {
  const scope = userScope(userId);
  const label = await db.query.labels.findFirst({ where: and(eq(labels.id, labelId), scope.labels) });
  if (!label) throw new Error("Label not found.");
  if (!label.active) return { done: false, message: "Label inactive." };

  try {
    await ensureLabelReleasePage(labelId, userId);

    const nextRelease = await db.query.releases.findFirst({
      where: and(eq(releases.labelId, labelId), eq(releases.detailsFetched, false), scope.releases),
      orderBy: [asc(releases.releaseOrder)],
    });

    if (!nextRelease) {
      const refreshedLabel = await db.query.labels.findFirst({ where: and(eq(labels.id, labelId), scope.labels) });
      if (refreshedLabel && refreshedLabel.currentPage > refreshedLabel.totalPages) {
        await db.update(labels).set({ status: "complete", updatedAt: new Date(), lastError: null }).where(and(eq(labels.id, labelId), scope.labels));
        return { done: true, message: "Label processing complete." };
      }
      return { done: false, message: "Fetching next release page..." };
    }

    const releaseDetails = await fetchDiscogsRelease(nextRelease.id);
    await captureReleaseSignals(releaseDetails, nextRelease.artist, nextRelease.year, userId);
    await db.delete(tracks).where(and(eq(tracks.releaseId, nextRelease.id), scope.tracks));

    const trackRows = releaseDetails.tracklist.filter((item) => item.title?.trim());
    for (const track of trackRows) {
      await db.insert(tracks).values({
        userId,
        releaseId: nextRelease.id,
        position: track.position || "",
        title: track.title,
        duration: track.duration || null,
        artistsText: track.artists?.map((artist) => artist.name).join(", ") || releaseDetails.artists_sort || null,
        createdAt: new Date(),
      });
    }

    await db.update(releases).set({ detailsFetched: true, fetchedAt: new Date(), processingError: null }).where(and(eq(releases.id, nextRelease.id), scope.releases));

    const releaseTracks = await db.query.tracks.findMany({ where: and(eq(tracks.releaseId, nextRelease.id), scope.tracks), orderBy: [asc(tracks.id)] });
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
          await db.delete(youtubeMatches).where(and(eq(youtubeMatches.trackId, track.id), scope.youtubeMatches));
          for (const [index, match] of seededMatches.entries()) {
            await db.insert(youtubeMatches).values({
              userId,
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
              scope.queueItems,
            ),
          });

          if (!existing) {
            await db.insert(queueItems).values({
              userId,
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
          .where(and(eq(releases.id, nextRelease.id), scope.releases));
      }
    }

    await finalizeReleaseQueueing({
      userId,
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
      .where(and(eq(releases.id, nextRelease.id), scope.releases));

    await db
      .update(labels)
      .set({
        status: "processing",
        updatedAt: new Date(),
        lastError: null,
      })
      .where(and(eq(labels.id, labelId), scope.labels));

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
      .where(and(eq(labels.id, labelId), scope.labels));

    return { done: false, message: `Error: ${message}` };
  }
}

export async function chooseTrackMatch(trackId: number, youtubeMatchId: number, userId: string) {
  const scope = userScope(userId);
  const match = await db.query.youtubeMatches.findFirst({ where: and(eq(youtubeMatches.id, youtubeMatchId), scope.youtubeMatches) });
  if (!match) throw new Error("Match not found");

  await db.update(youtubeMatches).set({ chosen: false }).where(and(eq(youtubeMatches.trackId, trackId), scope.youtubeMatches));
  await db.update(youtubeMatches).set({ chosen: true }).where(and(eq(youtubeMatches.id, youtubeMatchId), scope.youtubeMatches));

  const track = await db.query.tracks.findFirst({ where: and(eq(tracks.id, trackId), scope.tracks) });
  if (!track) return;

  const release = await db.query.releases.findFirst({ where: and(eq(releases.id, track.releaseId), scope.releases) });

  const existing = await db.query.queueItems.findFirst({ where: and(eq(queueItems.trackId, trackId), eq(queueItems.status, "pending"), scope.queueItems) });
  if (!existing) {
    await db.insert(queueItems).values({
      userId,
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
      userId,
    });
  }
}

export async function nextQueueItem(userId: string, currentId?: number, mode: "track" | "release" | "hybrid" = "track") {
  const scope = userScope(userId);
  if (currentId) {
    await db.update(queueItems).set({ status: "played" }).where(and(eq(queueItems.id, currentId), scope.queueItems));
  }

  const baseCondition = and(eq(queueItems.status, "pending"), scope.queueItems);
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

export async function nextQueueItemShuffled(userId: string, currentId?: number, mode: "track" | "release" | "hybrid" = "track") {
  const scope = userScope(userId);
  if (currentId) {
    await db.update(queueItems).set({ status: "played" }).where(and(eq(queueItems.id, currentId), scope.queueItems));
  }

  const baseCondition = and(eq(queueItems.status, "pending"), scope.queueItems);
  const condition =
    mode === "track"
      ? and(baseCondition, isNotNull(queueItems.trackId))
      : mode === "release"
        ? and(baseCondition, isNull(queueItems.trackId))
        : baseCondition;

  const items = await db.query.queueItems.findMany({
    where: condition,
    orderBy: [desc(queueItems.priority), desc(queueItems.bumpedAt), asc(queueItems.id)],
    limit: 1200,
    with: {
      track: true,
      release: true,
      label: true,
    },
  });
  const activeItems = items.filter((item) => item.label?.active === true);
  if (activeItems.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * activeItems.length);
  return activeItems[randomIndex] ?? null;
}

export async function toggleTrackTodo(trackId: number, field: "listened" | "saved", userId: string) {
  const scope = userScope(userId);
  const track = await db.query.tracks.findFirst({ where: and(eq(tracks.id, trackId), scope.tracks) });
  if (!track) return;

  if (field === "listened") {
    const nextValue = !track.listened;
    await db.update(tracks).set({ listened: nextValue }).where(and(eq(tracks.id, trackId), scope.tracks));
    if (nextValue) {
      await db
        .update(queueItems)
        .set({ status: "played" })
        .where(and(eq(queueItems.trackId, trackId), eq(queueItems.status, "pending"), scope.queueItems));
      await logFeedbackEvent({ eventType: "listened", source: "toggle_track_todo", trackId, releaseId: track.releaseId, userId });
    }
  } else {
    const nextSaved = !track.saved;
    await db
      .update(tracks)
      .set({ saved: nextSaved })
      .where(and(eq(tracks.id, trackId), scope.tracks));
    await logFeedbackEvent({
      eventType: nextSaved ? "saved_add" : "saved_remove",
      source: "toggle_track_todo",
      trackId,
      releaseId: track.releaseId,
      userId,
    });
  }
}

export async function toggleReleaseWishlist(releaseId: number, userId: string) {
  const scope = userScope(userId);
  const release = await db.query.releases.findFirst({ where: and(eq(releases.id, releaseId), scope.releases) });
  if (!release) return;
  const nextWishlist = !release.wishlist;
  await db.update(releases).set({ wishlist: nextWishlist }).where(and(eq(releases.id, releaseId), scope.releases));
  try {
    await setDiscogsReleaseWishlist(releaseId, nextWishlist);
  } catch {
    // Keep local state even if external sync fails.
  }
}

export async function upNext(userId: string, limit = 20) {
  const scope = userScope(userId);
  const items = await db.query.queueItems.findMany({
    where: and(eq(queueItems.status, "pending"), scope.queueItems),
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

export async function recommendationCandidates(userId: string, limit = 12) {
  const scope = userScope(userId);
  return db.query.tracks.findMany({
    where: and(eq(tracks.listened, false), eq(tracks.saved, true), scope.tracks),
    limit,
    orderBy: [asc(tracks.createdAt)],
    with: { release: true },
  });
}
