import type { TrackTodoField } from "@/lib/client-library-events";

type TrackTodoState = {
  id: number;
  saved?: boolean;
  listened?: boolean;
};

export function applyTrackTodoToTrackState<TTrack extends TrackTodoState>(
  track: TTrack,
  field: TrackTodoField,
  value: boolean,
) {
  return {
    ...track,
    [field]: value,
  };
}

export function mapItemsByTrackTodoUpdate<T>(
  items: T[],
  input: { trackId: number; field: TrackTodoField; value: boolean },
  getTrackId: (item: T) => number | null | undefined,
  updateItem: (item: T, field: TrackTodoField, value: boolean) => T,
) {
  return items.map((item) =>
    getTrackId(item) === input.trackId ? updateItem(item, input.field, input.value) : item,
  );
}
