"use client";

import { Play } from "lucide-react";
import { PlaybackActionButton } from "@/components/playback-action-button";
import {
  playNowAriaLabel,
  playNowInMiniPlayerLabel,
} from "@/lib/library-action-labels";
import { usePlayMatchButtonAction } from "@/lib/use-playback-button-actions";

export function PlayMatchButton({ trackId, matchId }: { trackId: number; matchId: number }) {
  const { disabled, pending, playNow } = usePlayMatchButtonAction(trackId, matchId);

  return (
    <PlaybackActionButton
      variant="ghost"
      onClick={() => void playNow()}
      disabled={disabled}
      title={playNowInMiniPlayerLabel()}
      ariaLabel={playNowAriaLabel("match")}
      pending={pending}
      pendingChildren="..."
    >
      <Play className="h-3.5 w-3.5" />
    </PlaybackActionButton>
  );
}
