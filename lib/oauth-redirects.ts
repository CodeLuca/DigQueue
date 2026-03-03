export function appendQueryParam(path: string, key: string, value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export function buildOAuthConnectedRedirectPath(nextPath: string, provider: "discogs" | "youtube") {
  return appendQueryParam(nextPath, provider, "connected");
}

export function buildOAuthErrorRedirectPath(provider: "discogs" | "youtube", message: string) {
  const key = provider === "discogs" ? "discogs_error" : "youtube_error";
  return appendQueryParam("/settings", key, message);
}
