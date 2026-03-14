export type ReleaseDetailsResponse = {
  id: number;
  title: string;
  uri?: string;
  artists_sort?: string;
  artists?: Array<{ name?: string }>;
  styles?: string[];
  genres?: string[];
  country?: string;
  year?: number;
  formats?: Array<{ name?: string; descriptions?: string[] }>;
  labels?: Array<{ name?: string; catno?: string }>;
  images?: Array<{ uri?: string; uri150?: string }>;
  community?: {
    want?: number;
    have?: number;
    rating?: { average?: number; count?: number };
  };
  marketStats?: {
    lowest_price?: number | null;
    median_price?: number | null;
    num_for_sale?: number;
    blocked_from_sale?: boolean;
    currency?: string;
  } | null;
  priceSuggestions?: Record<string, { value?: number | null; currency?: string } | number | null | undefined> | null;
  tracklist?: Array<unknown>;
  videos?: Array<{ uri?: string; title?: string }>;
};

export type FinderCandidate = {
  provider: "bandcamp" | "juno" | "hardwax" | "phonica" | "discogs";
  url: string;
  title: string;
  confidence: "high" | "medium" | "low";
  score: number;
  reason: string;
};

export type FinderLinksResponse = {
  release?: {
    id: number;
    title: string;
    artist: string;
    label?: string | null;
    catno?: string | null;
  };
  bestBandcamp?: FinderCandidate | null;
  bandcamp?: FinderCandidate[];
  fallback?: FinderCandidate[];
};

export function buildReleaseDetailsResponse(
  input: ReleaseDetailsResponse,
): ReleaseDetailsResponse {
  return input;
}

export function normalizeReleaseDetailsResponse(body: unknown): ReleaseDetailsResponse {
  if (!body || typeof body !== "object" || !("id" in body) || !("title" in body)) {
    throw new Error("Unable to load release info.");
  }
  return body as ReleaseDetailsResponse;
}

export function buildFinderLinksResponse(
  input: FinderLinksResponse,
): FinderLinksResponse {
  return input;
}

export function normalizeFinderLinksResponse(body: unknown): FinderLinksResponse {
  if (!body || typeof body !== "object") {
    throw new Error("Could not find links");
  }
  return body as FinderLinksResponse;
}
