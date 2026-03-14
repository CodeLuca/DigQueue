export const dynamic = "force-dynamic";

import { requireSourceMutationRoute } from "@/lib/api-source-route";
import { notFoundJson, okJson } from "@/lib/api-response";
import { buildSourceMutationResponse } from "@/lib/source-mutation-contract";
import { deleteSourceForUser } from "@/lib/source-single-actions";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const source = await requireSourceMutationRoute(context.params, {
    bucket: "labels/delete",
    limit: 20,
    windowSeconds: 60,
    invalidMessage: "Invalid source id.",
  });
  if (source.response) return source.response;

  const result = await deleteSourceForUser(source.userId, source.sourceId);
  if (!result.found) {
    return notFoundJson("Source not found.");
  }

  return okJson(buildSourceMutationResponse({ sourceId: result.sourceId }));
}
