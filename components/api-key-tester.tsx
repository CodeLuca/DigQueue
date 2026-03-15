"use client";

import { AccountActionButton } from "@/components/account-action-button";
import { useApiKeyTestAction } from "@/lib/use-account-settings-actions";

export function ApiKeyTester() {
  const { pending, result, error, run } = useApiKeyTestAction();

  return (
    <AccountActionButton
      variant="secondary"
      mobileFullWidth
      pending={pending}
      pendingChildren="Testing..."
      onClick={() => void run()}
      title="Test configured API keys"
      error={error}
      message={
        result ? (
          <div className="space-y-1">
            <p className={result.discogs.ok ? "text-emerald-300" : "text-amber-300"}>Discogs: {result.discogs.message}</p>
            <p className={result.youtube.ok ? "text-emerald-300" : "text-amber-300"}>YouTube: {result.youtube.message}</p>
          </div>
        ) : null
      }
    >
      Test Keys
    </AccountActionButton>
  );
}
