const OAUTH_STORAGE_PREFIX = "oauth1:";

export type DiscogsStoredAuth =
  | { kind: "oauth"; token: string; tokenSecret: string }
  | { kind: "personal"; token: string };

export function parseDiscogsStoredAuth(value: string | null | undefined): DiscogsStoredAuth | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(OAUTH_STORAGE_PREFIX)) {
    const payload = trimmed.slice(OAUTH_STORAGE_PREFIX.length);
    const separatorIndex = payload.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex >= payload.length - 1) return null;
    const token = payload.slice(0, separatorIndex);
    const tokenSecret = payload.slice(separatorIndex + 1);
    if (!token || !tokenSecret) return null;
    return { kind: "oauth", token, tokenSecret };
  }

  return { kind: "personal", token: trimmed };
}

export function serializeDiscogsOAuthAuth(token: string, tokenSecret: string) {
  const normalizedToken = token.trim();
  const normalizedSecret = tokenSecret.trim();
  if (!normalizedToken || !normalizedSecret) {
    throw new Error("Discogs OAuth token payload is incomplete.");
  }
  return `${OAUTH_STORAGE_PREFIX}${normalizedToken}:${normalizedSecret}`;
}
