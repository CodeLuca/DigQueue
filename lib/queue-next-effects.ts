export type QueueNextEffectPlan = {
  markQueueItemPlayed: boolean;
  markTrackListened: boolean;
  markPendingTrackQueueItemsPlayed: boolean;
  refreshReleaseListened: boolean;
  shouldLogFeedback: boolean;
  feedbackEventType: "played" | "listened" | null;
};

export function buildQueueNextEffectPlan(input: {
  currentId?: number;
  transitionPlan: {
    markQueueItemPlayed: boolean;
    markTrackListened: boolean;
    feedbackEventType: "played" | "listened" | null;
  };
  item?: {
    trackId?: number | null;
    releaseId?: number | null;
  } | null;
  track?: {
    listened?: boolean | null;
  } | null;
}) : QueueNextEffectPlan {
  const hasCurrentId = typeof input.currentId === "number" && input.currentId > 0;
  const hasTrackId = typeof input.item?.trackId === "number" && input.item.trackId > 0;
  const hasReleaseId = typeof input.item?.releaseId === "number" && input.item.releaseId > 0;
  const trackAlreadyListened = input.track?.listened === true;
  const playedOnly = hasCurrentId && input.transitionPlan.markQueueItemPlayed && !input.transitionPlan.markTrackListened;
  const listened = hasCurrentId && input.transitionPlan.markTrackListened;

  if (playedOnly) {
    return {
      markQueueItemPlayed: true,
      markTrackListened: false,
      markPendingTrackQueueItemsPlayed: false,
      refreshReleaseListened: false,
      shouldLogFeedback: Boolean(input.transitionPlan.feedbackEventType),
      feedbackEventType: input.transitionPlan.feedbackEventType,
    };
  }

  if (listened) {
    const shouldApplyListenedMutation = hasTrackId && !trackAlreadyListened;
    return {
      markQueueItemPlayed: true,
      markTrackListened: shouldApplyListenedMutation,
      markPendingTrackQueueItemsPlayed: shouldApplyListenedMutation,
      refreshReleaseListened: shouldApplyListenedMutation && hasReleaseId,
      shouldLogFeedback: shouldApplyListenedMutation && Boolean(input.transitionPlan.feedbackEventType),
      feedbackEventType: shouldApplyListenedMutation ? input.transitionPlan.feedbackEventType : null,
    };
  }

  return {
    markQueueItemPlayed: false,
    markTrackListened: false,
    markPendingTrackQueueItemsPlayed: false,
    refreshReleaseListened: false,
    shouldLogFeedback: false,
    feedbackEventType: null,
  };
}
