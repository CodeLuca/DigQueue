import { and, eq, gt } from "drizzle-orm";
import { apiCache } from "@/db/schema";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

type BandcampWishlistItem = {
  id: number;
  type: "album" | "track" | "unknown";
  title: string;
  bandName: string;
  url: string;
  artUrl: string | null;
  addedAt: string | null;
};

type BandcampWishlistResult = {
  enabled: boolean;
  sourceUrl: string | null;
  totalCount: number;
  items: BandcampWishlistItem[];
  fetchedAt: string | null;
  partial: boolean;
};

type WishlistPageData = {
  fan_id?: number;
  wishlist_data?: {
    item_count?: number;
    last_token?: string;
    sequence?: string[];
  };
  item_cache?: {
    wishlist?: Record<string, unknown>;
  };
};

type WishlistApiResponse = {
  items?: Array<Record<string, unknown>>;
  more_available?: boolean;
  last_token?: string;
  error?: boolean;
  error_message?: string;
};

const BANDCAMP_API = "https://bandcamp.com/api/fancollection/1/wishlist_items";
const BANDCAMP_CACHE_TTL_SECONDS = 60 * 60 * 6;
const BANDCAMP_PAGE_SIZE = 60;
const BANDCAMP_MAX_PAGES = 40;
const BANDCAMP_MIN_CALL_GAP_MS = 600;

let lastBandcampApiCall = 0;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWishlistUrl(raw: string | null | undefined) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    parsed.hash = "";
    parsed.search = "";
    let path = parsed.pathname.replace(/\/+$/, "");
    const isWishlistPath = path.endsWith("/wishlist");
    const isLegacyWantsPath = path.endsWith("/wants");
    if (!isWishlistPath && !isLegacyWantsPath) path = `${path}/wishlist`;
    parsed.pathname = path;
    return parsed.toString();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parsePagedataBlob(html: string): WishlistPageData | null {
  const match = html.match(/id="pagedata"[^>]*data-blob="([\s\S]*?)"><\/div>/);
  if (!match) return null;
  try {
    const decoded = decodeHtmlEntities(match[1]);
    return JSON.parse(decoded) as WishlistPageData;
  } catch {
    return null;
  }
}

function coerceNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function coerceString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function inferItemUrl(raw: Record<string, unknown>) {
  const direct = coerceString(raw.item_url || raw.tralbum_url || raw.band_url);
  if (direct) return direct;

  const hints = raw.url_hints as Record<string, unknown> | undefined;
  const subdomain = coerceString(hints?.subdomain);
  const itemTypeHint = coerceString(hints?.item_type);
  const slug = coerceString(hints?.slug);
  if (!subdomain || !slug) return "";
  const kind = itemTypeHint === "t" || itemTypeHint === "track" ? "track" : "album";
  return `https://${subdomain}.bandcamp.com/${kind}/${slug}`;
}

function normalizeWishlistItem(raw: Record<string, unknown>): BandcampWishlistItem | null {
  const id = coerceNumber(raw.item_id ?? raw.tralbum_id);
  if (!id) return null;

  const itemType = coerceString(raw.item_type || raw.tralbum_type).toLowerCase();
  const type: BandcampWishlistItem["type"] =
    itemType === "album" || itemType === "a"
      ? "album"
      : itemType === "track" || itemType === "t"
        ? "track"
        : "unknown";

  const title = coerceString(raw.item_title || raw.album_title || raw.featured_track_title) || `Item ${id}`;
  const bandName = coerceString(raw.band_name || raw.artist) || "Unknown artist";
  const url = inferItemUrl(raw);
  if (!url) return null;
  const artUrl = coerceString(raw.item_art_url) || null;
  const addedAt = coerceString(raw.added) || null;

  return { id, type, title, bandName, url, artUrl, addedAt };
}

async function fromCache<T>(key: string): Promise<T | null> {
  const row = await db.query.apiCache.findFirst({
    where: and(eq(apiCache.key, key), gt(apiCache.expiresAt, new Date())),
  });
  if (!row) return null;
  return JSON.parse(row.responseJson) as T;
}

async function setCache(key: string, data: unknown, ttlSeconds: number) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  await db
    .insert(apiCache)
    .values({ key, responseJson: JSON.stringify(data), fetchedAt: now, expiresAt })
    .onConflictDoUpdate({
      target: apiCache.key,
      set: { responseJson: JSON.stringify(data), fetchedAt: now, expiresAt },
    });
}

async function callBandcampWishlistApi(params: { fanId: number; olderThanToken: string | null; count: number }) {
  const now = Date.now();
  const waitMs = Math.max(0, BANDCAMP_MIN_CALL_GAP_MS - (now - lastBandcampApiCall));
  if (waitMs > 0) await sleep(waitMs);

  lastBandcampApiCall = Date.now();
  const response = await fetch(BANDCAMP_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fan_id: params.fanId,
      count: params.count,
      older_than_token: params.olderThanToken,
    }),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bandcamp wishlist fetch failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as WishlistApiResponse;
  if (data.error) {
    throw new Error(data.error_message || "Bandcamp wishlist API returned an error.");
  }
  return data;
}

export async function getBandcampWishlistData(): Promise<BandcampWishlistResult> {
  const sourceUrl = normalizeWishlistUrl(env.BANDCAMP_WISHLIST_URL);
  if (!sourceUrl) {
    return { enabled: false, sourceUrl: null, totalCount: 0, items: [], fetchedAt: null, partial: false };
  }

  const cacheKey = `bandcamp:wishlist:${sourceUrl.toLowerCase()}`;
  const cached = await fromCache<BandcampWishlistResult>(cacheKey);
  if (cached) return cached;

  try {
    const pageResponse = await fetch(sourceUrl, { next: { revalidate: 0 } });
    if (!pageResponse.ok) {
      throw new Error(`Unable to open Bandcamp wishlist page (${pageResponse.status}).`);
    }

    const html = await pageResponse.text();
    const pageData = parsePagedataBlob(html);
    const fanId = coerceNumber(pageData?.fan_id);
    const wishlistData = pageData?.wishlist_data;
    const cachedWishlistItems = pageData?.item_cache?.wishlist ?? {};

    if (!fanId || !wishlistData) {
      throw new Error("Bandcamp wishlist metadata not found on page.");
    }

    const totalCount = coerceNumber(wishlistData.item_count) ?? 0;
    let cursor = coerceString(wishlistData.last_token) || null;

    const items: BandcampWishlistItem[] = [];
    const seen = new Set<string>();
    const initialSequence = Array.isArray(wishlistData.sequence) ? wishlistData.sequence : [];

    for (const key of initialSequence) {
      const raw = cachedWishlistItems[key];
      if (!raw || typeof raw !== "object") continue;
      const normalized = normalizeWishlistItem(raw as Record<string, unknown>);
      if (!normalized || seen.has(normalized.url)) continue;
      seen.add(normalized.url);
      items.push(normalized);
    }

    let pagesFetched = 0;
    while (cursor && items.length < totalCount && pagesFetched < BANDCAMP_MAX_PAGES) {
      const nextPage = await callBandcampWishlistApi({ fanId, olderThanToken: cursor, count: BANDCAMP_PAGE_SIZE });
      pagesFetched += 1;

      for (const raw of nextPage.items ?? []) {
        const normalized = normalizeWishlistItem(raw);
        if (!normalized || seen.has(normalized.url)) continue;
        seen.add(normalized.url);
        items.push(normalized);
      }

      const nextToken = coerceString(nextPage.last_token) || null;
      const hasMore = Boolean(nextPage.more_available && nextToken);
      if (!hasMore || nextToken === cursor) break;
      cursor = nextToken;
    }

    const result: BandcampWishlistResult = {
      enabled: true,
      sourceUrl,
      totalCount: Math.max(totalCount, items.length),
      items,
      fetchedAt: new Date().toISOString(),
      partial: items.length < totalCount,
    };
    await setCache(cacheKey, result, BANDCAMP_CACHE_TTL_SECONDS);
    return result;
  } catch {
    return { enabled: true, sourceUrl, totalCount: 0, items: [], fetchedAt: null, partial: true };
  }
}
