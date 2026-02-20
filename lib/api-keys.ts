import { sql } from "drizzle-orm";
import { appSecrets } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

function createSafeSecretRowId(userId: string) {
  // Keep IDs safely inside int4 range to tolerate legacy schemas where id may be integer.
  const compact = userId.replaceAll("-", "").slice(0, 7);
  const parsed = Number.parseInt(compact, 16);
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 2_147_483_647) return parsed;
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

type ApiKeys = {
  discogsToken: string | null;
  youtubeApiKey: string | null;
};

let cache: { userId: string; data: ApiKeys; expiresAt: number } | null = null;

export async function getApiKeys(): Promise<ApiKeys> {
  const userId = await requireCurrentAppUserId();
  const now = Date.now();
  if (cache && cache.userId === userId && cache.expiresAt > now) return cache.data;

  const row = await db.query.appSecrets.findFirst({
    where: sql`${appSecrets.userId}::text = ${userId}`,
  });
  const data = {
    discogsToken: row?.discogsToken ?? null,
    youtubeApiKey: row?.youtubeApiKey ?? null,
  };

  cache = { userId, data, expiresAt: now + 30_000 };
  return data;
}

export async function setApiKeys(input: { discogsToken?: string; youtubeApiKey?: string }) {
  const userId = await requireCurrentAppUserId();
  const now = new Date();
  const discogsToken = input.discogsToken?.trim() || null;
  const youtubeApiKey = input.youtubeApiKey?.trim() || null;

  const existing = await db.query.appSecrets.findFirst({
    where: sql`${appSecrets.userId}::text = ${userId}`,
  });
  if (existing) {
    await db
      .update(appSecrets)
      .set({
        discogsToken,
        youtubeApiKey,
        updatedAt: now,
      })
      .where(sql`${appSecrets.userId}::text = ${userId}`);
    cache = null;
    return;
  }

  // Insert with retry in case generated id collides with another row.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const secretRowId = createSafeSecretRowId(userId);
    try {
      await db.insert(appSecrets).values({
        id: secretRowId,
        userId,
        discogsToken,
        youtubeApiKey,
        updatedAt: now,
      });
      cache = null;
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.toLowerCase().includes("duplicate")) throw error;
    }
  }

  throw new Error("Unable to persist API keys.");
}

export async function getEffectiveApiKeys() {
  const stored = await getApiKeys();
  return {
    discogsToken: stored.discogsToken || env.DISCOGS_TOKEN || null,
    youtubeApiKey: stored.youtubeApiKey || env.YOUTUBE_API_KEY || null,
  };
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return "Not set";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
