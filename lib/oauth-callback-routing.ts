import { getOAuthProviderLoginNextPath } from "@/lib/oauth-start-routing";

export function buildOAuthCallbackLoginPath(provider: "discogs" | "youtube") {
  return `/login?next=${encodeURIComponent(getOAuthProviderLoginNextPath(provider))}`;
}
