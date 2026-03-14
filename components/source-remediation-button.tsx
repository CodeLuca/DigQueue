"use client";

import { MutationActionButton } from "@/components/mutation-action-button";
import type { SourceRemediationAction } from "@/lib/source-action-contract";
import { useSourceRemediationButtonAction } from "@/lib/use-source-batch-actions";

export function SourceRemediationButton({
  action,
  nextPath,
  category,
  actionLabel,
  scopeLabel,
  sourceIds,
  confirmMessage,
  pendingText,
  className,
  variant = "outline",
  size = "sm",
  title,
  children,
}: {
  action: SourceRemediationAction;
  nextPath: string;
  category?: string;
  actionLabel?: string;
  scopeLabel?: string;
  sourceIds?: number[];
  confirmMessage?: string;
  pendingText?: string;
  className?: string;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "sm" | "default";
  title?: string;
  children: React.ReactNode;
}) {
  const { error, message, pending, run } = useSourceRemediationButtonAction();

  const onClick = async () => {
    await run({
      action,
      nextPath,
      category,
      actionLabel,
      scopeLabel,
      sourceIds,
      confirmMessage,
    });
  };

  return (
    <MutationActionButton
      preset="inline"
      size={size}
      variant={variant}
      className={className}
      title={title}
      error={error}
      message={message}
      pending={pending}
      pendingChildren={pendingText || "Working..."}
      onClick={() => void onClick()}
    >
      {children}
    </MutationActionButton>
  );
}
