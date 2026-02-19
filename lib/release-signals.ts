import { upsertReleaseSignals } from "@/lib/recommendations";

type DiscogsReleaseLike = {
  id: number;
  artists_sort?: string;
  artists?: Array<{ name?: string }>;
  styles?: string[];
  genres?: string[];
  country?: string;
  year?: number;
  extraartists?: Array<{ name?: string; role?: string }>;
  companies?: Array<{ name?: string }>;
  formats?: Array<{ name?: string; descriptions?: string[] }>;
};

function clean(value?: string | null) {
  if (!value) return null;
  const next = value.trim();
  return next.length > 0 ? next : null;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export async function captureReleaseSignals(
  release: DiscogsReleaseLike,
  fallbackArtist?: string | null,
  fallbackYear?: number | null,
  userId?: string,
) {
  const primaryArtist =
    clean(release.artists_sort) ??
    clean(release.artists?.[0]?.name) ??
    clean(fallbackArtist) ??
    null;
  const styles = [...(release.styles ?? []), ...(release.genres ?? [])];
  const genres = [...(release.genres ?? [])];
  const contributors = [
    ...(release.extraartists?.map((item) => item.name).filter(isDefined) ?? []),
    ...(release.extraartists?.map((item) => item.role).filter(isDefined) ?? []),
  ];
  const companies = release.companies?.map((item) => item.name).filter(isDefined) ?? [];
  const formats = [
    ...(release.formats?.map((item) => item.name).filter(isDefined) ?? []),
    ...(release.formats?.flatMap((item) => item.descriptions ?? []).filter(isDefined) ?? []),
  ];

  await upsertReleaseSignals({
    releaseId: release.id,
    primaryArtist,
    styles,
    genres,
    contributors,
    companies,
    formats,
    country: clean(release.country),
    year: release.year ?? fallbackYear ?? null,
  }, userId);
}
