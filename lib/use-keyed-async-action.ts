"use client";

import { useCallback, useState } from "react";

type KeyedAsyncActionOptions = {
  disabled?: boolean;
};

type RunKeyedActionOptions<TResult> = {
  confirmMessage?: string | null;
  onSuccess?: (result: TResult) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
  mapError?: (error: unknown) => string | null;
  successMessage?: string | null;
};

export function useKeyedAsyncAction<TKey extends string | number>(
  options?: KeyedAsyncActionOptions,
) {
  const [pendingKey, setPendingKey] = useState<TKey | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const runAction = useCallback(
    async <TResult>(
      key: TKey,
      action: () => Promise<TResult>,
      runOptions?: RunKeyedActionOptions<TResult>,
    ) => {
      if (pendingKey !== null || options?.disabled) return null;
      if (runOptions?.confirmMessage && !window.confirm(runOptions.confirmMessage)) return null;
      setPendingKey(key);
      setFeedback(null);
      try {
        const result = await action();
        if (runOptions?.successMessage) {
          setFeedback(runOptions.successMessage);
        }
        await runOptions?.onSuccess?.(result);
        return result;
      } catch (error) {
        const nextMessage = runOptions?.mapError
          ? runOptions.mapError(error)
          : error instanceof Error
            ? error.message
            : "Request failed.";
        if (nextMessage) {
          setFeedback(nextMessage);
        }
        await runOptions?.onError?.(error);
        return null;
      } finally {
        setPendingKey((current) => (current === key ? null : current));
      }
    },
    [options?.disabled, pendingKey],
  );

  return {
    feedback,
    pendingKey,
    runAction,
    setFeedback,
  };
}
