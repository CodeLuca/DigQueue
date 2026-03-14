export const dynamic = "force-dynamic";

import { handlePublicIntRoute } from "@/lib/api-public-int-route";
import { fetchDiscogsRelease, fetchDiscogsReleaseMarketStats, fetchDiscogsReleasePriceSuggestions } from "@/lib/discogs";
import { buildReleaseDetailsResponse } from "@/lib/release-data-contract";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return handlePublicIntRoute({
    params,
    invalidMessage: "Invalid release id",
    fallbackErrorMessage: "Unable to load Discogs release.",
    errorStatus: 502,
    load: async (releaseId) => {
      const [release, marketStats, priceSuggestions] = await Promise.all([
        fetchDiscogsRelease(releaseId),
        fetchDiscogsReleaseMarketStats(releaseId).catch(() => null),
        fetchDiscogsReleasePriceSuggestions(releaseId).catch(() => null),
      ]);
      return buildReleaseDetailsResponse({ ...release, marketStats, priceSuggestions });
    },
  });
}
