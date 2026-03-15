"use client";

import { ReleaseItemActionButton } from "@/components/release-item-action-button";
import { chooseMatchLabel } from "@/lib/library-action-labels";
import { useChooseMatchButtonAction } from "@/lib/use-library-actions";

export function ChooseMatchButton(props: {
  trackId: number;
  matchId: number;
}) {
  const { pending, error, run } = useChooseMatchButtonAction();

  const onClick = async () => {
    await run(props.trackId, props.matchId);
  };

  return (
    <ReleaseItemActionButton
      size="sm"
      type="button"
      variant="ghost"
      title={chooseMatchLabel(pending)}
      ariaLabel={chooseMatchLabel(pending)}
      error={error}
      pending={pending}
      pendingChildren="Choosing..."
      onClick={() => void onClick()}
    >
      Choose
    </ReleaseItemActionButton>
  );
}
