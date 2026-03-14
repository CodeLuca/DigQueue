"use client";

import { useState } from "react";

type AsyncActionRunOptions<TResult> = {
  confirmMessage?: string | null;
  onSuccess?: (result: TResult) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
};

export function useAsyncAction(options?: { disabled?: boolean }) {
  const [pending, setPending] = useState(false);

  const runAction = async <TResult>(
    action: () => Promise<TResult>,
    runOptions?: AsyncActionRunOptions<TResult>,
  ) => {
    if (pending || options?.disabled) return null;
    if (runOptions?.confirmMessage && !window.confirm(runOptions.confirmMessage)) return null;
    setPending(true);
    try {
      const result = await action();
      await runOptions?.onSuccess?.(result);
      return result;
    } catch (error) {
      await runOptions?.onError?.(error);
      return null;
    } finally {
      setPending(false);
    }
  };

  return {
    pending,
    runAction,
  };
}
