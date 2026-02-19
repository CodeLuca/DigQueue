import { and, desc, eq, inArray } from "drizzle-orm";
import { feedbackEvents, queueItems, releases, releaseSignals, tracks, youtubeMatches } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { searchDiscogsReleases } from "@/lib/discogs";

const EVENT_WEIGHTS: Record<string, number> = {
  played: 0.45,
  listened: 1.9,
  queued: 0.18,
  wishlist_add: 2.8,
  wishlist_remove: -2.2,
  record_wishlist_add: 2.8,
  record_wishlist_remove: -2.2,
  saved_add: 3.1,
  saved_remove: -2.5,
  dismiss: -4.2,
};

type CandidateTrack = Awaited<ReturnType<typeof db.query.tracks.findMany>>[number] & {
  release?: {
    labelId?: number | null;
    wishlist?: boolean | null;
    listened?: boolean | null;
    year?: number | null;
    label?: { active?: boolean | null; name?: string | null } | null;
  } | null;
  score?: number;
  reason?: string;
};

export type ExternalRecommendation = {
  releaseId: number;
  title: string;
  artist: string;
  labelName: string | null;
  year: number | null;
  catno: string | null;
  thumbUrl: string | null;
  discogsUrl: string;
  score: number;
  reason: string;
};

type ReleaseSignalInput = {
  releaseId: number;
  primaryArtist?: string | null;
  styles?: string[];
  genres?: string[];
  contributors?: string[];
  companies?: string[];
  formats?: string[];
  country?: string | null;
  year?: number | null;
};

function normalizeToken(raw: string) {
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[|]/g, " ")
    .trim();
}

function uniqTokens(values: Array<string | null | undefined>, max = 120) {
  const next = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const token = normalizeToken(value);
    if (!token) continue;
    next.add(token);
    if (next.size >= max) break;
  }
  return [...next];
}

function encodeTokens(values: Array<string | null | undefined>) {
  return uniqTokens(values).join("|");
}

function decodeTokens(raw: string | null | undefined) {
  if (!raw) return [];
  return raw
    .split("|")
    .map((part) => normalizeToken(part))
    .filter(Boolean);
}

function chunkValues<T>(values: T[], size = 800) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function deterministicNoise(seed: number) {
  const next = Math.sin(seed * 12.9898) * 43758.5453;
  return next - Math.floor(next);
}

function diversifyRecommendations<T extends { id: number; releaseId?: number; release?: { labelId?: number | null } | null }>(
  rows: T[],
  limit: number,
) {
  const selected: T[] = [];
  const selectedIds = new Set<number>();
  const labelCounts = new Map<number, number>();
  const releaseCounts = new Map<number, number>();
  let labelCap = 2;
  let releaseCap = 1;

  while (selected.length < limit && labelCap <= 6) {
    let addedThisPass = 0;
    for (const row of rows) {
      if (selectedIds.has(row.id)) continue;
      const labelId = row.release?.labelId;
      if (typeof labelId === "number" && (labelCounts.get(labelId) ?? 0) >= labelCap) continue;
      if (typeof row.releaseId === "number" && (releaseCounts.get(row.releaseId) ?? 0) >= releaseCap) continue;
      selected.push(row);
      selectedIds.add(row.id);
      if (typeof labelId === "number") {
        labelCounts.set(labelId, (labelCounts.get(labelId) ?? 0) + 1);
      }
      if (typeof row.releaseId === "number") {
        releaseCounts.set(row.releaseId, (releaseCounts.get(row.releaseId) ?? 0) + 1);
      }
      addedThisPass += 1;
      if (selected.length >= limit) break;
    }
    if (addedThisPass === 0) break;
    labelCap += 1;
    releaseCap = Math.min(2, releaseCap + 1);
  }

  if (selected.length < limit) {
    for (const row of rows) {
      if (selectedIds.has(row.id)) continue;
      selected.push(row);
      if (selected.length >= limit) break;
    }
  }

  return selected;
}

export async function logFeedbackEvent(input: {
  eventType:
    | keyof typeof EVENT_WEIGHTS
    | "played"
    | "listened"
    | "queued"
    | "wishlist_add"
    | "wishlist_remove"
    | "record_wishlist_add"
    | "record_wishlist_remove"
    | "saved_add"
    | "saved_remove"
    | "dismiss";
  eventValue?: number;
  source?: string;
  trackId?: number | null;
  releaseId?: number | null;
  labelId?: number | null;
  userId?: string | null;
}) {
  const userId = input.userId ?? (await requireCurrentAppUserId());
  const trackScope = eq(tracks.userId, userId);
  const releaseScope = eq(releases.userId, userId);
  const trackId = input.trackId ?? null;
  let releaseId = input.releaseId ?? null;
  let labelId = input.labelId ?? null;

  if (typeof trackId === "number" && (!releaseId || !labelId)) {
    const track = await db.query.tracks.findFirst({ where: and(eq(tracks.id, trackId), trackScope) });
    if (track?.releaseId && !releaseId) releaseId = track.releaseId;
  }
  if (typeof releaseId === "number" && !labelId) {
    const release = await db.query.releases.findFirst({ where: and(eq(releases.id, releaseId), releaseScope) });
    if (release?.labelId) labelId = release.labelId;
  }

  await db.insert(feedbackEvents).values({
    userId,
    trackId,
    releaseId,
    labelId,
    eventType: input.eventType,
    eventValue: input.eventValue ?? 1,
    source: input.source ?? "app",
    createdAt: new Date(),
  });
}

export async function upsertReleaseSignals(input: ReleaseSignalInput, userId?: string) {
  const scopedUserId = userId ?? (await requireCurrentAppUserId());
  await db
    .insert(releaseSignals)
    .values({
      releaseId: input.releaseId,
      userId: scopedUserId,
      primaryArtist: input.primaryArtist?.trim() || null,
      stylesText: encodeTokens(input.styles ?? []),
      genresText: encodeTokens(input.genres ?? []),
      contributorsText: encodeTokens(input.contributors ?? []),
      companiesText: encodeTokens(input.companies ?? []),
      formatText: encodeTokens(input.formats ?? []),
      country: input.country?.trim() || null,
      year: typeof input.year === "number" && Number.isFinite(input.year) ? input.year : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: releaseSignals.releaseId,
      set: {
        primaryArtist: input.primaryArtist?.trim() || null,
        stylesText: encodeTokens(input.styles ?? []),
        genresText: encodeTokens(input.genres ?? []),
        contributorsText: encodeTokens(input.contributors ?? []),
        companiesText: encodeTokens(input.companies ?? []),
        formatText: encodeTokens(input.formats ?? []),
        country: input.country?.trim() || null,
        year: typeof input.year === "number" && Number.isFinite(input.year) ? input.year : null,
        updatedAt: new Date(),
      },
    });
}

export async function buildDeepRecommendations(params: {
  candidateTracks: CandidateTrack[];
  listenedTracks: CandidateTrack[];
  playedQueueItems: Array<{ trackId: number | null; releaseId: number | null; labelId: number | null }>;
  limit?: number;
}) {
  const limit = Math.max(1, params.limit ?? 12);
  const activeCandidates = params.candidateTracks.filter((track) => track.release?.label?.active);
  if (activeCandidates.length === 0) return [];

  const candidateTrackIds = activeCandidates.map((track) => track.id);
  const candidateReleaseIds = [...new Set(activeCandidates.map((track) => track.releaseId))];

  const [pendingRows, playedRows, playableRows, eventRows] = await Promise.all([
    (async () => {
      const rows: Array<{ trackId: number | null }> = [];
      for (const chunk of chunkValues(candidateTrackIds)) {
        const chunkRows = await db
          .select({ trackId: queueItems.trackId })
          .from(queueItems)
          .where(and(inArray(queueItems.trackId, chunk), eq(queueItems.status, "pending")));
        rows.push(...chunkRows);
      }
      return rows;
    })(),
    (async () => {
      const rows: Array<{ trackId: number | null }> = [];
      for (const chunk of chunkValues(candidateTrackIds)) {
        const chunkRows = await db
          .select({ trackId: queueItems.trackId })
          .from(queueItems)
          .where(and(inArray(queueItems.trackId, chunk), eq(queueItems.status, "played")));
        rows.push(...chunkRows);
      }
      return rows;
    })(),
    (async () => {
      const rows: Array<{ trackId: number }> = [];
      for (const chunk of chunkValues(candidateTrackIds)) {
        const chunkRows = await db
          .select({ trackId: youtubeMatches.trackId })
          .from(youtubeMatches)
          .where(and(inArray(youtubeMatches.trackId, chunk), eq(youtubeMatches.chosen, true)));
        rows.push(...chunkRows);
      }
      return rows;
    })(),
    db.query.feedbackEvents.findMany({
      orderBy: [desc(feedbackEvents.id)],
      limit: 6000,
    }),
  ]);

  const pendingSet = new Set(pendingRows.map((row) => row.trackId).filter((item): item is number => typeof item === "number"));
  const playedSet = new Set(playedRows.map((row) => row.trackId).filter((item): item is number => typeof item === "number"));
  const playableSet = new Set(playableRows.map((row) => row.trackId).filter((item): item is number => typeof item === "number"));
  const dismissedSet = new Set(
    eventRows
      .filter((row) => row.eventType === "dismiss" && typeof row.trackId === "number")
      .map((row) => row.trackId as number),
  );

  const releasePreference = new Map<number, number>();
  const labelPreference = new Map<number, number>();

  for (const row of eventRows) {
    const base = EVENT_WEIGHTS[row.eventType] ?? 0;
    const value = base * row.eventValue;
    if (row.releaseId) {
      releasePreference.set(row.releaseId, (releasePreference.get(row.releaseId) ?? 0) + value);
    }
    if (row.labelId) {
      labelPreference.set(row.labelId, (labelPreference.get(row.labelId) ?? 0) + value);
    }
  }

  for (const track of params.listenedTracks) {
    const releaseId = track.releaseId;
    const labelId = track.release?.labelId;
    releasePreference.set(releaseId, (releasePreference.get(releaseId) ?? 0) + 1.35);
    if (labelId) labelPreference.set(labelId, (labelPreference.get(labelId) ?? 0) + 1.1);
  }

  for (const item of params.playedQueueItems) {
    if (item.releaseId) {
      releasePreference.set(item.releaseId, (releasePreference.get(item.releaseId) ?? 0) + 0.32);
    }
    if (item.labelId) {
      labelPreference.set(item.labelId, (labelPreference.get(item.labelId) ?? 0) + 0.25);
    }
  }

  const seedReleaseIds = [...releasePreference.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 300)
    .map(([releaseId]) => releaseId);
  const releaseIdsForSignals = [...new Set([...candidateReleaseIds, ...seedReleaseIds])];

  const signalsRows: Awaited<ReturnType<typeof db.query.releaseSignals.findMany>> = [];
  for (const chunk of chunkValues(releaseIdsForSignals)) {
    const chunkRows = await db.query.releaseSignals.findMany({
      where: inArray(releaseSignals.releaseId, chunk),
    });
    signalsRows.push(...chunkRows);
  }
  const signalByRelease = new Map(signalsRows.map((row) => [row.releaseId, row]));

  const tokenPreference = new Map<string, number>();
  const tokenFrequency = new Map<string, number>();
  let weightedYearTotal = 0;
  let weightedYearWeight = 0;

  for (const releaseId of seedReleaseIds) {
    const signal = signalByRelease.get(releaseId);
    if (!signal) continue;
    const releaseWeight = releasePreference.get(releaseId) ?? 0;
    if (releaseWeight <= 0) continue;

    const addTokens = (prefix: string, rawTokens: string[], weight: number) => {
      for (const token of rawTokens) {
        const key = `${prefix}:${token}`;
        tokenPreference.set(key, (tokenPreference.get(key) ?? 0) + releaseWeight * weight);
      }
    };

    addTokens("style", decodeTokens(signal.stylesText), 1.35);
    addTokens("genre", decodeTokens(signal.genresText), 1.05);
    addTokens("contrib", decodeTokens(signal.contributorsText), 1.75);
    addTokens("company", decodeTokens(signal.companiesText), 1.2);
    addTokens("format", decodeTokens(signal.formatText), 0.7);
    addTokens("artist", decodeTokens(signal.primaryArtist), 1.15);
    if (signal.country) addTokens("country", [signal.country], 0.6);
    if (typeof signal.year === "number" && Number.isFinite(signal.year)) {
      weightedYearTotal += signal.year * releaseWeight;
      weightedYearWeight += releaseWeight;
    }
  }

  for (const track of activeCandidates) {
    const signal = signalByRelease.get(track.releaseId);
    if (!signal) continue;
    const candidateKeys = [
      ...decodeTokens(signal.stylesText).map((item) => `style:${item}`),
      ...decodeTokens(signal.genresText).map((item) => `genre:${item}`),
      ...decodeTokens(signal.contributorsText).map((item) => `contrib:${item}`),
      ...decodeTokens(signal.companiesText).map((item) => `company:${item}`),
      ...decodeTokens(signal.formatText).map((item) => `format:${item}`),
      ...decodeTokens(signal.primaryArtist).map((item) => `artist:${item}`),
      ...(signal.country ? [`country:${normalizeToken(signal.country)}`] : []),
    ];
    for (const key of candidateKeys) {
      tokenFrequency.set(key, (tokenFrequency.get(key) ?? 0) + 1);
    }
  }

  const preferredYear = weightedYearWeight > 0 ? weightedYearTotal / weightedYearWeight : null;
  const playedByLabel = new Map<number, number>();
  for (const item of params.playedQueueItems) {
    if (!item.labelId) continue;
    playedByLabel.set(item.labelId, (playedByLabel.get(item.labelId) ?? 0) + 1);
  }

  const strictCandidates = activeCandidates.filter((track) => {
    if (track.listened) return false;
    if (track.saved) return false;
    if (track.release?.wishlist) return false;
    if (track.release?.listened) return false;
    if (pendingSet.has(track.id)) return false;
    if (playedSet.has(track.id)) return false;
    if (dismissedSet.has(track.id)) return false;
    return true;
  });

  const scored = strictCandidates
    .map((track) => {
      const labelId = track.release?.labelId ?? null;
      const releasePref = releasePreference.get(track.releaseId) ?? 0;
      const labelPref = labelId ? labelPreference.get(labelId) ?? 0 : 0;
      const intentScore = (track.saved ? 5 : 0) + (track.release?.wishlist ? 2.4 : 0);
      const playableBonus = playableSet.has(track.id) ? 0.9 : -0.7;
      const queuePenalty = 0;
      const replayPenalty = 0;
      const labelSaturationPenalty = labelId ? -Math.min(1.7, (playedByLabel.get(labelId) ?? 0) * 0.08) : 0;
      const releaseAffinityScore = Math.max(-2, Math.min(6, releasePref));
      const labelAffinityScore = Math.max(-2, Math.min(4.6, labelPref * 0.42));

      const signal = signalByRelease.get(track.releaseId);
      let graphScore = 0;
      let strongestGraphToken: string | null = null;
      let strongestGraphValue = 0;
      if (signal) {
        const addGraphScore = (prefix: string, rawTokens: string[]) => {
          for (const token of rawTokens) {
            const key = `${prefix}:${token}`;
            const preference = tokenPreference.get(key) ?? 0;
            if (preference <= 0) continue;
            const frequency = tokenFrequency.get(key) ?? 1;
            const rarity = 1 / Math.sqrt(frequency);
            const contribution = preference * rarity;
            graphScore += contribution;
            if (contribution > strongestGraphValue) {
              strongestGraphValue = contribution;
              strongestGraphToken = key;
            }
          }
        };
        addGraphScore("style", decodeTokens(signal.stylesText));
        addGraphScore("genre", decodeTokens(signal.genresText));
        addGraphScore("contrib", decodeTokens(signal.contributorsText));
        addGraphScore("company", decodeTokens(signal.companiesText));
        addGraphScore("format", decodeTokens(signal.formatText));
        addGraphScore("artist", decodeTokens(signal.primaryArtist));
        if (signal.country) addGraphScore("country", [normalizeToken(signal.country)]);
      }

      graphScore = Math.min(8.5, graphScore * 0.095);
      const strongestTokenFrequency =
        strongestGraphToken && tokenFrequency.has(strongestGraphToken)
          ? (tokenFrequency.get(strongestGraphToken) ?? 1)
          : Number.POSITIVE_INFINITY;
      const rarityBoost = Number.isFinite(strongestTokenFrequency) ? Math.max(0, 1.45 - Math.sqrt(strongestTokenFrequency) * 0.22) : 0;

      let yearScore = 0;
      if (preferredYear && typeof track.release?.year === "number") {
        const diff = Math.abs(track.release.year - preferredYear);
        yearScore = Math.max(0, 1.35 - diff / 16);
      }

      const score =
        intentScore +
        releaseAffinityScore +
        labelAffinityScore +
        graphScore +
        rarityBoost +
        yearScore +
        playableBonus +
        queuePenalty +
        replayPenalty +
        labelSaturationPenalty;

      const explorationScore =
        (playableSet.has(track.id) ? 0.75 : 0) +
        (!pendingSet.has(track.id) ? 0.6 : -0.5) +
        (!playedSet.has(track.id) ? 0.5 : -0.2) +
        (track.saved ? 1 : 0.15) +
        rarityBoost * 0.8 +
        deterministicNoise(track.id) * 0.35;

      let reason = "Matches your recent digging patterns.";
      if (strongestGraphToken && graphScore > Math.max(intentScore, releaseAffinityScore, labelAffinityScore) * 0.65) {
        const [prefix, raw] = String(strongestGraphToken).split(":");
        const label = prefix === "contrib" ? "contributor" : prefix;
        reason = `Connected by ${label}: ${raw}.`;
      } else if (intentScore >= 3) {
        reason = track.saved ? "Direct track save signal." : "Release-level wishlist signal.";
      } else if (labelAffinityScore > 1.2) {
        reason = "Strong label affinity from your listening history.";
      } else if (yearScore > 0.9 && preferredYear) {
        reason = `Close to your preferred era around ${Math.round(preferredYear)}.`;
      } else if (rarityBoost > 0.85) {
        reason = "Obscure deep-cut token match from your profile.";
      } else if (!playableSet.has(track.id)) {
        reason = "Relevant match, but playable source may need processing.";
      }

      return {
        ...track,
        score,
        reason,
        playable: playableSet.has(track.id),
        intentScore,
        graphScore,
        releaseAffinityScore,
        labelAffinityScore,
        explorationScore,
      };
    })
    .filter((track) => track.score > -3.5)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.graphScore !== a.graphScore) return b.graphScore - a.graphScore;
      if (b.intentScore !== a.intentScore) return b.intentScore - a.intentScore;
      return b.id - a.id;
    });

  const strong = scored.filter((item) => item.score > 0.35);
  const selected = diversifyRecommendations(strong, limit);

  if (selected.length < Math.min(limit, scored.length)) {
    const selectedIds = new Set(selected.map((item) => item.id));
    const fallback = scored
      .filter((item) => !selectedIds.has(item.id))
      .sort((a, b) => {
        const aFallback = a.explorationScore + a.score * 0.18;
        const bFallback = b.explorationScore + b.score * 0.18;
        if (bFallback !== aFallback) return bFallback - aFallback;
        return b.id - a.id;
      });
    for (const item of fallback) {
      selected.push(item);
      if (selected.length >= limit) break;
    }
  }

  return selected.map((item) => ({
    ...item,
    score: Number(item.score.toFixed(3)),
  }));
}

function addSeed(
  map: Map<string, { weight: number; reason: string }>,
  query: string,
  weight: number,
  reason: string,
) {
  const normalized = normalizeToken(query);
  if (!normalized || normalized.length < 2) return;
  const existing = map.get(normalized);
  if (existing) {
    map.set(normalized, {
      weight: existing.weight + weight,
      reason: existing.weight >= weight ? existing.reason : reason,
    });
    return;
  }
  map.set(normalized, { weight, reason });
}

function splitArtists(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(/[,&/;]| feat\.| ft\./i)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function buildExternalRecommendations(params: {
  candidateTracks: CandidateTrack[];
  listenedTracks: CandidateTrack[];
  activeLabels: Array<{ id: number; name: string }>;
  existingReleaseIds: number[];
  existingLabelNames: string[];
  limit?: number;
}) {
  const limit = Math.max(1, params.limit ?? 12);
  const existingReleaseSet = new Set(params.existingReleaseIds);
  const existingLabelSet = new Set(params.existingLabelNames.map((item) => normalizeToken(item)));

  const recentFeedback = await db.query.feedbackEvents.findMany({
    orderBy: [desc(feedbackEvents.id)],
    limit: 4500,
    columns: { eventType: true, releaseId: true },
  });
  const dismissedReleaseSet = new Set(
    recentFeedback
      .filter((row) => row.eventType === "dismiss" && typeof row.releaseId === "number")
      .map((row) => row.releaseId as number),
  );

  const seedMap = new Map<string, { weight: number; reason: string }>();
  const styleCounts = new Map<string, number>();
  const artistCounts = new Map<string, number>();
  const releaseIdsForSignals = [...new Set(params.listenedTracks.map((track) => track.releaseId))].slice(0, 1000);
  const signalRows: Awaited<ReturnType<typeof db.query.releaseSignals.findMany>> = [];
  for (const chunk of chunkValues(releaseIdsForSignals, 300)) {
    const rows = await db.query.releaseSignals.findMany({ where: inArray(releaseSignals.releaseId, chunk) });
    signalRows.push(...rows);
  }
  for (const row of signalRows) {
    for (const style of decodeTokens(row.stylesText)) {
      styleCounts.set(style, (styleCounts.get(style) ?? 0) + 1);
    }
  }
  for (const track of params.listenedTracks) {
    for (const artist of splitArtists(track.artistsText)) {
      const token = normalizeToken(artist);
      if (!token) continue;
      artistCounts.set(token, (artistCounts.get(token) ?? 0) + 1);
    }
  }

  for (const label of params.activeLabels.slice(0, 8)) {
    addSeed(seedMap, label.name, 1.8, `Adjacent to active label ${label.name}.`);
  }
  for (const [style, count] of [...styleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    addSeed(seedMap, style, Math.min(2.7, 0.65 + count * 0.18), `Profile style signal: ${style}.`);
  }
  for (const [artist, count] of [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    addSeed(seedMap, artist, Math.min(2.2, 0.55 + count * 0.24), `Artist adjacency from your listening graph.`);
  }

  const seeds = [...seedMap.entries()]
    .map(([query, meta]) => ({ query, weight: meta.weight, reason: meta.reason }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 7);
  if (seeds.length === 0) return [];

  const rows = await Promise.all(
    seeds.map(async (seed) => ({
      seed,
      results: await searchDiscogsReleases(seed.query, 1, 18),
    })),
  );

  const candidateByRelease = new Map<number, ExternalRecommendation & { _score: number }>();
  for (const row of rows) {
    for (const result of row.results) {
      if (existingReleaseSet.has(result.releaseId)) continue;
      if (dismissedReleaseSet.has(result.releaseId)) continue;

      const normalizedLabels = result.labelNames.map((item) => normalizeToken(item));
      const firstNewLabel = result.labelNames.find((item) => !existingLabelSet.has(normalizeToken(item))) ?? result.labelNames[0] ?? null;
      const hasNewLabel = normalizedLabels.some((item) => item && !existingLabelSet.has(item));
      if (!hasNewLabel) continue;

      let score = row.seed.weight;
      if (result.styles.length > 0) {
        const styleOverlap = result.styles.filter((item) => styleCounts.has(normalizeToken(item))).length;
        score += styleOverlap * 0.35;
      }
      if (result.artist && artistCounts.has(normalizeToken(result.artist))) {
        score += 0.55;
      }
      if (typeof result.year === "number") {
        score += Math.max(0, 0.9 - Math.abs(result.year - 2006) / 24);
      }
      score += deterministicNoise(result.releaseId) * 0.2;

      const existing = candidateByRelease.get(result.releaseId);
      if (!existing || score > existing._score) {
        candidateByRelease.set(result.releaseId, {
          releaseId: result.releaseId,
          title: result.title,
          artist: result.artist,
          labelName: firstNewLabel,
          year: result.year,
          catno: result.catno,
          thumbUrl: result.thumbUrl,
          discogsUrl: result.discogsUrl,
          score: Number(score.toFixed(3)),
          reason: row.seed.reason,
          _score: score,
        });
      }
    }
  }

  return [...candidateByRelease.values()]
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map((item) => ({
      releaseId: item.releaseId,
      title: item.title,
      artist: item.artist,
      labelName: item.labelName,
      year: item.year,
      catno: item.catno,
      thumbUrl: item.thumbUrl,
      discogsUrl: item.discogsUrl,
      score: item.score,
      reason: item.reason,
    }));
}
