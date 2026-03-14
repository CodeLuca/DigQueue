"use client";

export const PLAYBACK_DISABLED_NOTICE = "YouTube quota reached. Queue/play is temporarily disabled.";

export const LISTENING_STATION_PLAYBACK_DISABLED_NOTICE =
  `${PLAYBACK_DISABLED_NOTICE} You can still mark tracks listened.`;

export const TRACK_QUEUE_BUTTON_ERROR_NOTICE = "Unable to queue this track.";
export const TRACK_QUEUE_ERROR_NOTICE = "Unable to queue track.";
export const TRACK_QUEUE_NO_MATCH_NOTICE =
  "No playable video found yet for this track. Try again in a few seconds.";

export const MATCH_PLAY_ERROR_NOTICE = "Unable to play match.";

export const RECOMMENDATION_QUEUE_ERROR_NOTICE = "Unable to queue recommendation.";
export const RECOMMENDATION_NO_MATCH_NOTICE =
  "No playable match available yet. Open release and run matching.";
export const RECOMMENDATION_PLAY_SUCCESS_NOTICE = "Playing in bottom player.";
export const RECOMMENDATION_QUEUE_SUCCESS_NOTICE = "Queued next.";

export const REPLAY_DISABLED_NOTICE = "YouTube quota reached. Replay is temporarily disabled.";
export const REPLAY_UNAVAILABLE_NOTICE = "Track unavailable for replay.";
export const REPLAY_NO_MATCH_NOTICE = "No playable video match found for this track.";
export const REPLAY_ERROR_NOTICE = "Unable to play track.";
export const REPLAY_SUCCESS_NOTICE = "Playing again.";

export const QUEUE_END_REACHED_NOTICE = "End of queue reached.";
export const PLAYBACK_LOADING_NOTICE = "Loading in mini-player…";
export const PLAYBACK_STARTED_NOTICE = "Playing.";

export function playbackStartedNotice(hasOptimisticItem: boolean) {
  return hasOptimisticItem ? PLAYBACK_LOADING_NOTICE : PLAYBACK_STARTED_NOTICE;
}
