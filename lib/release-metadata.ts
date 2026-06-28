import type { DiscogsRelease } from "@/lib/discogs";

export type ReleaseMetadataPatch = {
  artist?: string;
  catno?: string | null;
  thumbUrl?: string | null;
  title?: string;
  year?: number | null;
};

function cleanText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") || null;
}

function cleanKnownArtist(value: string | null | undefined) {
  const artist = cleanText(value);
  return artist && artist !== "Unknown Artist" ? artist : null;
}

export function deriveReleaseMetadataFromDiscogs(
  release: DiscogsRelease,
  fallback?: { artist?: string | null; title?: string | null },
): ReleaseMetadataPatch {
  const artist =
    cleanKnownArtist(release.artists_sort) ||
    cleanKnownArtist(release.artists?.map((item) => item.name).filter(Boolean).join(", ")) ||
    cleanKnownArtist(fallback?.artist) ||
    undefined;
  const title = cleanText(release.title) || cleanText(fallback?.title) || undefined;
  const catno = cleanText(release.labels?.map((item) => cleanText(item.catno)).find(Boolean) ?? null);
  const image = release.images?.find((item) => cleanText(item.uri150) || cleanText(item.uri));
  const thumbUrl = cleanText(image?.uri150) || cleanText(image?.uri) || undefined;
  const year = typeof release.year === "number" && Number.isFinite(release.year) && release.year > 0 ? release.year : null;

  return {
    ...(artist ? { artist } : {}),
    ...(title ? { title } : {}),
    catno,
    thumbUrl,
    year,
  };
}

export function needsReleaseMetadataRepair(input: {
  artist: string | null;
  catno: string | null;
  thumbUrl: string | null;
  title: string | null;
  year: number | null;
}) {
  return (
    !cleanText(input.artist) ||
    cleanText(input.artist) === "Unknown Artist" ||
    !cleanText(input.title) ||
    !cleanText(input.catno) ||
    !cleanText(input.thumbUrl) ||
    input.year == null
  );
}
