export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { buildYoutubeQuery, scoreYoutubeMatch, searchYoutube } from "@/lib/youtube";

const inputSchema = z.object({
  primaryArtist: z.string().optional(),
  trackTitle: z.string().min(1),
  labelName: z.string().optional(),
  catno: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const query = buildYoutubeQuery(parsed.data);
    const items = await searchYoutube(query);
    const matches = items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      score: scoreYoutubeMatch(query, item.snippet.title),
    }));

    return NextResponse.json({ query, matches });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "YouTube search failed",
        detail: message,
      },
      { status: 502 },
    );
  }
}
