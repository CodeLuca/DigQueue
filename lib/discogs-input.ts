export function parseLabelIdFromInput(input: string): number | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const match = trimmed.match(/\/labels?\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function parseArtistIdFromInput(input: string): number | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const match = trimmed.match(/\/artists?\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function detectDiscogsSourceKindFromInput(input: string): "artist" | "label" | null {
  const trimmed = input.trim();
  const hasArtistPath = /\/artists?\/\d+/i.test(trimmed);
  const hasLabelPath = /\/labels?\/\d+/i.test(trimmed);
  if (hasArtistPath && !hasLabelPath) return "artist";
  if (hasLabelPath && !hasArtistPath) return "label";
  return null;
}
