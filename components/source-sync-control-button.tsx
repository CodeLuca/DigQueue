"use client";

import { MutationActionButton } from "@/components/mutation-action-button";
import type { SourceControlAction } from "@/lib/source-action-contract";
import { useSourceControlButtonAction } from "@/lib/use-source-batch-actions";

function labelFor(action: SourceControlAction, compact: boolean) {
  if (action === "start") return compact ? "Start" : "Start sync";
  if (action === "pause") return compact ? "Pause" : "Pause sync";
  return compact ? "Retry" : "Retry errors";
}

function pendingLabelFor(action: SourceControlAction) {
  if (action === "start") return "Starting...";
  if (action === "pause") return "Pausing...";
  return "Retrying...";
}

export function SourceSyncControlButton({
  action,
  disabled,
  compact = false,
  variant = "outline",
  className,
  title,
}: {
  action: SourceControlAction;
  disabled?: boolean;
  compact?: boolean;
  variant?: "default" | "secondary" | "outline" | "ghost";
  className?: string;
  title?: string;
}) {
  const { pending, error, message, run } = useSourceControlButtonAction();

  const onClick = async () => {
    await run(action, disabled);
  };

  return (
    <MutationActionButton
      preset="inline"
      className={className}
      disabled={disabled}
      error={error}
      message={message}
      pending={pending}
      pendingChildren={pendingLabelFor(action)}
      onClick={() => void onClick()}
      title={title}
      variant={variant}
    >
      {labelFor(action, compact)}
    </MutationActionButton>
  );
}
