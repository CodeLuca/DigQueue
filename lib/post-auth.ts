import { getEffectiveApiKeys } from "@/lib/api-keys";

const DEFAULT_LISTENING_PATH = "/?tab=step-2";
const DEFAULT_CONNECT_DISCOGS_PATH = `/connect-discogs?next=${encodeURIComponent(DEFAULT_LISTENING_PATH)}`;

function isGuidedOnboardingCandidate(nextPath: string) {
  return nextPath === DEFAULT_LISTENING_PATH || nextPath === "/" || nextPath === "/welcome";
}

export async function resolvePostAuthRedirect(nextPath: string) {
  if (!isGuidedOnboardingCandidate(nextPath)) return nextPath;

  try {
    const keys = await getEffectiveApiKeys();
    if (Boolean(keys.discogsToken)) return nextPath;
  } catch {
    // Non-blocking: if key lookup fails, keep standard destination.
    return nextPath;
  }

  return DEFAULT_CONNECT_DISCOGS_PATH;
}
