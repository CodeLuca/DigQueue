"use client";

import { Bookmark } from "lucide-react";
import { ReleaseItemActionButton } from "@/components/release-item-action-button";
import { getDiscogsWishlistActionLabels } from "@/lib/library-action-labels";
import { useReleaseWishlistButtonAction } from "@/lib/use-library-actions";

export function ReleaseWishlistButton(props: {
  releaseId: number;
  wishlisted: boolean;
}) {
  const { pending, error, run } = useReleaseWishlistButtonAction();

  const onClick = async () => {
    await run(props.releaseId);
  };

  const labels = getDiscogsWishlistActionLabels(props.wishlisted, "record");

  return (
    <ReleaseItemActionButton
      type="button"
      size="sm"
      variant={props.wishlisted ? "secondary" : "ghost"}
      className="h-9 w-9 p-0"
      title={labels.title}
      ariaLabel={labels.ariaLabel}
      error={error}
      pending={pending}
      onClick={() => void onClick()}
    >
      <Bookmark className="h-5 w-5 stroke-[2.25]" />
    </ReleaseItemActionButton>
  );
}
