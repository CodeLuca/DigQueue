export function parseDiscogsOAuthCallbackQuery(requestUrl: URL) {
  return {
    nextRaw: requestUrl.searchParams.get("next"),
    returnedState: requestUrl.searchParams.get("state") || "",
    oauthToken: requestUrl.searchParams.get("oauth_token") || "",
    verifier: requestUrl.searchParams.get("oauth_verifier") || "",
  };
}

export function parseYoutubeOAuthCallbackQuery(requestUrl: URL) {
  return {
    nextRaw: requestUrl.searchParams.get("next"),
    returnedState: requestUrl.searchParams.get("state") || "",
    code: requestUrl.searchParams.get("code") || "",
  };
}
