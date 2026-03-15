"use client";

import { Play } from "lucide-react";
import { ExternalActionLink } from "@/components/external-action-link";
import { PlaybackActionButton } from "@/components/playback-action-button";
import {
  playNowAriaLabel,
  playNowInMiniPlayerLabel,
} from "@/lib/library-action-labels";
import { useTrackQueueButtonActions } from "@/lib/use-playback-button-actions";

export function TrackQueueButtons({ trackId, youtubeSearchUrl }: { trackId: number; youtubeSearchUrl: string }) {
  const { disabled, feedback, playNow, playPending, queueLater, queuePending } = useTrackQueueButtonActions(trackId);

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
        <ExternalActionLink
          href={youtubeSearchUrl}
          title="Search this track on YouTube"
        >
          YouTube
        </ExternalActionLink>
        <PlaybackActionButton
          variant="outline"
          onClick={() => void queueLater()}
          disabled={disabled}
          title="Add to queue (plays after current/up-next items)"
          ariaLabel="Queue later"
          pending={queuePending}
          pendingChildren="Queueing..."
        >
          Queue Later
        </PlaybackActionButton>
        <PlaybackActionButton
          variant="secondary"
          fullSpan
          onClick={() => void playNow()}
          disabled={disabled}
          title={playNowInMiniPlayerLabel()}
        ariaLabel={playNowAriaLabel()}
        pending={playPending}
        pendingChildren="..."
        message={feedback}
      >
          <>
            <Play className="h-3.5 w-3.5" />
            Play Now
          </>
        </PlaybackActionButton>
      </div>
    </div>
  );
}
