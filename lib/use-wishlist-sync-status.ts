"use client";

import { getLatestWishlistSyncStatusClient, subscribeWishlistSyncStatusClient } from "@/lib/wishlist-sync-client-store";
import { useClientStoreValue } from "@/lib/use-client-store-value";

export function useWishlistSyncStatus(initialStatus: ReturnType<typeof getLatestWishlistSyncStatusClient>) {
  const status = useClientStoreValue(
    (callback) => subscribeWishlistSyncStatusClient(() => callback(), { emitLatest: true }),
    () => getLatestWishlistSyncStatusClient() ?? initialStatus,
  );

  return {
    status,
  };
}
