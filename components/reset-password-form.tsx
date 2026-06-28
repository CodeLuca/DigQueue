"use client";

import {
  AuthActionForm,
  buildCompletePasswordResetPayload,
} from "@/components/auth-form-ui";
import { useCompletePasswordResetAction } from "@/lib/use-auth-actions";

export function ResetPasswordForm() {
  const { pending, error, run } = useCompletePasswordResetAction();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await run(buildCompletePasswordResetPayload(formData));
  };

  return (
    <AuthActionForm
      className="space-y-2"
      fields={[
        {
          label: "New credential",
          name: "password",
          type: "password",
          required: true,
          minLength: 6,
          placeholder: "New password (min 6 characters)",
        },
        {
          label: "Confirm credential",
          name: "confirmPassword",
          type: "password",
          required: true,
          minLength: 6,
          placeholder: "Confirm new password",
        },
      ]}
      error={error}
      pending={pending}
      busyLabel="Updating..."
      submitLabel="Update password"
      submitClassName="font-extrabold"
      onSubmit={onSubmit}
    />
  );
}
