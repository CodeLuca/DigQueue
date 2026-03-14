type ActionRunResultOptions<TResult = null> = {
  error?: string | null;
  message?: string | null;
  result?: TResult | null;
  setError?: (value: string | null) => void;
};

export function createActionRunResult<TRun, TResult = null>(
  pending: boolean,
  run: TRun,
  options?: ActionRunResultOptions<TResult>,
) {
  return {
    error: options?.error ?? null,
    message: options?.message ?? null,
    pending,
    result: options?.result ?? null,
    run,
    setError: options?.setError,
  };
}
