export function normalizeTrackPosition(position: string | null | undefined) {
  const trimmed = position?.trim() || "";
  return trimmed || "__";
}

export function normalizeTrackTitle(title: string | null | undefined) {
  return title?.trim().toLowerCase() || "";
}
