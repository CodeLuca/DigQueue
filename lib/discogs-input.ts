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
