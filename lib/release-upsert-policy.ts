export function shouldReplaceReleaseOwner(existingImportSource: string | null | undefined, incomingImportSource: string | null | undefined) {
  return existingImportSource === "discogs_want" && incomingImportSource !== "discogs_want";
}

export function mergeReleaseImportSource(existingImportSource: string | null | undefined, incomingImportSource: string | null | undefined) {
  if (!incomingImportSource) return existingImportSource || "label";
  if (!existingImportSource) return incomingImportSource;
  return shouldReplaceReleaseOwner(existingImportSource, incomingImportSource) ? incomingImportSource : existingImportSource;
}
