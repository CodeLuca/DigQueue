import { getApiKeys } from "@/lib/api-keys";
import { parseDiscogsStoredAuth } from "@/lib/discogs-auth";

const DEFAULT_LISTENING_PATH = "/?tab=step-2";
const DEFAULT_CONNECT_DISCOGS_PATH = `/connect-discogs?next=${encodeURIComponent(DEFAULT_LISTENING_PATH)}`;

function isGuidedOnboardingCandidate(nextPath: string) {
  return nextPath === DEFAULT_LISTENING_PATH || nextPath === "/" || nextPath === "/welcome";
}

export async function resolvePostAuthRedirect(nextPath: string) {
  if (!isGuidedOnboardingCandidate(nextPath)) return nextPath;

  try {
    const keys = await getApiKeys();
    const storedDiscogsAuth = parseDiscogsStoredAuth(keys.discogsToken);
    if (storedDiscogsAuth?.kind === "oauth") return nextPath;
  } catch {
    // Non-blocking: if key lookup fails, keep standard destination.
    return nextPath;
  }

  return DEFAULT_CONNECT_DISCOGS_PATH;
}
