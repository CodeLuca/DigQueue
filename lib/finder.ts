import { and, eq, gt } from "drizzle-orm";
import { apiCache, releases } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { toDiscogsWebUrl } from "@/lib/discogs-links";

type LinkConfidence = "high" | "medium" | "low";

type FinderCandidate = {
  provider: "bandcamp" | "juno" | "hardwax" | "phonica" | "discogs";
  url: string;
  title: string;
  confidence: LinkConfidence;
  score: number;
  reason: string;
};

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function overlapScore(query: string, text: string) {
  const q = new Set(tokenize(query));
  const t = new Set(tokenize(text));
  let overlap = 0;
  for (const token of q) {
    if (t.has(token)) overlap += 1;
  }
  return overlap;
}

function decodeHtmlEntities(input: string) {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

async function fromCache<T>(key: string, userId: string): Promise<T | null> {
  const row = await db.query.apiCache.findFirst({
    where: and(eq(apiCache.key, key), eq(apiCache.userId, userId), gt(apiCache.expiresAt, new Date())),
  });
  if (!row) return null;
  return JSON.parse(row.responseJson) as T;
}

async function setCache(key: string, data: unknown, ttlSeconds: number, userId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  await db
    .insert(apiCache)
    .values({ key, userId, responseJson: JSON.stringify(data), fetchedAt: now, expiresAt })
    .onConflictDoUpdate({ target: apiCache.key, set: { responseJson: JSON.stringify(data), fetchedAt: now, expiresAt } });
}

async function searchBandcamp(query: string, userId: string) {
  const key = `finder:${userId}:bandcamp:${query.toLowerCase()}`;
  const cached = await fromCache<FinderCandidate[]>(key, userId);
  if (cached) return cached;

  const searchUrl = `https://bandcamp.com/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, { next: { revalidate: 0 } });
  if (!response.ok) return [];

  const html = await response.text();
  const blocks = html.match(/<li class="searchresult data-search"[\s\S]*?<\/li>/g) ?? [];

  const candidates: FinderCandidate[] = [];
  for (const block of blocks.slice(0, 12)) {
    const urlMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>/i);
    const titleMatch = block.match(/<div class="heading">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const subheadMatch = block.match(/<div class="subhead">([\s\S]*?)<\/div>/i);
    if (!urlMatch || !titleMatch) continue;

    const url = decodeHtmlEntities(urlMatch[1].trim());
    const rawTitle = decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, " ").trim());
    const subhead = subheadMatch ? decodeHtmlEntities(subheadMatch[1].replace(/<[^>]+>/g, " ").trim()) : "";

    const score = overlapScore(query, `${rawTitle} ${subhead}`);
    candidates.push({
      provider: "bandcamp",
      url,
      title: rawTitle,
      confidence: score >= 6 ? "high" : score >= 3 ? "medium" : "low",
      score,
      reason: `Bandcamp search token overlap ${score}`,
    });
  }

  const ranked = candidates.sort((a, b) => b.score - a.score).slice(0, 6);
  await setCache(key, ranked, 60 * 60 * 24 * 3, userId);
  return ranked;
}

export async function findReleaseLinks(releaseId: number) {
  const userId = await requireCurrentAppUserId();
  const release = await db.query.releases.findFirst({
    where: and(eq(releases.id, releaseId), eq(releases.userId, userId)),
    with: { label: true },
  });
  if (!release) throw new Error("Release not found.");

  const baseQuery = `${release.artist} ${release.title}`.trim();
  const catnoQuery = `${release.label?.name ?? ""} ${release.catno ?? ""}`.trim();
  const queryVariants = [baseQuery, `${baseQuery} ${release.catno ?? ""}`.trim(), catnoQuery].filter(Boolean);

  const bandcampResults = (await Promise.all(queryVariants.map((query) => searchBandcamp(query, userId)))).flat();
  const dedupedBandcamp = new Map<string, FinderCandidate>();
  for (const item of bandcampResults) {
    const existing = dedupedBandcamp.get(item.url);
    if (!existing || item.score > existing.score) {
      dedupedBandcamp.set(item.url, item);
    }
  }

  const rankedBandcamp = [...dedupedBandcamp.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item, index) => ({
      ...item,
      confidence: index === 0 && item.score >= 6 ? "high" : item.confidence,
    }));

  const fallbackProviders: FinderCandidate[] = [
    {
      provider: "discogs",
      url: toDiscogsWebUrl(release.discogsUrl, `/release/${release.id}`),
      title: "Open on Discogs",
      confidence: "high",
      score: 100,
      reason: "Authoritative source record",
    },
    {
      provider: "juno",
      url: `https://www.juno.co.uk/search/?q[all][]=${encodeURIComponent(baseQuery)}`,
      title: "Search on Juno",
      confidence: "medium",
      score: 50,
      reason: "Store fallback",
    },
    {
      provider: "hardwax",
      url: `https://www.hardwax.com/?search=${encodeURIComponent(baseQuery)}`,
      title: "Search on Hardwax",
      confidence: "medium",
      score: 45,
      reason: "Store fallback",
    },
    {
      provider: "phonica",
      url: `https://www.phonicarecords.com/search?search=${encodeURIComponent(baseQuery)}`,
      title: "Search on Phonica",
      confidence: "medium",
      score: 45,
      reason: "Store fallback",
    },
  ];

  return {
    release: {
      id: release.id,
      title: release.title,
      artist: release.artist,
      label: release.label?.name,
      catno: release.catno,
    },
    bandcamp: rankedBandcamp,
    fallback: fallbackProviders,
    bestBandcamp: rankedBandcamp[0] ?? null,
  };
}
