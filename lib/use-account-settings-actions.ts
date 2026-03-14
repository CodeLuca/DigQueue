"use client";

import { useState } from "react";
import type { IntegrationProvider } from "@/lib/auth-mutation-contract";
import { createActionRunResult } from "@/lib/action-run-result";
import type { ApiKeyTestResult, YoutubePlaylistExportResult } from "@/lib/client-account-settings-actions";
import { dispatchAccountStateMutated } from "@/lib/client-account-events";
import { navigateClientAccountRedirect } from "@/lib/client-account-navigation";
import {
  clearSessionClient,
  disconnectIntegrationClient,
  exportYoutubePlaylistClient,
  testApiKeysClient,
} from "@/lib/client-account-settings-actions";
import { useAsyncAction } from "@/lib/use-async-action";
import { useAsyncTaskAction } from "@/lib/use-async-task-action";

export function useSignOutAction() {
  const { pending, runAction } = useAsyncAction();

  const run = async () => {
    await runAction(
      () => clearSessionClient(),
      {
        onSuccess: (result) => {
          dispatchAccountStateMutated({ reason: "session_clear" });
          navigateClientAccountRedirect(result.redirectTo, "/login");
        },
      },
    );
  };

  return createActionRunResult<typeof run>(pending, run);
}

export function useIntegrationDisconnectAction(provider: IntegrationProvider) {
  const { pending, runAction } = useAsyncAction();

  const run = async (confirmMessage: string) => {
    await runAction(
      () => disconnectIntegrationClient(provider),
      {
        confirmMessage,
        onSuccess: () => dispatchAccountStateMutated({ reason: "integration_disconnect", provider }),
      },
    );
  };

  return createActionRunResult<typeof run>(pending, run);
}

export function useApiKeyTestAction() {
  const { pending, result, error, run } = useAsyncTaskAction<[], ApiKeyTestResult>(
    () => testApiKeysClient(),
    {
      clearResult: true,
      mapError: () => "Key test request failed.",
    },
  );

  return createActionRunResult<typeof run, ApiKeyTestResult>(pending, run, { error, result });
}

export function useYoutubePlaylistExportAction() {
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const { pending, error, result, run } = useAsyncTaskAction<
    [{ title: string; visibility: "private" | "unlisted" | "public" }],
    YoutubePlaylistExportResult,
    string | null
  >(
    (payload) => exportYoutubePlaylistClient(payload),
    {
      clearResult: true,
      initialResult: null,
      mapError: (taskError) => taskError instanceof Error ? taskError.message : "Unable to export playlist.",
      mapResult: (data) => {
        const skipped = Number(data.skippedByLimit || 0);
        return skipped > 0
          ? `Playlist created with ${data.added ?? 0} tracks. ${skipped} extra tracks were skipped (limit 200).`
          : `Playlist created with ${data.added ?? 0} tracks.`;
      },
      onSuccess: (data) => setPlaylistUrl(data.playlistUrl || null),
    },
  );

  return {
    ...createActionRunResult<typeof run, string>(pending, run, { error, result }),
    playlistUrl,
  };
}
