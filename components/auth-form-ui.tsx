"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { HighlightActionButton } from "@/components/highlight-action";

const authInputClassName =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40";

function readFormValue(formData: FormData, key: string) {
  return String(formData.get(key) || "");
}

export function buildLoginFormPayload(formData: FormData, next: string) {
  return {
    email: readFormValue(formData, "email"),
    password: readFormValue(formData, "password"),
    next,
  };
}

export function buildRegisterFormPayload(formData: FormData, next: string) {
  return {
    email: readFormValue(formData, "email"),
    password: readFormValue(formData, "password"),
    confirmPassword: readFormValue(formData, "confirmPassword"),
    next,
  };
}

export function buildPasswordResetRequestPayload(formData: FormData) {
  return readFormValue(formData, "email");
}

export function buildCompletePasswordResetPayload(formData: FormData) {
  return {
    password: readFormValue(formData, "password"),
    confirmPassword: readFormValue(formData, "confirmPassword"),
  };
}

export function AuthTextInput(props: ComponentPropsWithoutRef<"input">) {
  return <input {...props} className={authInputClassName} />;
}

export function AuthFeedbackMessage({
  children,
  tone,
  className = "",
}: {
  children: ReactNode;
  tone: "error" | "success";
  className?: string;
}) {
  const toneClassName = tone === "error"
    ? "border-red-500/40 bg-red-500/10 text-red-200"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  return (
    <p className={`${className} rounded-md border px-3 py-2 text-sm ${toneClassName}`.trim()}>
      {children}
    </p>
  );
}

export function AuthSubmitButton({
  busyLabel,
  children,
  className = "",
  pending,
  showArrow = true,
}: {
  busyLabel: string;
  children: ReactNode;
  className?: string;
  pending: boolean;
  showArrow?: boolean;
}) {
  return (
    <HighlightActionButton
      type="submit"
      disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`.trim()}
      width="full"
      size="lg"
      weight="semibold"
    >
      {pending ? busyLabel : children}
      {showArrow ? <ArrowRight className="h-4 w-4" /> : null}
    </HighlightActionButton>
  );
}

type AuthFormField = {
  id?: string;
  name: string;
  type: string;
  required?: boolean;
  minLength?: number;
  defaultValue?: string;
  placeholder?: string;
};

export function AuthActionForm({
  busyLabel,
  children,
  className = "",
  error,
  fields,
  onSubmit,
  pending,
  submitLabel,
  success,
  successTone = "success",
  submitClassName = "",
  submitShowArrow = true,
}: {
  busyLabel: string;
  children?: ReactNode;
  className?: string;
  error?: string | null;
  fields: AuthFormField[];
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  pending: boolean;
  submitLabel: string;
  success?: ReactNode;
  successTone?: "error" | "success";
  submitClassName?: string;
  submitShowArrow?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className={className}>
      {fields.map((field) => (
        <AuthTextInput
          key={field.id ?? field.name}
          id={field.id}
          name={field.name}
          type={field.type}
          required={field.required}
          minLength={field.minLength}
          defaultValue={field.defaultValue}
          placeholder={field.placeholder}
        />
      ))}
      {children}
      {error ? <AuthFeedbackMessage tone="error">{error}</AuthFeedbackMessage> : null}
      {success ? <AuthFeedbackMessage tone={successTone}>{success}</AuthFeedbackMessage> : null}
      <AuthSubmitButton
        pending={pending}
        busyLabel={busyLabel}
        className={submitClassName}
        showArrow={submitShowArrow}
      >
        {submitLabel}
      </AuthSubmitButton>
    </form>
  );
}
