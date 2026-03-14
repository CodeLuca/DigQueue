export const dynamic = "force-dynamic";

import { handlePublicIntRoute } from "@/lib/api-public-int-route";
import { fetchDiscogsLabelReleases } from "@/lib/discogs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return handlePublicIntRoute({
    params,
    invalidMessage: "Invalid label id",
    fallbackErrorMessage: "Unable to load label releases.",
    errorStatus: 502,
    load: fetchDiscogsLabelReleases,
  });
}
