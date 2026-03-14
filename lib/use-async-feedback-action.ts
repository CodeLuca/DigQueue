"use client";

import { useCallback, useState } from "react";
import { useAsyncAction } from "@/lib/use-async-action";

type AsyncFeedbackRunOptions<TResult> = {
  confirmMessage?: string | null;
  mapError?: (error: unknown) => string;
  mapSuccess?: (result: TResult) => string | null;
  onSuccess?: (result: TResult) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
  resetFeedback?: boolean;
};

export function useAsyncFeedbackAction(options?: { disabled?: boolean }) {
  const action = useAsyncAction(options);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runWithFeedback = useCallback(
    async <TResult>(
      task: () => Promise<TResult>,
      runOptions?: AsyncFeedbackRunOptions<TResult>,
    ) => {
      if (runOptions?.resetFeedback !== false) {
        setError(null);
        setMessage(null);
      }

      return action.runAction(task, {
        confirmMessage: runOptions?.confirmMessage,
        onSuccess: async (result) => {
          setError(null);
          if (runOptions?.mapSuccess) {
            setMessage(runOptions.mapSuccess(result));
          }
          await runOptions?.onSuccess?.(result);
        },
        onError: async (runError) => {
          setMessage(null);
          setError(
            runOptions?.mapError
              ? runOptions.mapError(runError)
              : runError instanceof Error
                ? runError.message
                : "Request failed.",
          );
          await runOptions?.onError?.(runError);
        },
      });
    },
    [action],
  );

  return {
    error,
    message,
    pending: action.pending,
    runWithFeedback,
    setError,
    setMessage,
  };
}
