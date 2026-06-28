import { normalizeNextPath } from "@/lib/next-path";

type NextPathOptions = {
  fallback?: string;
};

function resolveSafeNextPath(nextPath: string | null | undefined, options?: NextPathOptions) {
  return normalizeNextPath(nextPath, {
    fallback: options?.fallback ?? "/",
    blockAuthEntrypoints: true,
  });
}

export function buildGoogleAuthStartPath(nextPath?: string | null, options?: NextPathOptions) {
  const next = resolveSafeNextPath(nextPath, options);
  return `/auth/google/start?next=${encodeURIComponent(next)}`;
}

export function buildDiscogsOAuthStartPath(nextPath?: string | null, options?: NextPathOptions) {
  const next = resolveSafeNextPath(nextPath, options);
  return `/api/discogs/oauth/start?next=${encodeURIComponent(next)}`;
}

export function buildYoutubeOAuthStartPath(nextPath?: string | null, options?: NextPathOptions) {
  const next = resolveSafeNextPath(nextPath, options);
  return `/api/youtube/oauth/start?next=${encodeURIComponent(next)}`;
}

export function buildDiscogsConnectPath(nextPath?: string | null, options?: NextPathOptions) {
  const next = resolveSafeNextPath(nextPath, options);
  return `/connect-discogs?next=${encodeURIComponent(next)}`;
}
