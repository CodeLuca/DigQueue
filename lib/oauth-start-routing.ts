export function parseOAuthStartQuery(requestUrl: URL) {
  return {
    nextRaw: requestUrl.searchParams.get("next"),
  };
}

export function buildOAuthStartLoginPath(provider: "discogs" | "youtube") {
  const nextPath = provider === "discogs" ? "/connect-discogs" : "/settings";
  return `/login?next=${encodeURIComponent(nextPath)}`;
}
