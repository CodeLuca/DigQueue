import { and, eq, gt } from "drizzle-orm";
import { apiCache } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { getApiKeys } from "@/lib/api-keys";
import { db } from "@/lib/db";
import { parseDiscogsStoredAuth } from "@/lib/discogs-auth";
import { toExternalDiscogsId } from "@/lib/discogs-id";
import { env } from "@/lib/env";
import { buildDiscogsOAuthApiAuthorizationHeader, discogsUserAgent } from "@/lib/discogs-oauth";

let lastDiscogsCall = 0;
let discogsQueue: Promise<void> = Promise.resolve();

const DISCOGS_API = "https://api.discogs.com";
const DISCOGS_MIN_CALL_GAP_MS = 1200;
const DISCOGS_MAX_RETRIES = 4;

export function parseLabelIdFromInput(input: string): number | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const match = trimmed.match(/\/label\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function scheduleDiscogsCall<T>(task: () => Promise<T>) {
  const run = discogsQueue.then(async () => {
    const now = Date.now();
    const gap = now - lastDiscogsCall;
    const wait = Math.max(0, DISCOGS_MIN_CALL_GAP_MS - gap);
    if (wait > 0) await sleep(wait);
    try {
      return await task();
    } finally {
      lastDiscogsCall = Date.now();
    }
  });
  discogsQueue = run.then(() => undefined, () => undefined);
  return run;
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
    .onConflictDoUpdate({
      target: apiCache.key,
      set: { responseJson: JSON.stringify(data), fetchedAt: now, expiresAt },
    });
}

async function getDiscogsAuth() {
  const keys = await getApiKeys();
  const stored = parseDiscogsStoredAuth(keys.discogsToken);
  if (stored) return stored;
  if (env.DISCOGS_TOKEN) return { kind: "personal" as const, token: env.DISCOGS_TOKEN };
  throw new Error("Discogs is not connected.");
}

function getDiscogsAuthHeaders(
  auth: Awaited<ReturnType<typeof getDiscogsAuth>>,
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
) {
  if (auth.kind === "oauth") {
    return {
      Authorization: buildDiscogsOAuthApiAuthorizationHeader({
        method,
        url,
        token: auth.token,
        tokenSecret: auth.tokenSecret,
      }),
      "User-Agent": discogsUserAgent,
    };
  }
  return {
    Authorization: `Discogs token=${auth.token}`,
    "User-Agent": discogsUserAgent,
  };
}

export async function discogsRequest<T>(path: string, cacheTtl = 60 * 60 * 24): Promise<T> {
  const userId = await requireCurrentAppUserId();
  const key = `discogs:${userId}:${path}`;
  if (cacheTtl > 0) {
    const cached = await fromCache<T>(key, userId);
    if (cached) return cached;
  }

  const discogsAuth = await getDiscogsAuth();

  let attempt = 0;
  while (attempt < DISCOGS_MAX_RETRIES) {
    const response = await scheduleDiscogsCall(() => fetch(`${DISCOGS_API}${path}`, {
      headers: {
        ...getDiscogsAuthHeaders(discogsAuth, "GET", `${DISCOGS_API}${path}`),
      },
      next: { revalidate: 0 },
    }));

    if (response.ok) {
      const json = (await response.json()) as T;
      if (cacheTtl > 0) {
        await setCache(key, json, cacheTtl, userId);
      }
      return json;
    }

    if (response.status === 429) {
      attempt += 1;
      await sleep(1250 * 2 ** attempt);
      continue;
    }

    const body = await response.text();
    throw new Error(`Discogs error ${response.status}: ${body}`);
  }

  throw new Error("Discogs rate limit retries exhausted.");
}

type DiscogsIdentity = { username: string };

export async function fetchDiscogsIdentity() {
  return discogsRequest<DiscogsIdentity>("/oauth/identity", 60 * 60 * 24);
}

export async function setDiscogsReleaseWishlist(releaseId: number, enabled: boolean) {
  const externalReleaseId = toExternalDiscogsId(releaseId);
  const discogsAuth = await getDiscogsAuth();
  const identity = await fetchDiscogsIdentity();
  const method = enabled ? "PUT" : "DELETE";
  let attempt = 0;
  while (attempt < DISCOGS_MAX_RETRIES) {
    const response = await scheduleDiscogsCall(() =>
      fetch(`${DISCOGS_API}/users/${encodeURIComponent(identity.username)}/wants/${externalReleaseId}`, {
        method,
        headers: {
          ...getDiscogsAuthHeaders(
            discogsAuth,
            method,
            `${DISCOGS_API}/users/${encodeURIComponent(identity.username)}/wants/${externalReleaseId}`,
          ),
        },
        next: { revalidate: 0 },
      }),
    );

    if (response.ok || response.status === 404) return;

    if (response.status === 429 || response.status >= 500) {
      attempt += 1;
      await sleep(1250 * 2 ** attempt);
      continue;
    }

    const body = await response.text();
    throw new Error(`Discogs wishlist sync failed (${response.status}): ${body}`);
  }

  throw new Error("Discogs wishlist sync rate-limited. Retries exhausted.");
}

type DiscogsWantsResponse = {
  pagination?: { page?: number; pages?: number; per_page?: number; items?: number };
  wants?: Array<{
    id?: number;
    basic_information?: {
      id?: number;
      title?: string;
      thumb?: string;
      artists?: Array<{ name?: string }>;
      labels?: Array<{ id?: number; name?: string; catno?: string; resource_url?: string }>;
      resource_url?: string;
    };
  }>;
};

export type DiscogsWantItem = {
  releaseId: number;
  title: string;
  artist: string;
  thumbUrl: string | null;
  catno: string | null;
  discogsUrl: string;
  labelId: number | null;
  labelName: string | null;
};

export async function fetchDiscogsWantItems() {
  const identity = await fetchDiscogsIdentity();
  const items = new Map<number, DiscogsWantItem>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 120) {
    const params = new URLSearchParams({ page: String(page), per_page: "100" });
    const response = await discogsRequest<DiscogsWantsResponse>(
      `/users/${encodeURIComponent(identity.username)}/wants?${params.toString()}`,
      0,
    );

    for (const item of response.wants ?? []) {
      const id = item.id ?? item.basic_information?.id;
      if (typeof id === "number" && Number.isFinite(id) && id > 0) {
        const rawTitle = item.basic_information?.title?.trim() || `Release ${id}`;
        const firstArtist = item.basic_information?.artists?.[0]?.name?.trim() || "";
        const titleParts = rawTitle.split(" - ");
        const artist = firstArtist || (titleParts.length > 1 ? titleParts[0] : "Unknown Artist");
        const title = titleParts.length > 1 ? titleParts.slice(1).join(" - ") : rawTitle;
        const resourceUrl = item.basic_information?.resource_url?.trim();
        const discogsUrl = resourceUrl && /\/releases\/\d+/i.test(resourceUrl)
          ? resourceUrl.replace("api.discogs.com", "www.discogs.com")
          : `https://www.discogs.com/release/${id}`;

        items.set(id, {
          releaseId: id,
          title,
          artist,
          thumbUrl: item.basic_information?.thumb?.trim() || null,
          catno: item.basic_information?.labels?.[0]?.catno?.trim() || null,
          discogsUrl,
          labelId: item.basic_information?.labels?.[0]?.id ?? null,
          labelName: item.basic_information?.labels?.[0]?.name?.trim() || null,
        });
      }
    }

    const apiPages = response.pagination?.pages;
    totalPages = typeof apiPages === "number" && apiPages > 0 ? apiPages : page;
    page += 1;
  }

  return [...items.values()];
}

export async function fetchDiscogsWantReleaseIds() {
  const items = await fetchDiscogsWantItems();
  return items.map((item) => item.releaseId);
}

type DiscogsLabelRelease = {
  id: number;
  title: string;
  artist: string;
  year: number;
  catno: string;
  resource_url: string;
  thumb: string;
};

type DiscogsLabelReleasesResponse = {
  pagination: { page: number; pages: number; per_page: number; items: number };
  releases: DiscogsLabelRelease[];
};

export async function fetchDiscogsLabelReleases(labelId: number, page = 1, perPage = 100) {
  const externalLabelId = toExternalDiscogsId(labelId);
  return discogsRequest<DiscogsLabelReleasesResponse>(
    `/labels/${externalLabelId}/releases?page=${page}&per_page=${perPage}`,
    60 * 60 * 6,
  );
}

type DiscogsLabelProfileResponse = {
  id: number;
  name?: string;
  profile?: string;
  images?: Array<{
    uri?: string;
    uri150?: string;
  }>;
};

function cleanDiscogsProfile(profile?: string | null) {
  if (!profile) return null;
  return profile
    .replace(/\[(?:a|l|r|url|m)=([^\]]+)\]/gi, "$1")
    .replace(/\[\/(?:a|l|r|url|m)\]/gi, "")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 360);
}

export async function fetchDiscogsLabelProfile(labelId: number) {
  const externalLabelId = toExternalDiscogsId(labelId);
  const profile = await discogsRequest<DiscogsLabelProfileResponse>(`/labels/${externalLabelId}`, 60 * 60 * 24 * 14);
  const image = profile.images?.[0];
  return {
    blurb: cleanDiscogsProfile(profile.profile),
    imageUrl: image?.uri150 || image?.uri || null,
  };
}

export type DiscogsRelease = {
  id: number;
  title: string;
  tracklist: Array<{ position: string; title: string; duration?: string; artists?: Array<{ name: string }> }>;
  artists_sort?: string;
  artists?: Array<{ name?: string }>;
  styles?: string[];
  genres?: string[];
  country?: string;
  year?: number;
  extraartists?: Array<{ name?: string; role?: string }>;
  companies?: Array<{ name?: string }>;
  formats?: Array<{ name?: string; descriptions?: string[] }>;
  uri: string;
  labels?: Array<{ id?: number; name?: string; catno?: string; resource_url?: string }>;
  videos?: Array<{ uri?: string; title?: string }>;
  images?: Array<{ uri?: string; uri150?: string }>;
  community?: {
    want?: number;
    have?: number;
    rating?: {
      average?: number;
      count?: number;
    };
  };
};

export type DiscogsReleaseMarketStats = {
  lowest_price?: number | null;
  median_price?: number | null;
  num_for_sale?: number;
  blocked_from_sale?: boolean;
  currency?: string;
};

export async function fetchDiscogsRelease(releaseId: number) {
  const externalReleaseId = toExternalDiscogsId(releaseId);
  return discogsRequest<DiscogsRelease>(`/releases/${externalReleaseId}`, 60 * 60 * 24 * 14);
}

export async function fetchDiscogsReleaseMarketStats(releaseId: number) {
  const externalReleaseId = toExternalDiscogsId(releaseId);
  return discogsRequest<DiscogsReleaseMarketStats>(`/marketplace/stats/${externalReleaseId}`, 60 * 60 * 12);
}

export function extractYoutubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("youtu.be")) {
      const id = parsed.pathname.replace(/^\/+/, "").split("/")[0];
      return id || null;
    }
    if (host.includes("youtube.com")) {
      const watchId = parsed.searchParams.get("v");
      if (watchId) return watchId;
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const embedIndex = pathParts.findIndex((part) => part === "embed");
      if (embedIndex >= 0 && pathParts[embedIndex + 1]) return pathParts[embedIndex + 1];
      const shortsIndex = pathParts.findIndex((part) => part === "shorts");
      if (shortsIndex >= 0 && pathParts[shortsIndex + 1]) return pathParts[shortsIndex + 1];
    }
  } catch {
    return null;
  }

  return null;
}

export async function getFirstDiscogsReleaseYoutubeVideoId(releaseId: number) {
  const release = await fetchDiscogsRelease(releaseId);
  for (const video of release.videos || []) {
    const uri = video.uri?.trim();
    if (!uri) continue;
    const id = extractYoutubeVideoId(uri);
    if (id) return { videoId: id, title: video.title || "Discogs release video" };
  }
  return null;
}

export async function searchDiscogsLabels(query: string) {
  const params = new URLSearchParams({ q: query, type: "label", per_page: "8" });
  return discogsRequest<{ results: Array<{ id: number; title: string; uri: string }> }>(
    `/database/search?${params.toString()}`,
    60 * 60 * 6,
  );
}

type DiscogsReleaseSearchResult = {
  id?: number;
  type?: string;
  title?: string;
  year?: number;
  country?: string;
  thumb?: string;
  cover_image?: string;
  uri?: string;
  resource_url?: string;
  label?: string[];
  style?: string[];
  genre?: string[];
  catno?: string;
};

export type DiscogsReleaseSearchItem = {
  releaseId: number;
  title: string;
  artist: string;
  year: number | null;
  country: string | null;
  thumbUrl: string | null;
  discogsUrl: string;
  labelNames: string[];
  styles: string[];
  genres: string[];
  catno: string | null;
};

function parseReleaseIdFromResult(result: DiscogsReleaseSearchResult) {
  if (typeof result.id === "number" && Number.isFinite(result.id) && result.id > 0) return result.id;
  const fromUri = result.uri?.match(/\/release\/(\d+)/i)?.[1] || result.resource_url?.match(/\/releases\/(\d+)/i)?.[1];
  if (!fromUri) return null;
  const parsed = Number(fromUri);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function searchDiscogsReleases(query: string, page = 1, perPage = 25) {
  const params = new URLSearchParams({
    q: query,
    type: "release",
    page: String(Math.max(1, page)),
    per_page: String(Math.max(1, Math.min(100, perPage))),
  });

  const response = await discogsRequest<{
    results?: DiscogsReleaseSearchResult[];
  }>(`/database/search?${params.toString()}`, 60 * 60 * 6);

  const items: DiscogsReleaseSearchItem[] = [];
  for (const result of response.results ?? []) {
    if (result.type && result.type !== "release" && result.type !== "master") continue;
    const releaseId = parseReleaseIdFromResult(result);
    if (!releaseId) continue;

    const rawTitle = result.title?.trim() || `Release ${releaseId}`;
    const titleParts = rawTitle.split(" - ");
    const artist = titleParts.length > 1 ? titleParts[0].trim() : "Unknown Artist";
    const title = titleParts.length > 1 ? titleParts.slice(1).join(" - ").trim() : rawTitle;
    const discogsUrl = result.uri?.trim()
      ? `https://www.discogs.com${result.uri.trim()}`
      : `https://www.discogs.com/release/${releaseId}`;

    items.push({
      releaseId,
      title,
      artist,
      year: typeof result.year === "number" && Number.isFinite(result.year) ? result.year : null,
      country: result.country?.trim() || null,
      thumbUrl: result.thumb?.trim() || result.cover_image?.trim() || null,
      discogsUrl,
      labelNames: (result.label ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 3),
      styles: (result.style ?? []).map((item) => item.trim()).filter(Boolean),
      genres: (result.genre ?? []).map((item) => item.trim()).filter(Boolean),
      catno: result.catno?.trim() || null,
    });
  }

  return items;
}
