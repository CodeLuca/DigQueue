export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireSourceMutationRoute } from "@/lib/api-source-route";
import { notFoundJson } from "@/lib/api-response";
import { buildSourceMutationResponse } from "@/lib/source-mutation-contract";
import { retrySourceForUser } from "@/lib/source-single-actions";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const source = await requireSourceMutationRoute(context.params, {
    bucket: "labels/retry",
    limit: 60,
    windowSeconds: 60,
    invalidMessage: "Invalid source id.",
  });
  if (source.response) return source.response;

  const result = await retrySourceForUser(source.userId, source.sourceId);
  if (!result.found) {
    return notFoundJson("Source not found.");
  }
  return NextResponse.json(
    { ok: !result.failed, ...buildSourceMutationResponse({ sourceId: result.sourceId, failed: result.failed }) },
    { status: result.failed ? 500 : 200 },
  );
}
