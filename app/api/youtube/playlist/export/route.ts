import { NextResponse } from "next/server";
import { isUnauthorizedError, requireRouteUserId } from "@/lib/app-user";
import { getWishlistData } from "@/lib/queries";
import { collectUniquePlayableVideoIds, normalizePlaylistExportInput } from "@/lib/youtube-playlist-export";
import { getYoutubeAccessTokenForPlaylistWrite, isYoutubeOAuthConfigured } from "@/lib/youtube-oauth";

type ExportRequest = {
  title?: string;
  visibility?: "private" | "unlisted" | "public";
};

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "YouTube playlist export failed.";
}

async function youtubeApi<T>(input: {
  token: string;
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
}) {
  const response = await fetch(input.url, {
    method: input.method || "GET",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
    cache: "no-store",
  });

  const json = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    const detail = json?.error?.message || `status ${response.status}`;
    throw new Error(`YouTube API error: ${detail}`);
  }

  return json;
}

export async function POST(request: Request) {
  try {
    const auth = await requireRouteUserId();
    if (auth.response) return auth.response;
    if (!isYoutubeOAuthConfigured()) {
      return NextResponse.json({ ok: false, error: "YouTube OAuth is not configured on this deployment." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as ExportRequest;
    const { title, visibility } = normalizePlaylistExportInput(body);

    const wishlist = await getWishlistData(undefined, false);
    const { all: uniqueVideoIds, selected, skippedByLimit } = collectUniquePlayableVideoIds(wishlist.rows, 200);

    if (uniqueVideoIds.length === 0) {
      return NextResponse.json({ ok: false, error: "No saved tracks with playable YouTube videos found." }, { status: 400 });
    }

    const token = await getYoutubeAccessTokenForPlaylistWrite();

    const playlist = await youtubeApi<{ id?: string }>({
      token,
      url: "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
      method: "POST",
      body: {
        snippet: {
          title,
          description: "Created by DigQueue from your Library saved tracks.",
        },
        status: { privacyStatus: visibility },
      },
    });

    const playlistId = playlist.id;
    if (!playlistId) {
      throw new Error("Playlist was created without an id.");
    }

    let added = 0;
    for (const videoId of selected) {
      await youtubeApi({
        token,
        url: "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
        method: "POST",
        body: {
          snippet: {
            playlistId,
            resourceId: {
              kind: "youtube#video",
              videoId,
            },
          },
        },
      });
      added += 1;
    }

    return NextResponse.json({
      ok: true,
      playlistId,
      playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
      added,
      attempted: selected.length,
      totalEligible: uniqueVideoIds.length,
      skippedByLimit,
    });
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: toErrorMessage(error) }, { status: 500 });
  }
}
