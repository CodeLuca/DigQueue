export type OAuthProvider = "discogs" | "youtube";

export function getOAuthProviderLoginNextPath(provider: OAuthProvider) {
  return provider === "discogs" ? "/connect-discogs" : "/settings";
}

export function getOAuthErrorQueryKey(provider: OAuthProvider) {
  return provider === "discogs" ? "discogs_error" : "youtube_error";
}

export function getOAuthTempCookieKey(provider: OAuthProvider) {
  return provider === "discogs" ? "discogs_oauth_tmp" : "youtube_oauth_tmp";
}
