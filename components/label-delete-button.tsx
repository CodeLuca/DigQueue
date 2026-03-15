"use client";

import { SourceActionButton } from "@/components/source-action-button";
import { useSourceDeleteButtonAction } from "@/lib/use-source-single-actions";

export function LabelDeleteButton({ labelId, labelName }: { labelId: number; labelName: string }) {
  const { pending, error, message, run } = useSourceDeleteButtonAction();

  const onClick = async () => {
    await run(labelId, `Delete label "${labelName}"? This also removes its releases, tracks, and queue items.`);
  };

  return (
    <SourceActionButton
      type="button"
      size="sm"
      variant="destructive"
      ariaLabel={`Delete source ${labelName}`}
      title={`Delete source ${labelName}`}
      error={error}
      message={message}
      pending={pending}
      pendingChildren="Deleting..."
      onClick={() => void onClick()}
    >
      Delete
    </SourceActionButton>
  );
}
