import type { ClientFetcher } from "@/lib/client-fetcher";
import { fetchRequiredClientJson } from "@/lib/client-json";
import {
  normalizeFinderLinksResponse,
  normalizeReleaseDetailsResponse,
  type FinderCandidate,
  type FinderLinksResponse,
  type ReleaseDetailsResponse,
} from "@/lib/release-data-contract";

export type ReleaseDetailsApiResponse = ReleaseDetailsResponse;
export type FinderLinksApiResponse = FinderLinksResponse;
export type { FinderCandidate };

export async function fetchReleaseDetailsClient(
  releaseId: number,
  options?: { fetcher?: ClientFetcher },
) {
  const body = await fetchRequiredClientJson<unknown>(
    `/api/discogs/release/${releaseId}`,
    undefined,
    { ...options, errorMessage: "Unable to load release info." },
  );
  return normalizeReleaseDetailsResponse(body);
}

export async function fetchReleaseFinderLinksClient(
  releaseId: number,
  options?: { fetcher?: ClientFetcher },
) {
  const body = await fetchRequiredClientJson<unknown>(
    `/api/finder/release/${releaseId}`,
    undefined,
    { ...options, errorMessage: "Could not find links" },
  );
  return normalizeFinderLinksResponse(body);
}
