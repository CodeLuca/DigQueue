export function parseOAuthStartQuery(requestUrl: URL) {
  return {
    nextRaw: requestUrl.searchParams.get("next"),
  };
}

export function getOAuthProviderLoginNextPath(provider: "discogs" | "youtube") {
  return provider === "discogs" ? "/connect-discogs" : "/settings";
}

export function buildOAuthStartLoginPath(provider: "discogs" | "youtube") {
  return `/login?next=${encodeURIComponent(getOAuthProviderLoginNextPath(provider))}`;
}
