"use client";

import {
  AuthActionForm,
  buildRegisterFormPayload,
} from "@/components/auth-form-ui";
import { useRegisterWithPasswordAction } from "@/lib/use-auth-actions";

export function RegisterPasswordForm({
  nextPath,
  defaultEmail,
}: {
  nextPath: string;
  defaultEmail?: string;
}) {
  const { pending, error, run } = useRegisterWithPasswordAction(nextPath);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await run(buildRegisterFormPayload(formData, nextPath));
  };

  return (
    <AuthActionForm
      className="space-y-2"
      fields={[
        {
          id: "register-email",
          name: "email",
          type: "email",
          required: true,
          defaultValue: defaultEmail,
          placeholder: "Email address",
        },
        {
          name: "password",
          type: "password",
          required: true,
          minLength: 6,
          placeholder: "Password (min 6 characters)",
        },
        {
          name: "confirmPassword",
          type: "password",
          required: true,
          minLength: 6,
          placeholder: "Confirm password",
        },
      ]}
      error={error}
      pending={pending}
      busyLabel="Creating account..."
      submitLabel="Create account with Email"
      onSubmit={onSubmit}
    />
  );
}
