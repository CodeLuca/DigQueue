import { toDiscogsWebUrl } from "@/lib/discogs-links";
import { buildReleaseExternalLinks } from "@/lib/release-external-links";
import type { FinderLinksApiResponse, ReleaseDetailsApiResponse } from "@/lib/client-release-data";

export type CurrentReleaseContext = {
  youtubeVideoId?: string | null;
  track?: {
    artistsText?: string | null;
  } | null;
  release?: {
    id?: number;
    title?: string | null;
    artist?: string | null;
    catno?: string | null;
    discogsUrl?: string | null;
    thumbUrl?: string | null;
  } | null;
};

export function formatPlaybackTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatReleasePrice(amount?: number | null, currency?: string) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "n/a";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function buildReleaseInspectorView(input: {
  current: CurrentReleaseContext | null;
  releaseDetails: ReleaseDetailsApiResponse | null;
  releaseLinks: FinderLinksApiResponse | null;
}) {
  const { current, releaseDetails, releaseLinks } = input;
  const currentArtist =
    releaseDetails?.artists_sort?.trim() ||
    releaseDetails?.artists?.[0]?.name?.trim() ||
    null;
  const currentArtistLine =
    current?.track?.artistsText?.trim() ||
    current?.release?.artist?.trim() ||
    currentArtist ||
    "Unknown artist";
  const currentCatalogNumber =
    current?.release?.catno?.trim() ||
    releaseDetails?.labels?.[0]?.catno?.trim() ||
    null;
  const currentLabel = releaseDetails?.labels?.[0]?.name
    ? releaseDetails.labels[0].catno
      ? `${releaseDetails.labels[0].name} (${releaseDetails.labels[0].catno})`
      : releaseDetails.labels[0].name
    : null;
  const currentFormats = releaseDetails?.formats?.length
    ? releaseDetails.formats
      .map((format) => [format.name, ...(format.descriptions ?? [])].filter(Boolean).join(" / "))
      .filter(Boolean)
      .join(", ")
    : null;
  const currentGenreStyles = releaseDetails
    ? [...(releaseDetails.genres ?? []), ...(releaseDetails.styles ?? [])].filter(Boolean).join(", ") || null
    : null;
  const releaseImage = releaseDetails?.images?.[0];
  const expandedArtworkUrl = releaseImage?.uri || releaseImage?.uri150 || current?.release?.thumbUrl || null;
  const externalSearchLinks = buildReleaseExternalLinks({
    artist: currentArtistLine,
    title: current?.release?.title || releaseDetails?.title,
    label: releaseDetails?.labels?.[0]?.name,
    catno: currentCatalogNumber,
    discogsUrl: current?.release?.discogsUrl,
  });
  const discogsSearchLink = externalSearchLinks.find((link) => link.provider === "discogs") ?? null;
  const bandcampSearchLink = externalSearchLinks.find((link) => link.provider === "bandcamp_search") ?? null;
  const fallbackSearchLinks = externalSearchLinks.filter(
    (link) => link.provider !== "discogs" && link.provider !== "bandcamp_search",
  );
  const discogsReleaseUrl = releaseDetails?.uri?.trim()
    ? `https://www.discogs.com${releaseDetails.uri.trim()}`
    : current?.release?.id
      ? toDiscogsWebUrl(current.release.discogsUrl ?? "", "")
      : discogsSearchLink?.url || null;
  const releaseVideoUrl = releaseDetails?.videos?.find((video) => video?.uri?.trim())?.uri?.trim() || null;

  const marketCurrency = (() => {
    const fromStats = releaseDetails?.marketStats?.currency?.trim();
    if (fromStats) return fromStats;
    const suggestions = releaseDetails?.priceSuggestions;
    if (!suggestions) return "USD";
    for (const value of Object.values(suggestions)) {
      if (value && typeof value === "object" && typeof value.currency === "string" && value.currency.trim()) {
        return value.currency.trim();
      }
    }
    return "USD";
  })();

  const marketSpreadPercent = (() => {
    const lowest = releaseDetails?.marketStats?.lowest_price;
    const median = releaseDetails?.marketStats?.median_price;
    if (typeof lowest !== "number" || !Number.isFinite(lowest) || lowest <= 0) return null;
    if (typeof median !== "number" || !Number.isFinite(median) || median <= 0) return null;
    return Math.max(0, Math.round(((median - lowest) / lowest) * 100));
  })();

  const priceSuggestionRows = (() => {
    const suggestions = releaseDetails?.priceSuggestions;
    if (!suggestions) return [] as Array<{ label: string; value: number }>;
    const conditionOrder = [
      "Mint (M)",
      "Near Mint (NM or M-)",
      "Very Good Plus (VG+)",
      "Very Good (VG)",
      "Good Plus (G+)",
      "Good (G)",
      "Fair (F)",
      "Poor (P)",
    ];
    const rows = Object.entries(suggestions)
      .map(([label, value]) => {
        const amount =
          typeof value === "number" ? value : value && typeof value === "object" && typeof value.value === "number" ? value.value : null;
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
        return { label, value: amount };
      })
      .filter((row): row is { label: string; value: number } => row !== null);
    rows.sort((a, b) => {
      const ai = conditionOrder.indexOf(a.label);
      const bi = conditionOrder.indexOf(b.label);
      if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return rows.slice(0, 6);
  })();

  const primaryBandcampLink = releaseLinks?.bestBandcamp?.url?.trim() || bandcampSearchLink?.url || null;
  const fallbackShopLinks = releaseLinks?.fallback?.length
    ? releaseLinks.fallback.filter((candidate) => candidate.provider !== "discogs").slice(0, 3)
    : fallbackSearchLinks.slice(0, 3);
  const currentYoutubeUrl = current?.youtubeVideoId ? `https://www.youtube.com/watch?v=${current.youtubeVideoId}` : null;

  return {
    currentArtist,
    currentArtistLine,
    currentCatalogNumber,
    currentLabel,
    currentFormats,
    currentGenreStyles,
    expandedArtworkUrl,
    discogsReleaseUrl,
    releaseVideoUrl,
    marketCurrency,
    marketSpreadPercent,
    priceSuggestionRows,
    primaryBandcampLink,
    fallbackShopLinks,
    currentYoutubeUrl,
  };
}
