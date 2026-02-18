import { eq } from "drizzle-orm";
import { appSecrets } from "@/db/schema";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const SECRET_ROW_ID = 1;

type ApiKeys = {
  discogsToken: string | null;
  youtubeApiKey: string | null;
};

let cache: { data: ApiKeys; expiresAt: number } | null = null;

export async function getApiKeys(): Promise<ApiKeys> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;

  const row = await db.query.appSecrets.findFirst({ where: eq(appSecrets.id, SECRET_ROW_ID) });
  const data = {
    discogsToken: row?.discogsToken ?? null,
    youtubeApiKey: row?.youtubeApiKey ?? null,
  };

  cache = { data, expiresAt: now + 30_000 };
  return data;
}

export async function setApiKeys(input: { discogsToken?: string; youtubeApiKey?: string }) {
  const now = new Date();
  await db
    .insert(appSecrets)
    .values({
      id: SECRET_ROW_ID,
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
