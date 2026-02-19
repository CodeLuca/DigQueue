import { and, eq, gt } from "drizzle-orm";
import { apiCache } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { getApiKeys } from "@/lib/api-keys";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

type YoutubeSearchItem = {
  id: { videoId: string };
  snippet: { title: string; channelTitle: string };
};

const YOUTUBE_MIN_CALL_GAP_MS = 800;
const YOUTUBE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 3;
const YOUTUBE_QUOTA_BLOCK_TTL_SECONDS = 60 * 60 * 8;
const YOUTUBE_FATAL_BLOCK_TTL_SECONDS = 60 * 60 * 24;
const YOUTUBE_TRANSIENT_BLOCK_TTL_SECONDS = 60 * 15;
const YOUTUBE_MAX_RETRIES = 3;

let lastYoutubeCall = 0;
let youtubeQueue: Promise<void> = Promise.resolve();

type GoogleApiErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{ reason?: string; message?: string }>;
    details?: Array<{
      "@type"?: string;
      reason?: string;
      domain?: string;
      metadata?: Record<string, string>;
      message?: string;
    }>;
  };
};

export function buildYoutubeQuery(params: {
  primaryArtist?: string | null;
  trackTitle: string;
  labelName?: string | null;
  catno?: string | null;
}) {
  return `${params.primaryArtist ?? ""} - ${params.trackTitle} ${params.labelName ?? ""} ${params.catno ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreYoutubeMatch(query: string, title: string) {
  const qTokens = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  const tTokens = new Set(title.toLowerCase().split(/\W+/).filter(Boolean));

  let overlap = 0;
  for (const token of qTokens) {
    if (tTokens.has(token)) overlap += 1;
  }

  const penalty = title.toLowerCase().includes("full album") ? 2 : 0;
  return overlap - penalty;
}

export function isYoutubeFatalConfigError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("API_KEY_SERVICE_BLOCKED") ||
    message.includes("YouTube key blocked") ||
    message.includes("YouTube API key invalid")
  );
}

export function isYoutubeQuotaExceededError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("YouTube quota exceeded");
}

function parseYoutubeError(status: number, rawBody: string) {
  let parsed: GoogleApiErrorBody | null = null;
  try {
    parsed = JSON.parse(rawBody) as GoogleApiErrorBody;
  } catch {
    parsed = null;
  }

  const details = parsed?.error?.details ?? [];
  const reasons = [
    ...(parsed?.error?.errors?.map((item) => item.reason || "").filter(Boolean) ?? []),
    ...details.map((item) => item.reason || "").filter(Boolean),
  ];
  const message = parsed?.error?.message || rawBody;

  if (
    status === 403 &&
    (reasons.includes("API_KEY_SERVICE_BLOCKED") ||
      message.includes("V3DataSearchService.List are blocked") ||
      message.includes("API_KEY_SERVICE_BLOCKED"))
  ) {
    return new Error(
      "YouTube key blocked (API_KEY_SERVICE_BLOCKED). In Google Cloud: enable YouTube Data API v3 and ensure your key is allowed to call youtube.googleapis.com.",
    );
  }

  if (
    status === 403 &&
    (reasons.includes("quotaExceeded") ||
      reasons.includes("dailyLimitExceeded") ||
      reasons.includes("userRateLimitExceeded") ||
      reasons.includes("rateLimitExceeded"))
  ) {
    return new Error("YouTube quota exceeded for this key. Wait for quota reset or use another key.");
  }

  if (status === 400 && reasons.includes("keyInvalid")) {
    return new Error("YouTube API key invalid. Check the key in Settings.");
  }

  return new Error(`YouTube API error ${status}: ${message}`);
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

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildQuotaBlockKey(youtubeApiKey: string) {
  const suffix = youtubeApiKey.slice(-8);
  return `youtube:quota:block:${suffix}`;
}

function buildFatalBlockKey(youtubeApiKey: string) {
  const suffix = youtubeApiKey.slice(-8);
  return `youtube:fatal:block:${suffix}`;
}

function buildTransientBlockKey(youtubeApiKey: string) {
  const suffix = youtubeApiKey.slice(-8);
  return `youtube:transient:block:${suffix}`;
}

async function scheduleYoutubeCall<T>(task: () => Promise<T>) {
  const run = youtubeQueue.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, YOUTUBE_MIN_CALL_GAP_MS - (now - lastYoutubeCall));
    if (wait > 0) await sleep(wait);
    try {
      return await task();
    } finally {
      lastYoutubeCall = Date.now();
    }
  });
  youtubeQueue = run.then(() => undefined, () => undefined);
  return run;
}

export async function searchYoutube(query: string) {
  const userId = await requireCurrentAppUserId();
  const cacheKey = `youtube:${userId}:${query.toLowerCase()}`;
  const cached = await fromCache<YoutubeSearchItem[]>(cacheKey, userId);
  if (cached) return cached;

  const keys = await getApiKeys();
  const youtubeApiKey = keys.youtubeApiKey || env.YOUTUBE_API_KEY;
  if (!youtubeApiKey) {
    throw new Error("Missing YOUTUBE_API_KEY.");
  }

  const quotaBlockKey = buildQuotaBlockKey(youtubeApiKey);
  const fatalBlockKey = buildFatalBlockKey(youtubeApiKey);
  const transientBlockKey = buildTransientBlockKey(youtubeApiKey);
  const quotaBlocked = await fromCache<{ blockedAt?: string }>(quotaBlockKey, userId);
  if (quotaBlocked) {
    throw new Error("YouTube quota exceeded for this key. Wait for quota reset or use another key.");
  }
  const fatalBlocked = await fromCache<{ blockedAt?: string; message?: string }>(fatalBlockKey, userId);
  if (fatalBlocked) {
    throw new Error(
      fatalBlocked.message ||
        "YouTube key blocked (API_KEY_SERVICE_BLOCKED). In Google Cloud: enable YouTube Data API v3 and ensure your key is allowed to call youtube.googleapis.com.",
    );
  }
  const transientBlocked = await fromCache<{ blockedAt?: string; message?: string }>(transientBlockKey, userId);
  if (transientBlocked) {
    throw new Error(
      transientBlocked.message || "YouTube API temporarily unavailable. Requests paused to preserve quota. Please retry shortly.",
    );
  }

  const params = new URLSearchParams({
    key: youtubeApiKey,
    q: query,
    part: "snippet",
    type: "video",
    maxResults: "5",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    safeSearch: "none",
  });
  let attempt = 0;
  while (attempt < YOUTUBE_MAX_RETRIES) {
    try {
      const response = await scheduleYoutubeCall(() =>
        fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
          next: { revalidate: 0 },
        }),
      );

      if (response.ok) {
        const data = (await response.json()) as { items: YoutubeSearchItem[] };
        await setCache(cacheKey, data.items, YOUTUBE_CACHE_TTL_SECONDS, userId);
        return data.items;
      }

      const body = await response.text();
      if (response.status === 429 || response.status >= 500) {
        attempt += 1;
        if (attempt >= YOUTUBE_MAX_RETRIES) {
          await setCache(
            transientBlockKey,
            {
              blockedAt: new Date().toISOString(),
              message: "YouTube API is unstable (429/5xx). Requests paused briefly to preserve quota.",
            },
            YOUTUBE_TRANSIENT_BLOCK_TTL_SECONDS,
            userId,
          );
          throw new Error(`YouTube API transient error ${response.status}. Retries exhausted.`);
        }
        await sleep(600 * 2 ** attempt);
        continue;
      }

      const parsed = parseYoutubeError(response.status, body);
      if (isYoutubeQuotaExceededError(parsed)) {
        await setCache(quotaBlockKey, { blockedAt: new Date().toISOString() }, YOUTUBE_QUOTA_BLOCK_TTL_SECONDS, userId);
      }
      if (isYoutubeFatalConfigError(parsed)) {
        await setCache(
          fatalBlockKey,
          {
            blockedAt: new Date().toISOString(),
            message: parsed.message,
          },
          YOUTUBE_FATAL_BLOCK_TTL_SECONDS,
          userId,
        );
      }
      throw parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const messageLower = message.toLowerCase();
      const looksLikeNetworkFailure =
        messageLower.includes("fetch failed") ||
        messageLower.includes("network") ||
        messageLower.includes("econnreset") ||
        messageLower.includes("etimedout") ||
        messageLower.includes("socket hang up");
      if (looksLikeNetworkFailure) {
        attempt += 1;
        if (attempt >= YOUTUBE_MAX_RETRIES) {
          await setCache(
            transientBlockKey,
            {
              blockedAt: new Date().toISOString(),
              message: "YouTube network failures detected. Requests paused briefly to preserve quota.",
            },
            YOUTUBE_TRANSIENT_BLOCK_TTL_SECONDS,
            userId,
          );
          throw new Error("YouTube network failure. Retries exhausted.");
        }
        await sleep(600 * 2 ** attempt);
        continue;
      }
      const retriable = message.includes("transient error");
      if (!retriable) throw error;
    }
  }

  throw new Error("YouTube request retries exhausted.");
}
