export function toDiscogsWebUrl(url: string, fallbackPath = "") {
  const trimmed = (url || "").trim();
  if (!trimmed) return fallbackPath ? `https://www.discogs.com${fallbackPath}` : "https://www.discogs.com";

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host === "api.discogs.com" || host.endsWith(".api.discogs.com")) {
      const path = parsed.pathname.replace(/^\/+/, "");
      if (path.startsWith("releases/")) {
        const id = path.split("/")[1];
        if (id) return `https://www.discogs.com/release/${id}`;
      }
      if (path.startsWith("labels/")) {
        const id = path.split("/")[1];
        if (id) return `https://www.discogs.com/label/${id}`;
      }
    }
    return trimmed;
  } catch {
    return fallbackPath ? `https://www.discogs.com${fallbackPath}` : "https://www.discogs.com";
  }
}
