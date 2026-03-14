export type MissingWantItem = {
  releaseId: number;
  title: string;
  artist: string;
};

export function buildMissingWantTrackSeedPlan(input: {
  missingWanted: MissingWantItem[];
  importedReleaseIdsByExternalId: Map<number, number>;
  existingTrackReleaseIds: Set<number>;
}) {
  return input.missingWanted
    .map((item) => {
      const persistedReleaseId = input.importedReleaseIdsByExternalId.get(item.releaseId);
      if (!persistedReleaseId || input.existingTrackReleaseIds.has(persistedReleaseId)) return null;
      return {
        externalDiscogsReleaseId: item.releaseId,
        persistedReleaseId,
        title: item.title,
        artist: item.artist,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}
