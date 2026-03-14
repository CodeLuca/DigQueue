"use client";

import { MutationActionButton } from "@/components/mutation-action-button";
import { useSyncSavedToDiscogsAction } from "@/lib/use-wishlist-sync-actions";

export function SyncSavedToDiscogsButton({ enabled }: { enabled: boolean }) {
  const { pending, error, message, run } = useSyncSavedToDiscogsAction(enabled);

  return (
    <MutationActionButton
      preset="inline"
      className="border-[var(--color-border)]"
      disabled={!enabled}
      error={error}
      message={message}
      pending={pending}
      pendingChildren="Sending..."
      onClick={() => void run()}
      title="Push releases from your locally saved tracks to your Discogs wishlist. Already-wishlisted items are skipped."
      variant="outline"
    >
      Send Saved To Discogs Wishlist
    </MutationActionButton>
  );
}
