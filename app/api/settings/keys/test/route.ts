export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getEffectiveApiKeys } from "@/lib/api-keys";
import { fetchDiscogsIdentity } from "@/lib/discogs";

export async function GET() {
  const keys = await getEffectiveApiKeys();

  const result = {
    discogs: { ok: false, message: "Not connected" },
    youtube: { ok: false, message: "Not set" },
  };

  if (keys.discogsToken) {
    try {
      await fetchDiscogsIdentity();
      result.discogs = { ok: true, message: "Discogs connected" };
    } catch {
      result.discogs = { ok: false, message: "Discogs auth test failed" };
    }
  }

  if (keys.youtubeApiKey) {
    try {
      const params = new URLSearchParams({
        key: keys.youtubeApiKey,
        q: "digqueue health check",
        part: "snippet",
        type: "video",
        maxResults: "1",
        videoEmbeddable: "true",
        videoSyndicated: "true",
        safeSearch: "none",
      });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
      if (response.ok) {
        result.youtube = { ok: true, message: "YouTube key valid" };
      } else {
        const body = await response.text();
        if (body.includes("API_KEY_SERVICE_BLOCKED")) {
          result.youtube = {
            ok: false,
            message: "YouTube key blocked: enable YouTube Data API v3 and allow this API key to use youtube.googleapis.com.",
          };
        } else {
          result.youtube = { ok: false, message: `YouTube test failed (${response.status})` };
        }
      }
    } catch {
      result.youtube = { ok: false, message: "YouTube test request failed" };
    }
  }

  return NextResponse.json(result);
}
