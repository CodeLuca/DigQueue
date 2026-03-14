import { deriveReleaseListenedFromTracks } from "@/lib/release-listened";
import { normalizePositiveIds } from "@/lib/positive-id-list";

export function buildReleaseListenedUpdatePlan(
  releaseIdsInput: Iterable<number>,
  rows: Array<{ releaseId: number; listened: boolean }>,
) {
  const releaseIds = normalizePositiveIds(releaseIdsInput);
  const rowsByRelease = new Map<number, Array<{ listened: boolean }>>();
  for (const releaseId of releaseIds) rowsByRelease.set(releaseId, []);
  for (const row of rows) {
    const bucket = rowsByRelease.get(row.releaseId);
    if (bucket) bucket.push({ listened: row.listened });
  }

  const listenedIds: number[] = [];
  const unlistenedIds: number[] = [];
  for (const releaseId of releaseIds) {
    const releaseRows = rowsByRelease.get(releaseId) ?? [];
    if (deriveReleaseListenedFromTracks(releaseRows)) {
      listenedIds.push(releaseId);
    } else {
      unlistenedIds.push(releaseId);
    }
  }

  return { listenedIds, unlistenedIds };
}
