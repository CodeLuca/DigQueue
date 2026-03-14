import { buildYoutubeQuery, scoreYoutubeMatch, searchYoutube } from "@/lib/youtube";

export type YoutubeSearchMatch = {
  videoId: string;
  title: string;
  channelTitle: string;
  score: number;
};

export function buildTrackYoutubeSearchQueries(input: {
  primaryArtist?: string | null;
  trackTitle: string;
  labelName?: string | null;
  catno?: string | null;
}) {
  const primaryQuery = buildYoutubeQuery({
    primaryArtist: input.primaryArtist || undefined,
    trackTitle: input.trackTitle,
    labelName: input.labelName || undefined,
    catno: input.catno || undefined,
  });
  const broadQuery = `${input.primaryArtist || ""} ${input.trackTitle}`.trim();
  const bareQuery = input.trackTitle.trim();

  return [primaryQuery, broadQuery, bareQuery].filter(
    (value, index, all) => value.length > 0 && all.indexOf(value) === index,
  );
}

export async function collectYoutubeSearchMatches(
  queries: string[],
  options?: { limit?: number },
) {
  const seenIds = new Set<string>();
  const matches: YoutubeSearchMatch[] = [];
  const limit = options?.limit ?? 8;

  for (const query of queries) {
    const items = await searchYoutube(query);
    for (const item of items) {
      const videoId = item.id.videoId;
      if (!videoId || seenIds.has(videoId)) continue;
      seenIds.add(videoId);
      matches.push({
        videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        score: scoreYoutubeMatch(query, item.snippet.title),
      });
      if (matches.length >= limit) {
        return matches;
      }
    }
  }

  return matches;
}
