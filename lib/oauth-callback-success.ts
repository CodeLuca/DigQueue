import type { OAuthProvider } from "@/lib/oauth-provider";
import { buildOAuthConnectedRedirectPath } from "@/lib/oauth-redirects";

export function buildOAuthCallbackSuccessPath(nextPath: string, provider: OAuthProvider) {
  return buildOAuthConnectedRedirectPath(nextPath, provider);
}
