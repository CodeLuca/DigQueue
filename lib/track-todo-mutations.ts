export type TrackTodoField = "listened" | "saved";
export type TrackTodoMode = "set" | "toggle";

type TrackTodoRow = {
  id: number;
  releaseId: number;
  listened: boolean;
  saved: boolean;
};

export function planTrackTodoMutation(
  track: TrackTodoRow,
  field: TrackTodoField,
  mode: TrackTodoMode,
  value?: boolean,
) {
  const currentValue = field === "listened" ? track.listened : track.saved;
  const nextValue = mode === "toggle" ? !currentValue : Boolean(value);
  const changed = nextValue !== currentValue;

  return {
    trackId: track.id,
    releaseId: track.releaseId,
    field,
    changed,
    nextValue,
    listened: field === "listened" ? nextValue : track.listened,
    saved: field === "saved" ? nextValue : track.saved,
    markPendingPlayed: field === "listened" && changed && nextValue,
    feedbackEventType:
      !changed
        ? null
        : field === "listened"
          ? (nextValue ? "listened" : null)
          : (nextValue ? "saved_add" : "saved_remove"),
  };
}

export function planTrackTodoMutations(
  tracks: TrackTodoRow[],
  field: TrackTodoField,
  mode: TrackTodoMode,
  value?: boolean,
) {
  return tracks.map((track) => planTrackTodoMutation(track, field, mode, value));
}
