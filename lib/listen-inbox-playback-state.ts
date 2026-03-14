import type { ListenRow } from "@/lib/listen-inbox-types";

export const LISTEN_INBOX_PLAYBACK_SEARCH_HINT =
  "No linked playable video yet. Play Now will search and queue one.";

export function hasPlayableInboxVideo(row: Pick<ListenRow, "youtubeVideoId" | "playbackSource" | "videoEmbeddable">): boolean {
  return Boolean(row.youtubeVideoId) && (row.playbackSource === "discogs" || row.videoEmbeddable !== false);
}

export function getListenInboxPlaybackState(
  row: Pick<ListenRow, "youtubeVideoId" | "playbackSource" | "videoEmbeddable">,
  options: {
    disabledNotice: string;
    quotaExceeded: boolean;
  },
) {
  const hasPlayableVideo = hasPlayableInboxVideo(row);
  const disabledReason = options.quotaExceeded ? options.disabledNotice : null;

  return {
    canPlay: disabledReason === null,
    disabledReason,
    hasPlayableVideo,
    hint: hasPlayableVideo ? null : LISTEN_INBOX_PLAYBACK_SEARCH_HINT,
  };
}
