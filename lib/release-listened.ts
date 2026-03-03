export function deriveReleaseListenedFromTracks(tracks: Array<{ listened: boolean }>) {
  return tracks.length > 0 && tracks.every((item) => item.listened);
}
