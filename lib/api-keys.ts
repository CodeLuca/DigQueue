import { sql } from "drizzle-orm";
import { appSecrets } from "@/db/schema";
import { requireCurrentAppUserId } from "@/lib/app-user";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { decryptSecret, encryptSecret, hasSecretEncryptionKey, isEncryptedSecret } from "@/lib/secret-crypto";

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
  youtubeOauthRefreshToken: string | null;
  youtubeOauthAccessToken: string | null;
  youtubeOauthExpiresAt: number | null;
  youtubeOauthScope: string | null;
  youtubeOauthChannelId: string | null;
  youtubeOauthChannelTitle: string | null;
};

let cache: { userId: string; data: ApiKeys; expiresAt: number } | null = null;
const DB_RETRY_ATTEMPTS = 4;
const DB_RETRY_BASE_MS = 180;

function isMissingAppSecretsOauthColumnError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("app_secrets")
    && message.includes("does not exist")
    && message.includes("youtube_oauth_");
}

function decodeStoredSecret(value: string | null | undefined) {
  if (!value) return null;
  if (!isEncryptedSecret(value)) return value;
  return decryptSecret(value);
}

function encodeSecretForStorage(value: string | null) {
  if (!value) return null;
  if (!hasSecretEncryptionKey()) {
    throw new Error("APP_SECRETS_ENCRYPTION_KEY is required to store API keys.");
  }
  return encryptSecret(value);
}

function isTransientDbError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("failed query:") ||
    message.includes("maxclientsinsessionmode") ||
    message.includes("temporary database write failure") ||
    message.includes("database is temporarily overloaded") ||
    message.includes("database is locked") ||
    message.includes("sqlite_busy") ||
    message.includes("circuit breaker open") ||
    message.includes("unable to establish connection to upstream database") ||
    message.includes("getaddrinfo enotfound")
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getLegacyAppSecretsRow(userId: string) {
  const rows = await db.execute(sql`
    select discogs_token as "discogsToken", youtube_api_key as "youtubeApiKey"
    from app_secrets
    where user_id = ${userId}::uuid
    limit 1
  `);
  const row = rows[0] as { discogsToken?: string | null; youtubeApiKey?: string | null } | undefined;
  if (!row) return null;
  return {
    discogsToken: row.discogsToken ?? null,
    youtubeApiKey: row.youtubeApiKey ?? null,
    youtubeOauthRefreshToken: null,
    youtubeOauthAccessToken: null,
    youtubeOauthExpiresAt: null,
    youtubeOauthScope: null,
    youtubeOauthChannelId: null,
    youtubeOauthChannelTitle: null,
  };
}

async function setLegacyApiKeysRow(input: {
  userId: string;
  discogsToken: string | null;
  youtubeApiKey: string | null;
  nowMs: number;
}) {
  const updated = await db.execute(sql`
    update app_secrets
    set
      discogs_token = ${input.discogsToken},
      youtube_api_key = ${input.youtubeApiKey},
      updated_at = ${input.nowMs}
    where user_id = ${input.userId}::uuid
    returning id
  `);
  if (updated.length > 0) {
    cache = null;
    return;
  }

  // Insert with retry in case generated id collides with another row.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const secretRowId = createSafeSecretRowId(input.userId);
    try {
      await db.execute(sql`
        insert into app_secrets (id, user_id, discogs_token, youtube_api_key, updated_at)
        values (${secretRowId}, ${input.userId}::uuid, ${input.discogsToken}, ${input.youtubeApiKey}, ${input.nowMs})
      `);
      cache = null;
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("duplicate")) throw error;
    }
  }

  throw new Error("Unable to persist API keys.");
}

export async function getApiKeys(options?: { strict?: boolean }): Promise<ApiKeys> {
  const userId = await requireCurrentAppUserId();
  const now = Date.now();
  if (cache && cache.userId === userId && cache.expiresAt > now) return cache.data;

  let row:
    | {
        discogsToken: string | null;
        youtubeApiKey: string | null;
        youtubeOauthRefreshToken: string | null;
        youtubeOauthAccessToken: string | null;
        youtubeOauthExpiresAt: number | null;
        youtubeOauthScope: string | null;
        youtubeOauthChannelId: string | null;
        youtubeOauthChannelTitle: string | null;
      }
    | null = null;
  try {
    row = (await db.query.appSecrets.findFirst({
      where: sql`${appSecrets.userId} = ${userId}::uuid`,
    })) ?? null;
  } catch (error) {
    if (isMissingAppSecretsOauthColumnError(error)) {
      row = await getLegacyAppSecretsRow(userId);
    } else {
      if (options?.strict) throw error;
      // Keep app usable when DB connectivity is temporarily unavailable.
      // Intentionally ignore and fall back to null keys.
    }
  }

  const data = {
    discogsToken: decodeStoredSecret(row?.discogsToken),
    youtubeApiKey: decodeStoredSecret(row?.youtubeApiKey),
    youtubeOauthRefreshToken: decodeStoredSecret(row?.youtubeOauthRefreshToken),
    youtubeOauthAccessToken: decodeStoredSecret(row?.youtubeOauthAccessToken),
    youtubeOauthExpiresAt: typeof row?.youtubeOauthExpiresAt === "number" ? row.youtubeOauthExpiresAt : null,
    youtubeOauthScope: row?.youtubeOauthScope ?? null,
    youtubeOauthChannelId: row?.youtubeOauthChannelId ?? null,
    youtubeOauthChannelTitle: row?.youtubeOauthChannelTitle ?? null,
  };

  if (row && hasSecretEncryptionKey()) {
    const shouldUpgradeDiscogs = Boolean(row.discogsToken && !isEncryptedSecret(row.discogsToken));
    const shouldUpgradeYoutube = Boolean(row.youtubeApiKey && !isEncryptedSecret(row.youtubeApiKey));
    const shouldUpgradeYoutubeOAuthRefresh = Boolean(row.youtubeOauthRefreshToken && !isEncryptedSecret(row.youtubeOauthRefreshToken));
    const shouldUpgradeYoutubeOAuthAccess = Boolean(row.youtubeOauthAccessToken && !isEncryptedSecret(row.youtubeOauthAccessToken));
    if (shouldUpgradeDiscogs || shouldUpgradeYoutube || shouldUpgradeYoutubeOAuthRefresh || shouldUpgradeYoutubeOAuthAccess) {
      try {
        await db
          .update(appSecrets)
          .set({
            discogsToken: encodeSecretForStorage(data.discogsToken),
            youtubeApiKey: encodeSecretForStorage(data.youtubeApiKey),
            youtubeOauthRefreshToken: encodeSecretForStorage(data.youtubeOauthRefreshToken),
            youtubeOauthAccessToken: encodeSecretForStorage(data.youtubeOauthAccessToken),
            youtubeOauthExpiresAt: data.youtubeOauthExpiresAt,
            youtubeOauthScope: data.youtubeOauthScope,
            youtubeOauthChannelId: data.youtubeOauthChannelId,
            youtubeOauthChannelTitle: data.youtubeOauthChannelTitle,
            updatedAt: new Date(),
          })
          .where(sql`${appSecrets.userId} = ${userId}::uuid`);
      } catch {
        // Encryption-upgrade write is non-critical for reads.
      }
    }
  }

  cache = { userId, data, expiresAt: now + 30_000 };
  return data;
}

export async function setApiKeys(input: {
  discogsToken?: string;
  youtubeApiKey?: string;
  youtubeOauthRefreshToken?: string | null;
  youtubeOauthAccessToken?: string | null;
  youtubeOauthExpiresAt?: number | null;
  youtubeOauthScope?: string | null;
  youtubeOauthChannelId?: string | null;
  youtubeOauthChannelTitle?: string | null;
}) {
  const userId = await requireCurrentAppUserId();
  for (let writeAttempt = 0; writeAttempt < DB_RETRY_ATTEMPTS; writeAttempt += 1) {
    try {
      const now = new Date();
      const existingDecoded = await getApiKeys({ strict: true });
      const rawDiscogsToken = "discogsToken" in input ? input.discogsToken?.trim() || null : existingDecoded.discogsToken;
      const rawYoutubeApiKey = "youtubeApiKey" in input ? input.youtubeApiKey?.trim() || null : existingDecoded.youtubeApiKey;
      const rawYoutubeOauthRefreshToken =
        "youtubeOauthRefreshToken" in input ? input.youtubeOauthRefreshToken?.trim() || null : existingDecoded.youtubeOauthRefreshToken;
      const rawYoutubeOauthAccessToken =
        "youtubeOauthAccessToken" in input ? input.youtubeOauthAccessToken?.trim() || null : existingDecoded.youtubeOauthAccessToken;
      const youtubeOauthExpiresAt =
        "youtubeOauthExpiresAt" in input
          ? typeof input.youtubeOauthExpiresAt === "number"
            ? input.youtubeOauthExpiresAt
            : null
          : existingDecoded.youtubeOauthExpiresAt;
      const youtubeOauthScope = "youtubeOauthScope" in input ? input.youtubeOauthScope?.trim() || null : existingDecoded.youtubeOauthScope;
      const youtubeOauthChannelId =
        "youtubeOauthChannelId" in input ? input.youtubeOauthChannelId?.trim() || null : existingDecoded.youtubeOauthChannelId;
      const youtubeOauthChannelTitle =
        "youtubeOauthChannelTitle" in input ? input.youtubeOauthChannelTitle?.trim() || null : existingDecoded.youtubeOauthChannelTitle;
      const discogsToken = encodeSecretForStorage(rawDiscogsToken);
      const youtubeApiKey = encodeSecretForStorage(rawYoutubeApiKey);
      const youtubeOauthRefreshToken = encodeSecretForStorage(rawYoutubeOauthRefreshToken);
      const youtubeOauthAccessToken = encodeSecretForStorage(rawYoutubeOauthAccessToken);

      try {
        const existing = await db.query.appSecrets.findFirst({
          where: sql`${appSecrets.userId} = ${userId}::uuid`,
        });
        if (existing) {
          await db
            .update(appSecrets)
            .set({
              discogsToken,
              youtubeApiKey,
              youtubeOauthRefreshToken,
              youtubeOauthAccessToken,
              youtubeOauthExpiresAt,
              youtubeOauthScope,
              youtubeOauthChannelId,
              youtubeOauthChannelTitle,
              updatedAt: now,
            })
            .where(sql`${appSecrets.userId} = ${userId}::uuid`);
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
              youtubeOauthRefreshToken,
              youtubeOauthAccessToken,
              youtubeOauthExpiresAt,
              youtubeOauthScope,
              youtubeOauthChannelId,
              youtubeOauthChannelTitle,
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
      } catch (error) {
        if (!isMissingAppSecretsOauthColumnError(error)) throw error;
        await setLegacyApiKeysRow({
          userId,
          discogsToken,
          youtubeApiKey,
          nowMs: now.getTime(),
        });
        return;
      }
    } catch (error) {
      if (!isTransientDbError(error) || writeAttempt >= DB_RETRY_ATTEMPTS - 1) throw error;
      await wait(DB_RETRY_BASE_MS * (writeAttempt + 1));
    }
  }
}

export async function getEffectiveApiKeys() {
  const stored = await getApiKeys();
  return {
    discogsToken: stored.discogsToken || env.DISCOGS_TOKEN || null,
    youtubeApiKey: stored.youtubeApiKey || env.YOUTUBE_API_KEY || null,
    youtubeOauthConnected: Boolean(stored.youtubeOauthRefreshToken),
  };
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return "Not set";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
