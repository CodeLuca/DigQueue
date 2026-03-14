"use client";

import {
  AuthActionForm,
  buildPasswordResetRequestPayload,
} from "@/components/auth-form-ui";
import { usePasswordResetRequestAction } from "@/lib/use-auth-actions";

export function PasswordResetRequestForm({ defaultEmail }: { defaultEmail?: string }) {
  const { pending, error, result, run } = usePasswordResetRequestAction();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await run(buildPasswordResetRequestPayload(formData));
  };

  return (
    <AuthActionForm
      className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] p-3"
      fields={[
        {
          name: "email",
          type: "email",
          required: true,
          defaultValue: defaultEmail,
          placeholder: "Email for reset link",
        },
      ]}
      error={error}
      pending={pending}
      busyLabel="Sending..."
      submitLabel="Send reset link"
      success={result?.notice ? (result.notice || "Password reset email sent.") : null}
      submitClassName="border-[var(--color-border)] bg-transparent !text-[var(--color-text)] shadow-none hover:bg-[var(--color-surface)]"
      submitShowArrow={false}
      onSubmit={onSubmit}
    >
      <p className="text-xs font-medium text-[var(--color-muted)]">Forgot password?</p>
    </AuthActionForm>
  );
}
