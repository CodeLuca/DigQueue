"use client";

import { MutationActionButton } from "@/components/mutation-action-button";
import { responsiveActionWidthClassName } from "@/components/responsive-action-button-layout";
import { cn } from "@/lib/utils";
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
    <MutationActionButton
      preset="inline"
      className={cn(mobileFullWidth && responsiveActionWidthClassName(), className)}
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
