export type SyncSavedToDiscogsSummary = {
  ok: boolean;
  releaseCount: number;
  attemptedCount: number;
  skippedCount: number;
  syncedCount: number;
  failedCount: number;
  localUnconfirmedCount: number;
};

export function buildSyncSavedToDiscogsSummary(
  input: SyncSavedToDiscogsSummary,
): SyncSavedToDiscogsSummary {
  return input;
}

export function normalizeSyncSavedToDiscogsSummary(
  body: Partial<SyncSavedToDiscogsSummary> | null | undefined,
): SyncSavedToDiscogsSummary {
  return {
    ok: body?.ok === true,
    releaseCount: body?.releaseCount ?? 0,
    attemptedCount: body?.attemptedCount ?? 0,
    skippedCount: body?.skippedCount ?? 0,
    syncedCount: body?.syncedCount ?? 0,
    failedCount: body?.failedCount ?? 0,
    localUnconfirmedCount: body?.localUnconfirmedCount ?? 0,
  };
}
