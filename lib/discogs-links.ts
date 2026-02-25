const DISCOGS_WEB_ORIGIN = "https://www.discogs.com";

function normalizeDiscogsPath(inputPath: string) {
  const path = `/${(inputPath || "").replace(/^\/+/, "")}`;
  const normalized = path.split("/").filter(Boolean);
  if (normalized.length >= 2) {
    const [kind, id] = normalized;
    const canonicalKind =
      kind === "releases" ? "release"
      : kind === "labels" ? "label"
      : kind === "artists" ? "artist"
      : kind === "masters" ? "master"
      : kind;
    if (/^\d+$/.test(id) && ["release", "label", "artist", "master"].includes(canonicalKind)) {
      const suffix = normalized.slice(2).join("/");
      return suffix ? `/${canonicalKind}/${id}/${suffix}` : `/${canonicalKind}/${id}`;
    }
  }
  return path;
}

function fallbackDiscogsWebUrl(fallbackPath = "") {
  if (!fallbackPath) return DISCOGS_WEB_ORIGIN;
  return `${DISCOGS_WEB_ORIGIN}${normalizeDiscogsPath(fallbackPath)}`;
}

export function toDiscogsWebUrl(url: string, fallbackPath = "") {
  const trimmed = (url || "").trim();
  if (!trimmed) return fallbackDiscogsWebUrl(fallbackPath);

  const absolute = /^www\.discogs\.com\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
  if (absolute.startsWith("/")) {
    return `${DISCOGS_WEB_ORIGIN}${normalizeDiscogsPath(absolute)}`;
  }

  try {
    const parsed = new URL(absolute);
    const host = parsed.hostname.toLowerCase();
    if (host === "discogs.com" || host.endsWith(".discogs.com")) {
      const normalizedPath = normalizeDiscogsPath(parsed.pathname);
      return `${DISCOGS_WEB_ORIGIN}${normalizedPath}${parsed.search}${parsed.hash}`;
    }
    return trimmed;
  } catch {
    return fallbackDiscogsWebUrl(fallbackPath);
  }
}
