"use client";

import { useCallback } from "react";
import { createActionRunResult } from "@/lib/action-run-result";
import {
  dispatchSourceActive,
  dispatchSourceMutation,
  runNormalizedSourceActiveMutation,
  runNormalizedSourceDeleteMutation,
  runNormalizedSourceMutation,
} from "@/lib/client-source-action-service";
import { useAsyncFeedbackAction } from "@/lib/use-async-feedback-action";
import { useAsyncTaskAction } from "@/lib/use-async-task-action";

export function useSingleSourceAction() {
  const action = useAsyncFeedbackAction();

  const runRetry = useCallback(
    async (sourceId: number) =>
      action.runWithFeedback(
        async () => {
          const result = await runNormalizedSourceMutation(
            `/api/labels/${sourceId}/retry`,
            "Failed to retry source.",
            sourceId,
          );
          dispatchSourceMutation("retry", sourceId, { active: true, status: "processing" });
          return result;
        },
        {
          mapError: (runError) => runError instanceof Error ? runError.message : "Failed to retry source.",
          mapSuccess: () => "Source queued for sync.",
        },
      ),
    [action],
  );

  const runRefresh = useCallback(
    async (sourceId: number) =>
      action.runWithFeedback(
        async () => {
          const result = await runNormalizedSourceMutation(
            `/api/labels/${sourceId}/refresh`,
            "Failed to refresh source info.",
            sourceId,
          );
          dispatchSourceMutation("refresh", sourceId);
          return result;
        },
        {
          mapError: (runError) => runError instanceof Error ? runError.message : "Failed to refresh source info.",
          mapSuccess: () => "Source info refreshed.",
        },
      ),
    [action],
  );

  const runDelete = useCallback(
    async (sourceId: number, confirmMessage: string) =>
      action.runWithFeedback(
        async () => {
          const result = await runNormalizedSourceDeleteMutation(
            `/api/labels/${sourceId}`,
            "Failed to delete source.",
            sourceId,
          );
          dispatchSourceMutation("delete", result.sourceId);
          return result;
        },
        {
          confirmMessage,
          mapError: (runError) => runError instanceof Error ? runError.message : "Failed to delete source.",
          mapSuccess: () => "Source deleted.",
        },
      ),
    [action],
  );

  return {
    error: action.error,
    message: action.message,
    pending: action.pending,
    runDelete,
    runRefresh,
    runRetry,
  };
}

export function useSourceActiveAction() {
  const task = useAsyncTaskAction<[number, boolean], Awaited<ReturnType<typeof runNormalizedSourceActiveMutation>>, string | null>(
    (sourceId, nextActive) => runNormalizedSourceActiveMutation(sourceId, nextActive),
    {
      initialResult: null,
      mapError: (taskError) => taskError instanceof Error ? taskError.message : "Activation update failed.",
      mapResult: (_result, _sourceId, nextActive) => nextActive ? "Source activated." : "Source deactivated.",
      onSuccess: (result) => dispatchSourceActive(result),
    },
  );

  return {
    error: task.error,
    message: task.result ?? null,
    pending: task.pending,
    runSetActive: task.run,
  };
}

export function useSourceRetryButtonAction() {
  const { error, message, pending, runRetry } = useSingleSourceAction();

  const run = useCallback(
    async (sourceId: number) => runRetry(sourceId),
    [runRetry],
  );

  return createActionRunResult(pending, run, { error, message });
}

export function useSourceRefreshButtonAction() {
  const { error, message, pending, runRefresh } = useSingleSourceAction();

  const run = useCallback(
    async (sourceId: number) => runRefresh(sourceId),
    [runRefresh],
  );

  return createActionRunResult(pending, run, { error, message });
}

export function useSourceDeleteButtonAction() {
  const { error, message, pending, runDelete } = useSingleSourceAction();

  const run = useCallback(
    async (sourceId: number, confirmMessage: string) => runDelete(sourceId, confirmMessage),
    [runDelete],
  );

  return createActionRunResult(pending, run, { error, message });
}

export function useSourceActiveButtonAction() {
  const { error, message, pending, runSetActive } = useSourceActiveAction();

  const run = useCallback(
    async (sourceId: number, nextActive: boolean) => runSetActive(sourceId, nextActive),
    [runSetActive],
  );

  return createActionRunResult(pending, run, { error, message });
}
