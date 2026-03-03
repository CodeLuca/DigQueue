import { getOAuthErrorQueryKey, type OAuthProvider } from "@/lib/oauth-provider";

export function appendQueryParam(path: string, key: string, value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export function buildOAuthConnectedRedirectPath(nextPath: string, provider: OAuthProvider) {
  return appendQueryParam(nextPath, provider, "connected");
}

export function buildOAuthErrorRedirectPath(provider: OAuthProvider, message: string) {
  return appendQueryParam("/settings", getOAuthErrorQueryKey(provider), message);
}
