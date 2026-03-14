"use client";

import { useAsyncFeedbackAction } from "@/lib/use-async-feedback-action";
import {
  dispatchWishlistSyncMutated,
} from "@/lib/client-wishlist-sync-events";
import type { WantsSyncStatus } from "@/lib/client-wishlist-sync";
import {
  syncSavedToDiscogsClient,
  triggerWishlistManualSyncClient,
} from "@/lib/client-wishlist-sync";

function formatManualWishlistSyncMessage(status: WantsSyncStatus | null) {
  if (!status) return "Failed to run Discogs wishlist sync.";
  if (status.status === "error") return status.error || "Discogs wishlist sync failed.";
  const imported = status.importedMissingCount ?? 0;
  const wanted = status.wantedCount ?? 0;
  return imported > 0
    ? `Imported ${imported} wishlist records from ${wanted} wants.`
    : `Scanned ${wanted} wants. No new records imported.`;
}

function formatSavedToDiscogsMessage(result: Awaited<ReturnType<typeof syncSavedToDiscogsClient>>) {
  if (!result.ok && result.releaseCount === 0 && result.attemptedCount === 0 && result.syncedCount === 0) {
    return "Failed to send saved tracks to Discogs wishlist.";
  }

  const releaseCount = result.releaseCount;
  const attemptedCount = result.attemptedCount;
  const skippedCount = result.skippedCount;
  const syncedCount = result.syncedCount;
  const failedCount = result.failedCount + (result.localUnconfirmedCount ?? 0);

  if (releaseCount === 0) {
    return "No saved tracks found.";
  }

  if (attemptedCount === 0 && skippedCount > 0) {
    return `Nothing to send. ${skippedCount} already in Discogs wishlist.`;
  }

  if (failedCount > 0) {
    return `Sent ${syncedCount}/${attemptedCount}, skipped ${skippedCount}. ${failedCount} failed.`;
  }

  return `Sent ${syncedCount} records, skipped ${skippedCount} already wishlisted.`;
}

export function useManualWishlistSyncAction(enabled: boolean) {
  const action = useAsyncFeedbackAction({ disabled: !enabled });

  const runSync = async () => {
    await action.runWithFeedback(
      async () => {
        const status = await triggerWishlistManualSyncClient();
        if (status) dispatchWishlistSyncMutated({ reason: "manual" });
        return status;
      },
      {
        mapError: (runError) => runError instanceof Error ? runError.message : "Failed to run Discogs wishlist sync.",
        mapSuccess: (status) => formatManualWishlistSyncMessage(status),
      },
    );
  };

  return { error: action.error, pending: action.pending, message: action.message, run: runSync };
}

export function useSyncSavedToDiscogsAction(enabled: boolean) {
  const action = useAsyncFeedbackAction({ disabled: !enabled });

  const runSync = async () => {
    await action.runWithFeedback(
      async () => {
        const result = await syncSavedToDiscogsClient();
        if (
          result.ok ||
          result.releaseCount > 0 ||
          result.attemptedCount > 0 ||
          result.skippedCount > 0 ||
          result.syncedCount > 0 ||
          result.failedCount > 0 ||
          (result.localUnconfirmedCount ?? 0) > 0
        ) {
          dispatchWishlistSyncMutated({ reason: "saved-to-discogs" });
        }
        return result;
      },
      {
        confirmMessage: "Warning: this will add records for your saved tracks to Discogs wishlist. Already wishlisted records are skipped. Continue?",
        mapError: (runError) => runError instanceof Error ? runError.message : "Failed to send saved tracks to Discogs wishlist.",
        mapSuccess: (result) => formatSavedToDiscogsMessage(result),
      },
    );
  };

  return { error: action.error, pending: action.pending, message: action.message, run: runSync };
}
