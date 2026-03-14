export type ListenRow = {
  trackId: number;
  trackTitle: string;
  trackArtists?: string | null;
  position: string;
  duration: string | null;
  bpm?: number | null;
  listened: boolean;
  saved: boolean;
  releaseId: number;
  releaseTitle: string;
  releaseCatno?: string | null;
  releaseArtist?: string | null;
  releaseDiscogsUrl: string;
  releaseThumbUrl: string | null;
  releaseWishlist: boolean;
  importSource?: string | null;
  labelId: number;
  labelName: string;
  labelActive?: boolean;
  hasChosenVideo?: boolean;
  youtubeVideoId?: string | null;
  videoEmbeddable?: boolean | null;
  playbackSource?: "discogs" | "youtube" | null;
  playedCount?: number;
  isUpNext?: boolean;
  wasPlayed?: boolean;
  needsMark?: boolean;
};

export type ListenInboxEmptyState = {
  title: string;
  detail: string;
  actionHref?: string;
  actionLabel?: string;
};
