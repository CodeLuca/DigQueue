export type QueueStateView = "all" | "needs_review" | "reviewed" | "played";

export type SourceFilter = "all" | "saved" | "wishlisted" | "saved_or_wishlisted";

export type VideoFilter = "all" | "playable" | "no_video_or_private";

export type PlaybackMode = "in_order" | "shuffle";

export type WishlistSourceFilterValue = "all" | "saved_tracks" | "wishlisted_records";

export type InboxFilterCounts = {
  all: number;
  needsReview?: number;
  reviewed?: number;
  played?: number;
  saved?: number;
  wishlisted?: number;
  savedOrWishlisted?: number;
  playable?: number;
  noVideoOrPrivate?: number;
};

export type WishlistSourceCounts = {
  all: number;
  savedTracks: number;
  wishlistedRecords: number;
};

export type ListenInboxLabelOption = {
  id: number;
  name: string;
  discogsUrl?: string;
};
