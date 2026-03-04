import { randomBytes } from "node:crypto";
import type { OAuthProvider } from "@/lib/oauth-provider";

export function getOAuthStateByteLength(provider: OAuthProvider) {
  return provider === "discogs" ? 12 : 18;
}

export function createOAuthState(provider: OAuthProvider) {
  return randomBytes(getOAuthStateByteLength(provider)).toString("hex");
}
