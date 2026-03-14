import {
  getDiscogsWantsSyncStatusForUser,
  syncDiscogsWantsToLocalForUser,
} from "@/lib/discogs-wants-sync";

export async function loadDiscogsWantsSyncStatusForUser(userId: string) {
  return getDiscogsWantsSyncStatusForUser(userId);
}

export async function runDiscogsWantsAutoSyncForUser(userId: string, options?: { maxItems?: number }) {
  await syncDiscogsWantsToLocalForUser(userId, {
    force: false,
    maxItems: options?.maxItems,
  });
  return getDiscogsWantsSyncStatusForUser(userId);
}

export async function runDiscogsWantsManualSyncForUser(userId: string, options?: { maxItems?: number }) {
  await syncDiscogsWantsToLocalForUser(userId, {
    force: true,
    maxItems: options?.maxItems,
  });
  return getDiscogsWantsSyncStatusForUser(userId);
}
