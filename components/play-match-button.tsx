"use client";

import { Play } from "lucide-react";
import { MutationActionButton } from "@/components/mutation-action-button";
import {
  playNowAriaLabel,
  playNowInMiniPlayerLabel,
} from "@/lib/library-action-labels";
import { usePlayMatchButtonAction } from "@/lib/use-playback-button-actions";

export function PlayMatchButton({ trackId, matchId }: { trackId: number; matchId: number }) {
  const { disabled, pending, playNow } = usePlayMatchButtonAction(trackId, matchId);

  return (
    <MutationActionButton
      preset="playback"
      size="sm"
      variant="ghost"
      onClick={() => void playNow()}
      disabled={disabled}
      title={playNowInMiniPlayerLabel()}
      ariaLabel={playNowAriaLabel("match")}
      pending={pending}
      pendingChildren="..."
    >
      <Play className="h-3.5 w-3.5" />
    </MutationActionButton>
  );
}
