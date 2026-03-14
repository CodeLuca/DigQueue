"use client";

import { useCallback, useState } from "react";

type AsyncTaskActionOptions<TArgs extends unknown[], TTaskResult, TResult> = {
  clearResult?: boolean;
  disabled?: boolean;
  initialResult?: TResult | null;
  mapError?: (error: unknown, ...args: TArgs) => string;
  mapResult?: (result: TTaskResult, ...args: TArgs) => TResult;
  onError?: (error: unknown, ...args: TArgs) => void | Promise<void>;
  onSuccess?: (result: TTaskResult, ...args: TArgs) => void | Promise<void>;
};

export function useAsyncTaskAction<TArgs extends unknown[], TTaskResult, TResult = TTaskResult>(
  task: (...args: TArgs) => Promise<TTaskResult>,
  options?: AsyncTaskActionOptions<TArgs, TTaskResult, TResult>,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TResult | null>(options?.initialResult ?? null);

  const run = useCallback(
    async (...args: TArgs) => {
      if (pending || options?.disabled) return null;

      setPending(true);
      setError(null);
      if (options?.clearResult) {
        setResult(null);
      }

      try {
        const taskResult = await task(...args);
        const mappedResult = options?.mapResult
          ? options.mapResult(taskResult, ...args)
          : (taskResult as TResult);
        setResult(mappedResult);
        await options?.onSuccess?.(taskResult, ...args);
        return taskResult;
      } catch (taskError) {
        setError(
          options?.mapError
            ? options.mapError(taskError, ...args)
            : taskError instanceof Error
              ? taskError.message
              : "Request failed.",
        );
        await options?.onError?.(taskError, ...args);
        return null;
      } finally {
        setPending(false);
      }
    },
    [options, pending, task],
  );

  return {
    error,
    pending,
    result,
    run,
    setError,
    setResult,
  };
}
