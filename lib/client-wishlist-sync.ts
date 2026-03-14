"use client";

import type { ClientFetcher } from "@/lib/client-fetcher";
import { postClientQuery, getOptionalOkClientQuery, postOptionalOkClientQuery } from "@/lib/client-queries";
import {
  normalizeSyncSavedToDiscogsSummary,
  type SyncSavedToDiscogsSummary,
} from "@/lib/release-wishlist-sync-contract";

export type WantsSyncStatus = {
  mode: "auto" | "manual";
  status: "running" | "synced" | "throttled" | "error";
  startedAt: string;
  finishedAt?: string;
  phase?: "fetching_wants" | "updating_existing" | "importing_missing" | "complete" | "error";
  processedCount?: number;
  totalCount?: number;
  wantedCount?: number;
  loadedWantedCount?: number;
  importedMissingCount?: number;
  maxItems?: number | null;
  reason?: string;
  error?: string;
};

type WishlistSyncStatusResponse = {
  ok?: boolean;
  status?: WantsSyncStatus | null;
  error?: string;
};

type WishlistSyncClientOptions = {
  fetcher?: ClientFetcher;
};

export async function fetchWishlistSyncStatusClient(options?: WishlistSyncClientOptions) {
  const body = await getOptionalOkClientQuery<WishlistSyncStatusResponse>(
    "/api/wishlist/sync-status",
    { ...options, cache: "no-store" },
  );
  return body?.status ?? null;
}

export async function triggerWishlistAutoSyncClient(options?: WishlistSyncClientOptions) {
  const body = await postOptionalOkClientQuery<WishlistSyncStatusResponse>(
    "/api/wishlist/sync-auto",
    options,
  );
  return body?.status ?? null;
}

export async function triggerWishlistManualSyncClient(options?: WishlistSyncClientOptions) {
  const body = await postOptionalOkClientQuery<WishlistSyncStatusResponse>(
    "/api/wishlist/sync-manual",
    options,
  );
  return body?.status ?? null;
}

export async function syncSavedToDiscogsClient(options?: WishlistSyncClientOptions) {
  const body = await postClientQuery<Partial<SyncSavedToDiscogsSummary>>(
    "/api/wishlist/sync-saved-to-discogs",
    options,
  );
  return normalizeSyncSavedToDiscogsSummary(body);
}
