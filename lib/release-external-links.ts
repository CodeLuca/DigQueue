import { toDiscogsWebUrl } from "@/lib/discogs-links";

export type ReleaseExternalLinkProvider =
  | "discogs"
  | "bandcamp_search"
  | "juno"
  | "hardwax"
  | "phonica";

export type ReleaseExternalLink = {
  provider: ReleaseExternalLinkProvider;
  title: string;
  url: string;
};

type ReleaseExternalLinkInput = {
  artist?: string | null;
  title?: string | null;
  label?: string | null;
  catno?: string | null;
  discogsUrl?: string | null;
};

function buildReleaseQuery(input: ReleaseExternalLinkInput) {
  return [input.artist, input.title].map((value) => value?.trim()).filter(Boolean).join(" ").trim();
}

export function buildReleaseExternalLinks(input: ReleaseExternalLinkInput) {
  const baseQuery = buildReleaseQuery(input);
  const discogsUrl = toDiscogsWebUrl(input.discogsUrl ?? "", "");
  const bandcampQuery = [baseQuery, input.label?.trim(), input.catno?.trim()].filter(Boolean).join(" ").trim() || baseQuery;

  return [
    {
      provider: "discogs",
      title: "Open on Discogs",
      url: discogsUrl,
    },
    {
      provider: "bandcamp_search",
      title: "Quick Bandcamp Search",
      url: `https://bandcamp.com/search?q=${encodeURIComponent(bandcampQuery)}`,
    },
    {
      provider: "juno",
      title: "Search on Juno",
      url: `https://www.juno.co.uk/search/?q[all][]=${encodeURIComponent(baseQuery)}`,
    },
    {
      provider: "hardwax",
      title: "Search on Hardwax",
      url: `https://www.hardwax.com/?search=${encodeURIComponent(baseQuery)}`,
    },
    {
      provider: "phonica",
      title: "Search on Phonica",
      url: `https://www.phonicarecords.com/search?search=${encodeURIComponent(baseQuery)}`,
    },
  ] satisfies ReleaseExternalLink[];
}
