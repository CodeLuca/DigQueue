"use client";

import type { PasswordResetNoticeResponse } from "@/lib/auth-mutation-contract";
import { createActionRunResult } from "@/lib/action-run-result";
import { navigateClientAccountRedirect } from "@/lib/client-account-navigation";
import {
  completePasswordResetClient,
  loginWithPasswordClient,
  registerWithPasswordClient,
  requestPasswordResetClient,
} from "@/lib/client-auth-actions";
import { useAsyncTaskAction } from "@/lib/use-async-task-action";

function useAuthRedirectAction<TPayload>(
  action: (payload: TPayload) => Promise<{ redirectTo: string }>,
  options: {
    fallbackRedirect: string;
    defaultErrorMessage: string;
  },
) {
  const { pending, error, setError, run } = useAsyncTaskAction<[TPayload], { redirectTo: string }, null>(
    action,
    {
      clearResult: true,
      initialResult: null,
      mapError: (submitError) => submitError instanceof Error ? submitError.message : options.defaultErrorMessage,
      mapResult: () => null,
      onSuccess: (result) => navigateClientAccountRedirect(result.redirectTo, options.fallbackRedirect),
    },
  );

  return createActionRunResult<typeof run>(pending, run, { error, setError });
}

export function useLoginWithPasswordAction(nextPath: string) {
  return useAuthRedirectAction(
    loginWithPasswordClient,
    { fallbackRedirect: nextPath, defaultErrorMessage: "Login failed." },
  );
}

export function useRegisterWithPasswordAction(nextPath: string) {
  return useAuthRedirectAction(
    registerWithPasswordClient,
    { fallbackRedirect: nextPath, defaultErrorMessage: "Registration failed." },
  );
}

export function useCompletePasswordResetAction() {
  return useAuthRedirectAction(
    completePasswordResetClient,
    { fallbackRedirect: "/login", defaultErrorMessage: "Password update failed." },
  );
}

export function usePasswordResetRequestAction() {
  const { pending, error, result, run } = useAsyncTaskAction<[string], PasswordResetNoticeResponse>(
    (email) => requestPasswordResetClient({ email }),
    {
      clearResult: true,
      mapError: (submitError) => submitError instanceof Error ? submitError.message : "Password reset request failed.",
    },
  );

  return createActionRunResult<typeof run, PasswordResetNoticeResponse>(pending, run, { error, result });
}
