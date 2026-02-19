import { and, eq } from "drizzle-orm";
import { appSecrets } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

function getSecretRowId(userId: string) {
  const compact = userId.replaceAll("-", "").slice(0, 12);
  const parsed = Number.parseInt(compact, 16);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

type ApiKeys = {
  discogsToken: string | null;
  youtubeApiKey: string | null;
};

let cache: { userId: string; data: ApiKeys; expiresAt: number } | null = null;

export async function getApiKeys(): Promise<ApiKeys> {
  const userId = await requireCurrentAppUserId();
  const secretRowId = getSecretRowId(userId);
  const now = Date.now();
  if (cache && cache.userId === userId && cache.expiresAt > now) return cache.data;

  const row = await db.query.appSecrets.findFirst({ where: and(eq(appSecrets.id, secretRowId), eq(appSecrets.userId, userId)) });
  const data = {
    discogsToken: row?.discogsToken ?? null,
    youtubeApiKey: row?.youtubeApiKey ?? null,
  };

  cache = { userId, data, expiresAt: now + 30_000 };
  return data;
}

export async function setApiKeys(input: { discogsToken?: string; youtubeApiKey?: string }) {
  const userId = await requireCurrentAppUserId();
  const secretRowId = getSecretRowId(userId);
  const now = new Date();
  await db
    .insert(appSecrets)
    .values({
      id: secretRowId,
      userId,
      discogsToken: input.discogsToken?.trim() || null,
      youtubeApiKey: input.youtubeApiKey?.trim() || null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: appSecrets.id,
      set: {
        discogsToken: input.discogsToken?.trim() || null,
        youtubeApiKey: input.youtubeApiKey?.trim() || null,
        updatedAt: now,
      },
    });

  cache = null;
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
