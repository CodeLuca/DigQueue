"use client";

import { SourceActionButton } from "@/components/source-action-button";
import { useSourceRetryButtonAction } from "@/lib/use-source-single-actions";

export function SourceRetryButton(props: {
  labelId: number;
  canProcess?: boolean;
  processing?: boolean;
  queued?: boolean;
  className?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "secondary" | "default";
  compactLabel?: boolean;
  title?: string;
}) {
  const { pending, error, message, run } = useSourceRetryButtonAction();

  const disabled = !props.canProcess || props.processing || pending;
  const label = props.processing ? "Syncing..." : props.queued ? "Queued..." : (props.compactLabel ? "Retry" : "Sync now");

  const onClick = async () => {
    if (disabled) return;
    await run(props.labelId);
  };

  return (
    <SourceActionButton
      type="button"
      size={props.size ?? "sm"}
      variant={props.variant ?? "outline"}
      className={props.className}
      disabled={disabled}
      title={props.title ?? "Sync this source now"}
      ariaLabel={props.title ?? "Sync this source now"}
      error={error}
      message={message}
      pending={pending}
      pendingChildren="Syncing..."
      onClick={() => void onClick()}
    >
      {label}
    </SourceActionButton>
  );
}
