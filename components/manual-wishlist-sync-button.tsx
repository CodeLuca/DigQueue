"use client";

import { InlineActionButton } from "@/components/inline-action-button";
import { useManualWishlistSyncAction } from "@/lib/use-wishlist-sync-actions";

export function ManualWishlistSyncButton({
  enabled,
  compact = false,
  importLabel = false,
  className,
  mobileFullWidth = false,
}: {
  enabled: boolean;
  compact?: boolean;
  importLabel?: boolean;
  className?: string;
  mobileFullWidth?: boolean;
}) {
  const { pending, error, message, run } = useManualWishlistSyncAction(enabled);

  const label = importLabel ? "Import recent wishlist records" : compact ? "Run sync" : "Run sync now";

  return (
    <InlineActionButton
      className={className}
      disabled={!enabled}
      error={error}
      message={message}
      mobileFullWidth={mobileFullWidth}
      pending={pending}
      pendingChildren={importLabel ? "Importing..." : "Syncing..."}
      onClick={() => void run()}
      title="Imports your most recent 200 Discogs wants into Library and refreshes local wishlist state."
      variant="outline"
    >
      {label}
    </InlineActionButton>
  );
}
