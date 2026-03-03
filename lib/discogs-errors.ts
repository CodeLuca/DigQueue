const CONNECTIVITY_FALLBACK = "Temporary database connectivity issue while saving Discogs connection. Please retry.";

export function sanitizeDiscogsConnectionErrorMessage(message: string | null | undefined) {
  const raw = (message || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (
    lower.includes("failed query:") ||
    lower.includes("params:") ||
    lower.includes("circuit breaker open") ||
    lower.includes("unable to establish connection to upstream database") ||
    lower.includes("getaddrinfo enotfound")
  ) {
    return CONNECTIVITY_FALLBACK;
  }
  return raw;
}
