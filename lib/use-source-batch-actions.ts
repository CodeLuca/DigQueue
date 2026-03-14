"use client";

import { useCallback } from "react";
import { createActionRunResult } from "@/lib/action-run-result";
import { navigateClientPath } from "@/lib/client-navigation";
import type { SourceControlAction, SourceRemediationAction } from "@/lib/source-action-contract";
import {
  dispatchSourceControl,
  dispatchSourceRemediation,
  runNormalizedSourceControl,
  runNormalizedSourceRemediation,
} from "@/lib/client-source-action-service";
import {
  formatSourceControlMessage,
  formatSourceRemediationMessage,
} from "@/lib/source-batch-feedback";
import { useAsyncFeedbackAction } from "@/lib/use-async-feedback-action";
import { useAsyncTaskAction } from "@/lib/use-async-task-action";

export function useSourceControlAction() {
  const task = useAsyncTaskAction<[SourceControlAction], Awaited<ReturnType<typeof runNormalizedSourceControl>>, string | null>(
    (action) => runNormalizedSourceControl(action),
    {
      clearResult: true,
      initialResult: null,
      mapError: (taskError) => taskError instanceof Error ? taskError.message : "Source sync action failed.",
      mapResult: (result, action) => formatSourceControlMessage(action, result),
      onSuccess: (result, action) => dispatchSourceControl(action, result),
    },
  );

  const runControl = useCallback(
    async (action: SourceControlAction, disabled?: boolean) => {
      if (disabled) return null;
      return task.run(action);
    },
    [task],
  );

  return {
    error: task.error,
    pending: task.pending,
    result: task.result,
    runControl,
  };
}

export function useSourceRemediationAction() {
  const action = useAsyncFeedbackAction();

  const runRemediation = useCallback(
    async (input: {
      action: SourceRemediationAction;
      nextPath: string;
      category?: string;
      actionLabel?: string;
      scopeLabel?: string;
      sourceIds?: number[];
      confirmMessage?: string;
    }) =>
      action.runWithFeedback(
        async () => {
          const result = await runNormalizedSourceRemediation({
            action: input.action,
            nextPath: input.nextPath,
            category: input.category,
            actionLabel: input.actionLabel,
            scopeLabel: input.scopeLabel,
            sourceIds: input.sourceIds,
          });
          dispatchSourceRemediation(input.action);
          return result;
        },
        {
          confirmMessage: input.confirmMessage,
          mapError: (runError) => runError instanceof Error ? runError.message : "Failed to run source remediation.",
          mapSuccess: (result) => formatSourceRemediationMessage(input.action, result),
        },
      ),
    [action],
  );

  return {
    error: action.error,
    message: action.message,
    pending: action.pending,
    runRemediation,
  };
}

export function useSourceControlButtonAction() {
  const { error, pending, result, runControl } = useSourceControlAction();

  const run = useCallback(
    async (action: SourceControlAction, disabled?: boolean) => runControl(action, disabled),
    [runControl],
  );

  return createActionRunResult(pending, run, { error, message: result });
}

export function useSourceRemediationButtonAction() {
  const { error, message, pending, runRemediation } = useSourceRemediationAction();

  const run = useCallback(
    async (input: {
      action: SourceRemediationAction;
      nextPath: string;
      category?: string;
      actionLabel?: string;
      scopeLabel?: string;
      sourceIds?: number[];
      confirmMessage?: string;
    }) => {
      const result = await runRemediation(input);
      if (result) {
        navigateClientPath(result.nextPath, input.nextPath);
      }
      return result;
    },
    [runRemediation],
  );

  return createActionRunResult(pending, run, { error, message });
}
