import { getOAuthProviderLoginNextPath, type OAuthProvider } from "@/lib/oauth-provider";

export function parseOAuthStartQuery(requestUrl: URL) {
  return {
    nextRaw: requestUrl.searchParams.get("next"),
  };
}

export function buildOAuthStartLoginPath(provider: OAuthProvider) {
  return `/login?next=${encodeURIComponent(getOAuthProviderLoginNextPath(provider))}`;
}
