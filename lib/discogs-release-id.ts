export function parseDiscogsReleaseIdFromUrl(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/\/releases?\/(\d+)/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}
