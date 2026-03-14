import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { labels } from "@/db/schema";
import { searchDiscogsArtists, searchDiscogsLabels } from "@/lib/discogs";
import { detectDiscogsSourceKindFromInput, parseArtistIdFromInput, parseLabelIdFromInput } from "@/lib/discogs-input";
import { toExternalDiscogsId } from "@/lib/discogs-id";
import { resolveSourceDisplayName } from "@/lib/source-display";
import { resolveNumericSourceIdentity } from "@/lib/source-identity";
import { upsertAndWarmSourceForUser } from "@/lib/source-bootstrap";

function normalizeForFuzzy(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(\d+\)\s*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isSubsequence(needle: string, haystack: string) {
  if (!needle) return true;
  let idx = 0;
  for (const ch of haystack) {
    if (ch === needle[idx]) idx += 1;
    if (idx >= needle.length) return true;
  }
  return false;
}

function scoreSourceName(query: string, candidate: string) {
  const q = normalizeForFuzzy(query);
  const c = normalizeForFuzzy(candidate);
  if (!q || !c) return 0;
  if (q === c) return 120;
  if (c.startsWith(q)) return 102;
  if (q.startsWith(c) && c.length >= 4) return 95;
  if (c.includes(q)) return 88;

  const qTokens = new Set(q.split(" ").filter(Boolean));
  const cTokens = new Set(c.split(" ").filter(Boolean));
  let overlap = 0;
  for (const token of qTokens) {
    if (cTokens.has(token)) overlap += 1;
  }
  const tokenScore = qTokens.size > 0 ? Math.round((overlap / qTokens.size) * 70) : 0;
  const subseqScore = isSubsequence(q.replace(/\s+/g, ""), c.replace(/\s+/g, "")) ? 18 : 0;
  return tokenScore + subseqScore;
}

type LocalSourceCandidate = { id: number; title: string; score: number };

async function findBestLocalSourceCandidate(
  userId: string,
  query: string,
  kind: "label" | "artist",
): Promise<LocalSourceCandidate | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const knownSources = await db.query.labels.findMany({
    where: and(eq(labels.userId, userId), eq(labels.entityKind, kind)),
    columns: { id: true, name: true, externalDiscogsId: true },
  });

  const candidates = knownSources
    .map((source) => ({
      id: source.externalDiscogsId ?? toExternalDiscogsId(source.id),
      title: source.name,
      score: scoreSourceName(q, source.name),
    }))
    .filter((item) => item.id > 0 && item.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = candidates[0];
  const second = candidates[1];
  if (!top || top.score < 64) return null;
  if (second && top.score - second.score < 4) return null;
  return top;
}

function chooseBestDiscogsSearchResult(
  query: string,
  results: Array<{ id: number; title: string }>,
): { id: number; title: string } | null {
  const ranked = results
    .map((item) => ({ ...item, score: scoreSourceName(query, item.title) }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top) return null;
  return { id: top.id, title: top.title };
}

async function resolveBestSourceCandidate(userId: string, query: string) {
  const [bestLabel, bestArtist] = await Promise.all([
    findBestLocalSourceCandidate(userId, query, "label"),
    findBestLocalSourceCandidate(userId, query, "artist"),
  ]);

  if (bestLabel && bestArtist) {
    return bestArtist.score > bestLabel.score
      ? { kind: "artist" as const, candidate: bestArtist }
      : { kind: "label" as const, candidate: bestLabel };
  }
  if (bestLabel) return { kind: "label" as const, candidate: bestLabel };
  if (bestArtist) return { kind: "artist" as const, candidate: bestArtist };

  const [labelSearch, artistSearch] = await Promise.all([
    searchDiscogsLabels(query).catch(() => ({ results: [] as Array<{ id: number; title: string }> })),
    searchDiscogsArtists(query).catch(() => ({ results: [] as Array<{ id: number; title: string }> })),
  ]);

  const ranked = [
    ...labelSearch.results.slice(0, 6).map((item) => ({ kind: "label" as const, id: item.id, title: item.title, score: scoreSourceName(query, item.title) })),
    ...artistSearch.results.slice(0, 6).map((item) => ({ kind: "artist" as const, id: item.id, title: item.title, score: scoreSourceName(query, item.title) })),
  ]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (!top) return null;
  return { kind: top.kind, candidate: { id: top.id, title: top.title, score: top.score } };
}

export async function addSourceForUser(input: {
  userId: string;
  raw: string;
  requestedKind?: "label" | "artist" | null;
}) {
  const raw = input.raw.trim();
  if (!raw) {
    throw new Error("Source is required.");
  }

  const explicitKind = detectDiscogsSourceKindFromInput(raw);
  const parsedArtistId = parseArtistIdFromInput(raw);
  const parsedLabelId = parseLabelIdFromInput(raw);

  let entityKind: "label" | "artist" =
    input.requestedKind ??
    (explicitKind === "artist" ? "artist" : "label");
  let id = entityKind === "artist" ? parsedArtistId : parsedLabelId;
  let name = raw;

  if (!id && !input.requestedKind && /^\d+$/.test(raw)) {
    const numericId = Number(raw);
    const existingByExternalId = await db.query.labels.findMany({
      where: and(eq(labels.userId, input.userId), eq(labels.externalDiscogsId, numericId)),
      columns: { entityKind: true, name: true },
    });
    const resolvedIdentity = resolveNumericSourceIdentity(existingByExternalId);
    if (resolvedIdentity === "ambiguous") {
      throw new Error("Numeric Discogs IDs can match both a label and an artist. Paste the Discogs URL or choose a source type.");
    }
    if (resolvedIdentity) {
      entityKind = resolvedIdentity.entityKind;
      id = numericId;
      name = resolvedIdentity.name;
    }
  }

  if (!id) {
    if (!input.requestedKind) {
      const best = await resolveBestSourceCandidate(input.userId, raw);
      if (!best) throw new Error("No source found from search.");
      entityKind = best.kind;
      id = best.candidate.id;
      name = best.candidate.title;
    } else {
      const cachedMatch = await findBestLocalSourceCandidate(input.userId, raw, entityKind);
      if (cachedMatch) {
        id = cachedMatch.id;
        name = cachedMatch.title;
      } else {
        const search = entityKind === "artist" ? await searchDiscogsArtists(raw) : await searchDiscogsLabels(raw);
        const best = chooseBestDiscogsSearchResult(raw, search.results);
        if (!best) throw new Error(`No ${entityKind} found from search.`);
        id = best.id;
        name = best.title;
      }
    }
  }

  if (/^https?:\/\//i.test(name)) {
    name = resolveSourceDisplayName({
      name,
      discogsUrl: name,
      kind: entityKind,
      externalDiscogsId: id,
    });
  }

  const sourceId = await upsertAndWarmSourceForUser({
    userId: input.userId,
    kind: entityKind,
    externalDiscogsId: id,
    fallbackName: name,
    active: true,
    sourceType: "workspace",
  });

  return {
    sourceId,
    entityKind,
    externalDiscogsId: id,
    name,
  };
}
