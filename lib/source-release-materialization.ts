import { upsertReleaseForUser } from "@/lib/library-upsert";
import { upsertSourceReleaseMapping } from "@/lib/source-release-mapping";

export async function persistReleaseUnderSourceForUser(input: {
  userId: string;
  sourceId: number;
  externalDiscogsReleaseId: number;
  releaseOrder: number;
  discoveredAt: Date;
  release: {
    title: string;
    artist: string;
    year?: number | null;
    catno?: string | null;
    discogsUrl: string;
    thumbUrl?: string | null;
    detailsFetched?: boolean;
    youtubeMatched?: boolean;
    listened?: boolean;
    wishlist?: boolean;
    matchConfidence?: number;
    processingError?: string | null;
    fetchedAt: Date;
    importSource?: string;
  };
}) {
  const persistedRelease = await upsertReleaseForUser({
    userId: input.userId,
    externalDiscogsReleaseId: input.externalDiscogsReleaseId,
    labelId: input.sourceId,
    title: input.release.title,
    artist: input.release.artist,
    year: input.release.year ?? null,
    catno: input.release.catno ?? null,
    discogsUrl: input.release.discogsUrl,
    thumbUrl: input.release.thumbUrl ?? null,
    detailsFetched: input.release.detailsFetched,
    youtubeMatched: input.release.youtubeMatched,
    listened: input.release.listened,
    wishlist: input.release.wishlist,
    matchConfidence: input.release.matchConfidence,
    processingError: input.release.processingError ?? null,
    fetchedAt: input.release.fetchedAt,
    releaseOrder: input.releaseOrder,
    importSource: input.release.importSource,
  });

  await upsertSourceReleaseMapping({
    sourceId: input.sourceId,
    releaseId: persistedRelease.id,
    userId: input.userId,
    releaseOrder: input.releaseOrder,
    discoveredAt: input.discoveredAt,
  });

  return persistedRelease;
}
