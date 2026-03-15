"use client";

import { MutationActionButton } from "@/components/mutation-action-button";
import { responsiveActionWidthClassName } from "@/components/responsive-action-button-layout";
import { useApiKeyTestAction } from "@/lib/use-account-settings-actions";

export function ApiKeyTester() {
  const { pending, result, error, run } = useApiKeyTestAction();

  return (
    <MutationActionButton
      preset="account"
      variant="secondary"
      className={responsiveActionWidthClassName()}
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
    </MutationActionButton>
  );
}
