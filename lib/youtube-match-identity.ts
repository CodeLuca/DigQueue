type YoutubeMatchCandidate = {
  videoId: string;
  title: string;
  channelTitle: string;
  score: number;
  embeddable: boolean;
  chosen?: boolean;
};

function compareYoutubeCandidates(a: YoutubeMatchCandidate, b: YoutubeMatchCandidate) {
  if (Boolean(a.chosen) !== Boolean(b.chosen)) return Number(Boolean(a.chosen)) - Number(Boolean(b.chosen));
  if (a.embeddable !== b.embeddable) return Number(a.embeddable) - Number(b.embeddable);
  if (a.score !== b.score) return a.score - b.score;
  return 0;
}

export function normalizeYoutubeMatchCandidates(matches: YoutubeMatchCandidate[]) {
  const byVideoId = new Map<string, YoutubeMatchCandidate>();
  for (const match of matches) {
    const videoId = match.videoId?.trim();
    if (!videoId) continue;
    const normalized = {
      ...match,
      videoId,
      title: match.title.trim(),
      channelTitle: match.channelTitle.trim(),
    };
    const existing = byVideoId.get(videoId);
    if (!existing || compareYoutubeCandidates(normalized, existing) > 0) {
      byVideoId.set(videoId, normalized);
    }
  }

  const normalized = [...byVideoId.values()];
  let chosenIndex = normalized.findIndex((match) => match.chosen);
  if (normalized.length > 0 && chosenIndex === -1) {
    chosenIndex = 0;
  }
  for (let idx = 0; idx < normalized.length; idx += 1) {
    normalized[idx] = {
      ...normalized[idx],
      chosen: idx === chosenIndex,
    };
  }
  return normalized;
}
