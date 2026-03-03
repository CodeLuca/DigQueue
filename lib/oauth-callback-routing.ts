export function buildOAuthCallbackLoginPath(provider: "discogs" | "youtube") {
  const nextPath = provider === "discogs" ? "/connect-discogs" : "/settings";
  return `/login?next=${encodeURIComponent(nextPath)}`;
}
