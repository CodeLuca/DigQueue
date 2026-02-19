"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SyncSavedToDiscogsButton({ enabled }: { enabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    if (!enabled || pending) return;
    const confirmed = window.confirm(
      "Warning: this will add records for your saved tracks to Discogs wishlist. Already wishlisted records are skipped. Continue?",
    );
    if (!confirmed) return;

    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/wishlist/sync-saved-to-discogs", { method: "POST" });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; releaseCount?: number; attemptedCount?: number; skippedCount?: number; syncedCount?: number; failedCount?: number }
        | null;

      if (!response.ok) {
        setMessage("Failed to send saved tracks to Discogs wishlist.");
        return;
      }

      const releaseCount = body?.releaseCount ?? 0;
      const attemptedCount = body?.attemptedCount ?? 0;
      const skippedCount = body?.skippedCount ?? 0;
      const syncedCount = body?.syncedCount ?? 0;
      const failedCount = body?.failedCount ?? 0;
      if (releaseCount === 0) {
        setMessage("No saved tracks found.");
        return;
      }

      if (attemptedCount === 0 && skippedCount > 0) {
        setMessage(`Nothing to send. ${skippedCount} already in Discogs wishlist.`);
        window.location.reload();
        return;
      }

      if (failedCount > 0) {
        setMessage(`Sent ${syncedCount}/${attemptedCount}, skipped ${skippedCount}. ${failedCount} failed.`);
      } else {
        setMessage(`Sent ${syncedCount} records, skipped ${skippedCount} already wishlisted.`);
      }

      window.location.reload();
    } catch {
      setMessage("Failed to send saved tracks to Discogs wishlist.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <Button type="button" size="sm" variant="secondary" disabled={!enabled || pending} onClick={() => void run()}>
        {pending ? "Sending..." : "Send Saved To Discogs Wishlist"}
      </Button>
      {message ? <p className="text-xs text-[var(--color-muted)]">{message}</p> : null}
    </div>
  );
}
