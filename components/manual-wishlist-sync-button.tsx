"use client";

import { MutationActionButton } from "@/components/mutation-action-button";
import { useManualWishlistSyncAction } from "@/lib/use-wishlist-sync-actions";

export function ManualWishlistSyncButton({
  enabled,
  compact = false,
  importLabel = false,
  className,
}: {
  enabled: boolean;
  compact?: boolean;
  importLabel?: boolean;
  className?: string;
}) {
  const { pending, error, message, run } = useManualWishlistSyncAction(enabled);

  const label = importLabel ? "Import recent wishlist records" : compact ? "Run sync" : "Run sync now";

  return (
    <MutationActionButton
      preset="inline"
      className={className}
      disabled={!enabled}
      error={error}
      message={message}
      pending={pending}
      pendingChildren={importLabel ? "Importing..." : "Syncing..."}
      onClick={() => void run()}
      title="Imports your most recent 200 Discogs wants into Library and refreshes local wishlist state."
      variant="outline"
    >
      {label}
    </MutationActionButton>
  );
}
