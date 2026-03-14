export type TrackTodoUpdate = {
  trackId: number;
  listened: boolean;
  saved: boolean;
};

type TrackTodoLike = {
  id?: number;
  trackId?: number;
  listened: boolean;
  saved: boolean;
};

export function toTrackTodoUpdate(track: TrackTodoLike): TrackTodoUpdate {
  return {
    trackId: typeof track.trackId === "number" ? track.trackId : Number(track.id),
    listened: track.listened,
    saved: track.saved,
  };
}

export function mapTrackTodoUpdates<TTrack extends TrackTodoLike>(tracks: TTrack[]) {
  return tracks.map(toTrackTodoUpdate);
}
