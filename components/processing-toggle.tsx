"use client";

import { MutationActionButton } from "@/components/mutation-action-button";
import { useSourceActiveButtonAction } from "@/lib/use-source-single-actions";

export function ProcessingToggle({
  labelId,
  initialActive,
  disabled = false,
}: {
  labelId: number;
  initialActive: boolean;
  initialStatus?: string;
  disabled?: boolean;
}) {
  const { pending, error, message, run } = useSourceActiveButtonAction();

  const setRemoteActive = async (nextActive: boolean) => {
    await run(labelId, nextActive);
  };

  return (
    <MutationActionButton
      preset="source"
      size="sm"
      variant={initialActive ? "secondary" : "outline"}
      onClick={() => void setRemoteActive(!initialActive)}
      disabled={disabled || pending}
      title={initialActive ? "Deactivate label and pause ingestion" : "Activate label"}
      ariaLabel={initialActive ? "Deactivate source" : "Activate source"}
      error={error}
      message={message}
      pending={pending}
      pendingChildren="..."
    >
      {initialActive ? "Deactivate" : "Activate"}
    </MutationActionButton>
  );
}
