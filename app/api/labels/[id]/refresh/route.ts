export const dynamic = "force-dynamic";

import { requireSourceMutationRoute } from "@/lib/api-source-route";
import { notFoundJson, okJson } from "@/lib/api-response";
import { buildSourceMutationResponse } from "@/lib/source-mutation-contract";
import { refreshSingleSourceMetadataForUser } from "@/lib/source-single-actions";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const source = await requireSourceMutationRoute(context.params, {
    bucket: "labels/refresh",
    limit: 45,
    windowSeconds: 60,
    invalidMessage: "Invalid source id.",
  });
  if (source.response) return source.response;

  const result = await refreshSingleSourceMetadataForUser(source.userId, source.sourceId);
  if (!result.found) {
    return notFoundJson("Source not found.");
  }
  return okJson(buildSourceMutationResponse({ sourceId: result.sourceId }));
}
