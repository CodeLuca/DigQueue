import { getOAuthProviderLoginNextPath, type OAuthProvider } from "@/lib/oauth-provider";

export function buildOAuthCallbackLoginPath(provider: OAuthProvider) {
  return `/login?next=${encodeURIComponent(getOAuthProviderLoginNextPath(provider))}`;
}
