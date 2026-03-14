import { buildOAuthCallbackLoginPath } from "@/lib/oauth-callback-routing";
import { buildOAuthCallbackSuccessPath } from "@/lib/oauth-callback-success";
import { getOAuthCallbackErrorMessage } from "@/lib/oauth-messages";
import type { OAuthProvider } from "@/lib/oauth-provider";
import { buildOAuthErrorRedirectPath } from "@/lib/oauth-redirects";

type OAuthCallbackRedirectReason = "login" | "invalid_callback" | "state_mismatch" | "success";

export function resolveOAuthCallbackRedirectPath(input: {
  provider: OAuthProvider;
  reason: OAuthCallbackRedirectReason;
  nextPath?: string;
}) {
  if (input.reason === "login") {
    return buildOAuthCallbackLoginPath(input.provider);
  }
  if (input.reason === "success") {
    return buildOAuthCallbackSuccessPath(input.nextPath || "/settings", input.provider);
  }
  return buildOAuthErrorRedirectPath(
    input.provider,
    getOAuthCallbackErrorMessage(input.provider, input.reason),
  );
}
