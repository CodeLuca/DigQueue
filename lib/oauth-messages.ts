import type { OAuthProvider } from "@/lib/oauth-provider";

export function getInvalidOAuthCallbackMessage(provider: OAuthProvider) {
  return provider === "discogs" ? "Invalid Discogs OAuth callback." : "Invalid YouTube OAuth callback.";
}

export function getOAuthStateMismatchMessage(provider: OAuthProvider) {
  return provider === "discogs" ? "Discogs OAuth state mismatch." : "OAuth state mismatch.";
}
