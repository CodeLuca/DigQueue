import type { ListenRow } from "@/lib/listen-inbox-types";

export type PlaybackQueueItem = {
  id: number;
  youtubeVideoId: string;
  priority?: number;
  source?: string;
  track?: {
    id: number;
    title: string;
    artistsText?: string | null;
    saved?: boolean;
    listened?: boolean;
    bpm?: number | null;
  } | null;
  release?: {
    id?: number;
    title: string;
    artist?: string | null;
    catno?: string | null;
    discogsUrl?: string | null;
    thumbUrl?: string | null;
    wishlist?: boolean;
  } | null;
  label?: { name: string } | null;
};

export function createOptimisticPlaybackQueueItem(row: ListenRow): PlaybackQueueItem | null {
  if (!row.youtubeVideoId) return null;
  return {
    id: -row.trackId,
    youtubeVideoId: row.youtubeVideoId,
    track: {
      id: row.trackId,
      title: row.trackTitle,
      artistsText: row.trackArtists ?? row.releaseArtist ?? null,
      saved: row.saved,
      listened: row.listened,
      bpm: row.bpm ?? null,
    },
    release: {
      id: row.releaseId,
      title: row.releaseTitle,
      artist: row.releaseArtist ?? null,
      catno: row.releaseCatno ?? null,
      discogsUrl: row.releaseDiscogsUrl,
      thumbUrl: row.releaseThumbUrl ?? null,
      wishlist: row.releaseWishlist,
    },
    label: { name: row.labelName },
  };
}
