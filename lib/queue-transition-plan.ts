export type QueueAdvanceAction = "next" | "played" | "listened" | undefined;

export type QueueTransitionPlan = {
  markQueueItemPlayed: boolean;
  markTrackListened: boolean;
  feedbackEventType: "played" | "listened" | null;
};

export function getQueueTransitionPlan(action: QueueAdvanceAction): QueueTransitionPlan {
  if (action === "listened") {
    return {
      markQueueItemPlayed: true,
      markTrackListened: true,
      feedbackEventType: "listened",
    };
  }
  if (action === "played") {
    return {
      markQueueItemPlayed: true,
      markTrackListened: false,
      feedbackEventType: "played",
    };
  }
  return {
    markQueueItemPlayed: false,
    markTrackListened: false,
    feedbackEventType: null,
  };
}
