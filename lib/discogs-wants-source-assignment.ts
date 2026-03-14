type ReleaseAssignmentRow = {
  releaseId: number;
  labelId: number | null;
  wishlist: boolean;
  importSource: string;
};

export function planDiscogsWantSourceAssignment(
  rows: ReleaseAssignmentRow[],
  activeLabelIds: Set<number>,
) {
  const eligibleReleaseIds: number[] = [];
  const relabelReleaseIds: number[] = [];

  for (const row of rows) {
    const fromActiveSource = typeof row.labelId === "number" && activeLabelIds.has(row.labelId);
    const isWantOwned = row.wishlist || row.importSource === "discogs_want";
    if (!fromActiveSource && !isWantOwned) continue;
    eligibleReleaseIds.push(row.releaseId);
    if (!fromActiveSource && isWantOwned) {
      relabelReleaseIds.push(row.releaseId);
    }
  }

  return {
    eligibleReleaseIds,
    relabelReleaseIds,
  };
}
