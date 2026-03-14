export const dynamic = "force-dynamic";

import { handlePublicIntRoute } from "@/lib/api-public-int-route";
import { findReleaseLinks } from "@/lib/finder";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return handlePublicIntRoute({
    params,
    invalidMessage: "Invalid release id",
    fallbackErrorMessage: "Finder failed",
    errorStatus: 500,
    load: findReleaseLinks,
  });
}
