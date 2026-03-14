export function createAffectedReleaseIdSet(releaseIds: number[]) {
  return new Set<number>(releaseIds);
}

export function mapItemsByReleaseId<T>(
  items: T[],
  releaseId: number,
  getReleaseId: (item: T) => number | null | undefined,
  updateItem: (item: T) => T,
) {
  return mapItemsByAffectedReleaseIds(items, createAffectedReleaseIdSet([releaseId]), getReleaseId, updateItem);
}

export function mapItemsByAffectedReleaseIds<T>(
  items: T[],
  affectedReleaseIds: Set<number>,
  getReleaseId: (item: T) => number | null | undefined,
  updateItem: (item: T) => T,
) {
  return items.map((item) => (affectedReleaseIds.has(getReleaseId(item) ?? -1) ? updateItem(item) : item));
}

export function filterItemsByAffectedReleaseIds<T>(
  items: T[],
  affectedReleaseIds: Set<number>,
  getReleaseId: (item: T) => number | null | undefined,
) {
  return items.filter((item) => !affectedReleaseIds.has(getReleaseId(item) ?? -1));
}
