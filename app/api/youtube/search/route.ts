export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMutationUser, parseMutationBody } from "@/lib/api-mutation";
import { errorJson } from "@/lib/api-response";
import { buildYoutubeQuery } from "@/lib/youtube";
import { collectYoutubeSearchMatches } from "@/lib/youtube-match-search";

const inputSchema = z.object({
  primaryArtist: z.string().optional(),
  trackTitle: z.string().min(1),
  labelName: z.string().optional(),
  catno: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "youtube/search",
    limit: 30,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;

  const parsed = await parseMutationBody(request, inputSchema);
  if (parsed.response) return parsed.response;

  try {
    const query = buildYoutubeQuery(parsed.data);
    const matches = await collectYoutubeSearchMatches([query], { limit: 5 });

    return NextResponse.json({ query, matches });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorJson(
      {
        error: "YouTube search failed",
        detail: message,
      },
      { status: 502 },
    );
  }
}
