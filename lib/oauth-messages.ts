import type { OAuthProvider } from "@/lib/oauth-provider";

export function getInvalidOAuthCallbackMessage(provider: OAuthProvider) {
  return provider === "discogs" ? "Invalid Discogs OAuth callback." : "Invalid YouTube OAuth callback.";
}

export function getOAuthStateMismatchMessage(provider: OAuthProvider) {
  return provider === "discogs" ? "Discogs OAuth state mismatch." : "YouTube OAuth state mismatch.";
}

export function getOAuthCallbackErrorMessage(
  provider: OAuthProvider,
  reason: "invalid_callback" | "state_mismatch",
) {
  if (reason === "state_mismatch") return getOAuthStateMismatchMessage(provider);
  return getInvalidOAuthCallbackMessage(provider);
}
