type PendingQueueRow = {
  id: number;
  trackId: number | null;
  releaseId: number | null;
  youtubeVideoId: string;
  priority: number;
  bumpedAt: Date | null;
  addedAt: Date;
};

type YoutubeMatchRow = {
  id: number;
  chosen: boolean;
  score: number;
  fetchedAt: Date;
};

function comparePendingRows(a: PendingQueueRow, b: PendingQueueRow) {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const aBumped = a.bumpedAt?.getTime() ?? 0;
  const bBumped = b.bumpedAt?.getTime() ?? 0;
  if (aBumped !== bBumped) return bBumped - aBumped;
  const aAdded = a.addedAt.getTime();
  const bAdded = b.addedAt.getTime();
  if (aAdded !== bAdded) return bAdded - aAdded;
  return b.id - a.id;
}

function compareYoutubeMatchRows(a: YoutubeMatchRow, b: YoutubeMatchRow) {
  if (a.chosen !== b.chosen) return Number(b.chosen) - Number(a.chosen);
  if (a.score !== b.score) return b.score - a.score;
  const aFetched = a.fetchedAt.getTime();
  const bFetched = b.fetchedAt.getTime();
  if (aFetched !== bFetched) return bFetched - aFetched;
  return b.id - a.id;
}

export function findPendingQueueDuplicateIds(rows: PendingQueueRow[]) {
  const byKey = new Map<string, PendingQueueRow[]>();

  for (const row of rows) {
    const key = typeof row.trackId === "number"
      ? `track:${row.trackId}`
      : typeof row.releaseId === "number"
        ? `release:${row.releaseId}`
        : null;
    if (!key) continue;
    const group = byKey.get(key) ?? [];
    group.push(row);
    byKey.set(key, group);
  }

  const deleteIds: number[] = [];
  let duplicateGroups = 0;

  for (const group of byKey.values()) {
    if (group.length <= 1) continue;
    duplicateGroups += 1;
    group.sort(comparePendingRows);
    for (const extra of group.slice(1)) {
      deleteIds.push(extra.id);
    }
  }

  return {
    deleteIds,
    duplicateGroups,
    scannedRows: rows.length,
  };
}

export function planChosenYoutubeMatchNormalization(rows: YoutubeMatchRow[]) {
  if (rows.length === 0) {
    return {
      chosenId: null,
      clearIds: [] as number[],
    };
  }

  const ranked = [...rows].sort(compareYoutubeMatchRows);
  const chosenId = ranked[0]?.id ?? null;
  return {
    chosenId,
    clearIds: ranked.slice(1).filter((row) => row.chosen).map((row) => row.id),
  };
}

export function planChosenYoutubeMatchSelection(rows: YoutubeMatchRow[], requestedId: number) {
  const normalized = planChosenYoutubeMatchNormalization(rows);
  const requested = rows.find((row) => row.id === requestedId) ?? null;
  if (!requested) {
    return {
      chosenId: normalized.chosenId,
      clearIds: normalized.clearIds,
      matchedRequestedId: false,
    };
  }

  return {
    chosenId: requested.id,
    clearIds: rows.filter((row) => row.id !== requested.id && row.chosen).map((row) => row.id),
    matchedRequestedId: true,
  };
}
