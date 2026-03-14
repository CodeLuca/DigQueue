type YoutubeMatchSelectionRow = {
  id: number;
  embeddable: boolean;
};

export function shouldAllowRequestedYoutubeMatch(
  rows: YoutubeMatchSelectionRow[],
  requestedId: number,
  options?: { embeddableOnly?: boolean },
) {
  const requested = rows.find((row) => row.id === requestedId) ?? null;
  if (!requested) return false;
  if (options?.embeddableOnly && !requested.embeddable) return false;
  return true;
}
