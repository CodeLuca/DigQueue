import { parseDiscogsReleaseIdFromUrl } from "@/lib/discogs-release-id";
import { normalizePositiveIds } from "@/lib/positive-id-list";
import { normalizeRequestedExternalDiscogsReleaseId } from "@/lib/user-release-identity";

type UserReleaseExternalRow = {
  id: number;
  discogsUrl: string | null;
};

export function resolveUserReleaseExternalDiscogsId(row: UserReleaseExternalRow) {
  return parseDiscogsReleaseIdFromUrl(row.discogsUrl) ?? normalizeRequestedExternalDiscogsReleaseId(row.id);
}

export function buildUserReleaseIdsByExternalDiscogsId<T extends UserReleaseExternalRow>(rows: T[]) {
  const grouped = buildUserReleaseRowsByExternalDiscogsId(rows);
  return new Map<number, number[]>(
    [...grouped.entries()].map(([externalDiscogsReleaseId, groupRows]) => [
      externalDiscogsReleaseId,
      normalizePositiveIds(groupRows.map((row) => row.id)),
    ]),
  );
}

export function buildUserReleaseRowsByExternalDiscogsId<T extends UserReleaseExternalRow>(rows: T[]) {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const externalDiscogsReleaseId = resolveUserReleaseExternalDiscogsId(row);
    if (typeof externalDiscogsReleaseId !== "number" || externalDiscogsReleaseId <= 0) continue;
    const bucket = grouped.get(externalDiscogsReleaseId) ?? [];
    bucket.push(row);
    grouped.set(externalDiscogsReleaseId, bucket);
  }
  return grouped;
}
