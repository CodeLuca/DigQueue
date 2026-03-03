export type PlaylistVisibility = "private" | "unlisted" | "public";

export function normalizePlaylistExportInput(input: { title?: string; visibility?: string | null | undefined }) {
  const visibility: PlaylistVisibility =
    input.visibility === "public" || input.visibility === "unlisted" ? input.visibility : "private";
  const title = (input.title || "DigQueue Saved Tracks").trim().slice(0, 140) || "DigQueue Saved Tracks";
  return { title, visibility };
}

export function collectUniquePlayableVideoIds(
  rows: Array<{ saved?: boolean; youtubeVideoId?: string | null }>,
  maxItems = 200,
) {
  const uniqueVideoIds: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.saved) continue;
    const id = (row.youtubeVideoId || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniqueVideoIds.push(id);
  }

  return {
    all: uniqueVideoIds,
    selected: uniqueVideoIds.slice(0, Math.max(1, maxItems)),
    skippedByLimit: Math.max(0, uniqueVideoIds.length - Math.max(1, maxItems)),
  };
}
