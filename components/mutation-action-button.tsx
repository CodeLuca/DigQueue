"use client";

import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

type MutationActionButtonPreset =
  | "account"
  | "inline"
  | "playback"
  | "recommendation"
  | "releaseItem"
  | "source";

function resolvePreset(preset?: MutationActionButtonPreset) {
  switch (preset) {
    case "account":
      return {
        layout: "stack" as const,
        variant: "outline" as const,
      };
    case "inline":
      return {
        layout: "inline" as const,
        variant: "outline" as const,
      };
    case "playback":
      return {
        layout: "stack" as const,
        messageClassName: "max-w-full text-[11px] text-[var(--color-muted)] sm:max-w-[220px] sm:text-right",
      };
    case "recommendation":
      return {
        layout: "stack" as const,
        messageClassName: "text-[11px] text-[var(--color-muted)]",
      };
    case "releaseItem":
      return {
        layout: "stack" as const,
        errorClassName: "text-[11px] text-rose-300",
      };
    case "source":
      return {
        layout: "stack" as const,
        messageClassName: "text-[11px] text-[var(--color-muted)]",
        errorClassName: "text-[11px] text-rose-300",
      };
    default:
      return {};
  }
}

export function MutationActionButton({
  ariaLabel,
  children,
  className,
  disabled,
  error,
  message,
  onClick,
  pending,
  pendingChildren,
  size = "sm",
  title,
  type = "button",
  variant,
  layout = "stack",
  preset,
  messageClassName,
  errorClassName,
}: {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  error?: ReactNode;
  message?: ReactNode;
  onClick: () => void;
  pending?: boolean;
  pendingChildren?: ReactNode;
  size?: ButtonProps["size"];
  title?: string;
  type?: "button" | "submit" | "reset";
  variant?: ButtonProps["variant"];
  layout?: "stack" | "inline";
  preset?: MutationActionButtonPreset;
  messageClassName?: string;
  errorClassName?: string;
}) {
  const resolvedPreset = resolvePreset(preset);
  const resolvedLayout = resolvedPreset.layout ?? layout;
  const resolvedVariant = variant ?? resolvedPreset.variant ?? "outline";
  const resolvedMessageClassName = messageClassName ?? resolvedPreset.messageClassName;
  const resolvedErrorClassName = errorClassName ?? resolvedPreset.errorClassName;

  const containerClassName =
    resolvedLayout === "inline"
      ? "flex flex-col items-start gap-2 sm:flex-row sm:items-center"
      : "space-y-2";

  return (
    <div className={containerClassName}>
      <Button
        type={type}
        size={size}
        variant={resolvedVariant}
        className={className}
        disabled={disabled || pending}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
      >
        {pending && pendingChildren ? pendingChildren : children}
      </Button>
      {message ? <div className={resolvedMessageClassName ?? "text-xs text-[var(--color-muted)]"}>{message}</div> : null}
      {error ? <div className={resolvedErrorClassName ?? "text-xs text-rose-300"}>{error}</div> : null}
    </div>
  );
}
