type ListenRowLike = {
  trackId: number;
  saved: boolean;
  listened: boolean;
  isUpNext?: boolean;
  releaseId?: number;
  releaseWishlist?: boolean;
  labelActive?: boolean;
};

export function mapRowsByTrackIds<TRow extends ListenRowLike>(
  rows: TRow[],
  trackIds: Iterable<number>,
  updateRow: (row: TRow) => TRow,
) {
  const affected = new Set(trackIds);
  return rows.map((row) => (affected.has(row.trackId) ? updateRow(row) : row));
}

export function applySavedToRows<TRow extends ListenRowLike>(
  rows: TRow[],
  trackIds: Iterable<number>,
  saved: boolean,
) {
  return mapRowsByTrackIds(rows, trackIds, (row) => ({
    ...row,
    saved,
    isUpNext: saved ? false : row.isUpNext,
  }));
}

export function applyListenedToRows<TRow extends ListenRowLike>(
  rows: TRow[],
  trackIds: Iterable<number>,
) {
  return mapRowsByTrackIds(rows, trackIds, (row) => ({
    ...row,
    listened: true,
    isUpNext: false,
  }));
}

export function clearUpNextByTrackId<TRow extends ListenRowLike>(
  rows: TRow[],
  trackId: number,
) {
  return mapRowsByTrackIds(rows, [trackId], (row) => ({
    ...row,
    isUpNext: false,
  }));
}

export function applyPlayerCurrentToRows<TRow extends ListenRowLike>(
  rows: TRow[],
  trackId: number,
  saved?: boolean | null,
  listened?: boolean | null,
) {
  return mapRowsByTrackIds(rows, [trackId], (row) => ({
    ...row,
    isUpNext: false,
    saved: typeof saved === "boolean" ? saved : row.saved,
    listened: typeof listened === "boolean" ? listened : row.listened,
  }));
}

export function filterSavedRows<TRow extends ListenRowLike>(rows: TRow[]) {
  return rows.filter((row) => row.saved);
}

export function applyReleaseWishlistToRows<
  TRow extends ListenRowLike & { releaseId: number; releaseWishlist: boolean },
>(rows: TRow[], releaseId: number, releaseWishlist: boolean) {
  return rows.map((row) => (
    row.releaseId === releaseId
      ? { ...row, releaseWishlist }
      : row
  ));
}

export function applyAffectedReleaseWishlistToRows<
  TRow extends ListenRowLike & { releaseId: number; releaseWishlist: boolean },
>(rows: TRow[], releaseIds: Iterable<number>, releaseWishlist: boolean) {
  const affected = new Set(releaseIds);
  return rows.map((row) => (
    affected.has(row.releaseId)
      ? { ...row, releaseWishlist }
      : row
  ));
}

export function applyLabelActiveToRows<
  TRow extends ListenRowLike & { releaseId: number; labelActive?: boolean },
>(rows: TRow[], releaseId: number, labelActive: boolean) {
  return rows.map((row) => (
    row.releaseId === releaseId
      ? { ...row, labelActive }
      : row
  ));
}
