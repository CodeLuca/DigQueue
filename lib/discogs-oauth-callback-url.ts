export function buildDiscogsOAuthCallbackUrl(origin: string, nextPath: string, state: string) {
  const callbackUrl = new URL("/api/discogs/oauth/callback", origin);
  callbackUrl.searchParams.set("next", nextPath);
  callbackUrl.searchParams.set("state", state);
  return callbackUrl.toString();
}
