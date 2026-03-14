"use client";

import {
  AuthActionForm,
  buildLoginFormPayload,
} from "@/components/auth-form-ui";
import { useLoginWithPasswordAction } from "@/lib/use-auth-actions";

export function LoginPasswordForm({
  nextPath,
  defaultEmail,
}: {
  nextPath: string;
  defaultEmail?: string;
}) {
  const { pending, error, run } = useLoginWithPasswordAction(nextPath);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await run(buildLoginFormPayload(formData, nextPath));
  };

  return (
    <AuthActionForm
      className="space-y-2"
      fields={[
        {
          id: "login-email",
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
          placeholder: "Password",
        },
      ]}
      error={error}
      pending={pending}
      busyLabel="Logging in..."
      submitLabel="Login with Email"
      onSubmit={onSubmit}
    />
  );
}
