import { NextResponse } from "next/server";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { getWishlistData } from "@/lib/queries";
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
    await requireCurrentAppUserId();
    if (!isYoutubeOAuthConfigured()) {
      return NextResponse.json({ ok: false, error: "YouTube OAuth is not configured on this deployment." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as ExportRequest;
    const visibility = body.visibility === "public" || body.visibility === "unlisted" ? body.visibility : "private";
    const title = (body.title || "DigQueue Saved Tracks").trim().slice(0, 140) || "DigQueue Saved Tracks";

    const wishlist = await getWishlistData(undefined, false);
    const savedRows = wishlist.rows.filter((row) => row.saved && row.youtubeVideoId);
    const uniqueVideoIds: string[] = [];
    const seen = new Set<string>();
    for (const row of savedRows) {
      const id = row.youtubeVideoId || "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      uniqueVideoIds.push(id);
    }

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

    const maxItems = 200;
    const selected = uniqueVideoIds.slice(0, maxItems);

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
      skippedByLimit: Math.max(0, uniqueVideoIds.length - selected.length),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: toErrorMessage(error) }, { status: 500 });
  }
}
