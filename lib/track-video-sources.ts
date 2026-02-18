import { findReleaseLinks } from "@/lib/finder";
import { extractYoutubeVideoId, fetchDiscogsRelease } from "@/lib/discogs";

type TrackLike = {
  id: number;
  title: string;
  artistsText?: string | null;
};

export type TrackVideoCandidate = {
  videoId: string;
  title: string;
  channelTitle: string;
  score: number;
  source: "discogs" | "bandcamp";
};

type DiscogsVideo = { uri?: string; title?: string };

function decodeHtmlEntities(input: string) {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

function cleanToken(token: string) {
  return token.trim().toLowerCase();
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map(cleanToken)
    .filter(Boolean);
}

function toComparable(input: string) {
  return tokenize(input).join(" ");
}

function scoreTitleMatch(trackTitle: string, candidateTitle: string) {
  const trackComparable = toComparable(trackTitle);
  const candidateComparable = toComparable(candidateTitle);
  if (!trackComparable || !candidateComparable) return -10;
  if (trackComparable === candidateComparable) return 10;
  if (candidateComparable.includes(trackComparable)) return 8;
  if (trackComparable.includes(candidateComparable) && candidateComparable.length >= 6) return 5;

  const trackTokens = new Set(tokenize(trackTitle));
  const candidateTokens = new Set(tokenize(candidateTitle));
  let overlap = 0;
  for (const token of trackTokens) {
    if (candidateTokens.has(token)) overlap += 1;
  }

  const shortTrackPenalty = trackTokens.size <= 1 ? 1 : 0;
  return overlap * 2 - shortTrackPenalty;
}

function collectYoutubeIds(text: string) {
  const ids = new Set<string>();
  const normalized = text
    .replaceAll("\\/", "/")
    .replaceAll("\\u0026", "&")
    .replaceAll("&amp;", "&");
  const patterns = [
    /(?:youtube\.com\/watch\?(?:[^"'\s<]*&)?v=|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(normalized);
    while (match) {
      ids.add(match[1]);
      match = pattern.exec(normalized);
    }
  }
  return [...ids];
}

function parseBandcampTrackInfo(albumHtml: string) {
  const tralbumMatch = albumHtml.match(/data-tralbum="([^"]+)"/i);
  if (!tralbumMatch) return [] as Array<{ title: string; titleLink?: string; raw: string }>;

  try {
    const jsonRaw = decodeHtmlEntities(tralbumMatch[1]);
    const parsed = JSON.parse(jsonRaw) as { trackinfo?: Array<{ title?: string; title_link?: string }> };
    return (parsed.trackinfo ?? [])
      .filter((item) => item.title && item.title.trim())
      .map((item) => ({
        title: item.title!.trim(),
        titleLink: item.title_link?.trim() || undefined,
        raw: JSON.stringify(item),
      }));
  } catch {
    return [];
  }
}

function mapBandcampTrackTitle(trackTitle: string, releaseTracks: TrackLike[]) {
  const scored = releaseTracks
    .map((track) => ({ track, score: scoreTitleMatch(track.title, trackTitle) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 3) return null;
  return best.track;
}

async function fetchText(url: string) {
  const response = await fetch(url, { next: { revalidate: 0 } });
  if (!response.ok) return null;
  return response.text();
}

async function getBandcampTrackVideos(albumUrl: string, releaseTracks: TrackLike[]) {
  const albumHtml = await fetchText(albumUrl);
  if (!albumHtml) return new Map<number, TrackVideoCandidate[]>();

  const matches = new Map<number, TrackVideoCandidate[]>();
  const trackInfo = parseBandcampTrackInfo(albumHtml);

  const trackCandidates = await Promise.all(
    trackInfo.map(async (item) => {
      const ids = new Set<string>();
      for (const id of collectYoutubeIds(item.raw)) ids.add(id);
      if (item.titleLink) {
        try {
          const trackUrl = new URL(item.titleLink, albumUrl).toString();
          const trackHtml = await fetchText(trackUrl);
          if (trackHtml) {
            for (const id of collectYoutubeIds(trackHtml)) ids.add(id);
          }
        } catch {
          // ignored: invalid track URL
        }
      }
      return { title: item.title, ids: [...ids] };
    }),
  );

  for (const candidate of trackCandidates) {
    if (candidate.ids.length === 0) continue;
    const mappedTrack = mapBandcampTrackTitle(candidate.title, releaseTracks);
    if (!mappedTrack) continue;

    const existing = matches.get(mappedTrack.id) ?? [];
    const existingIds = new Set(existing.map((item) => item.videoId));
    for (const videoId of candidate.ids) {
      if (existingIds.has(videoId)) continue;
      existing.push({
        videoId,
        title: `Bandcamp: ${candidate.title}`,
        channelTitle: "Bandcamp",
        score: 9,
        source: "bandcamp",
      });
      existingIds.add(videoId);
    }
    matches.set(mappedTrack.id, existing);
  }

  return matches;
}

export function getDiscogsTrackVideos(
  releaseTracks: TrackLike[],
  videos: DiscogsVideo[] | undefined | null,
) {
  const candidates = (videos ?? [])
    .map((video) => ({ videoId: extractYoutubeVideoId(video.uri || ""), title: (video.title || "").trim() }))
    .filter((video): video is { videoId: string; title: string } => Boolean(video.videoId));

  const matches = new Map<number, TrackVideoCandidate[]>();
  const assignedVideoIds = new Set<string>();

  const scoredPairs = releaseTracks
    .flatMap((track) =>
      candidates.map((candidate) => ({
        trackId: track.id,
        candidate,
        score: scoreTitleMatch(track.title, candidate.title),
      })),
    )
    .filter((row) => row.score >= 3)
    .sort((a, b) => b.score - a.score);

  const assignedTracks = new Set<number>();
  for (const pair of scoredPairs) {
    if (assignedTracks.has(pair.trackId)) continue;
    if (assignedVideoIds.has(pair.candidate.videoId)) continue;
    matches.set(pair.trackId, [
      {
        videoId: pair.candidate.videoId,
        title: pair.candidate.title || "Discogs release video",
        channelTitle: "Discogs",
        score: pair.score,
        source: "discogs",
      },
    ]);
    assignedTracks.add(pair.trackId);
    assignedVideoIds.add(pair.candidate.videoId);
  }

  return matches;
}

export async function getBandcampTrackVideosForRelease(releaseId: number, releaseTracks: TrackLike[]) {
  try {
    const links = await findReleaseLinks(releaseId);
    const bestBandcamp = links.bestBandcamp;
    if (!bestBandcamp) return new Map<number, TrackVideoCandidate[]>();
    return getBandcampTrackVideos(bestBandcamp.url, releaseTracks);
  } catch {
    return new Map<number, TrackVideoCandidate[]>();
  }
}

export async function findTrackSeedVideos(params: { releaseId: number; track: TrackLike }) {
  const release = await fetchDiscogsRelease(params.releaseId);
  const discogsMatches = getDiscogsTrackVideos([params.track], release.videos);
  const directDiscogs = discogsMatches.get(params.track.id) ?? [];
  if (directDiscogs.length > 0) return directDiscogs;

  const bandcampMatches = await getBandcampTrackVideosForRelease(params.releaseId, [params.track]);
  return bandcampMatches.get(params.track.id) ?? [];
}
