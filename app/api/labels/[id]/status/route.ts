export const dynamic = "force-dynamic";

import { z } from "zod";
import { requireSourceMutationRoute } from "@/lib/api-source-route";
import { parseMutationBody } from "@/lib/api-mutation";
import { conflictJson, errorJson, notFoundJson, okJson } from "@/lib/api-response";
import { buildSourceStatusMutationResponse } from "@/lib/source-state-contract";
import { updateSourceStatusForUser } from "@/lib/source-status-actions";

const schema = z.object({ status: z.enum(["queued", "processing", "paused", "complete", "error"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const source = await requireSourceMutationRoute(params, {
    bucket: "labels/status",
    limit: 60,
    windowSeconds: 60,
    invalidMessage: "Invalid label id",
  });
  if (source.response) return source.response;
  const payload = await parseMutationBody(request, schema);
  if (payload.response) return payload.response;

  try {
    const result = await updateSourceStatusForUser({
      userId: source.userId,
      sourceId: source.sourceId,
      status: payload.data.status,
    });
    if (!result.found) {
      return notFoundJson("Label not found");
    }
    if (result.conflict) {
      return conflictJson("Label is inactive");
    }
    return okJson(buildSourceStatusMutationResponse({
      sourceId: source.sourceId,
      status: payload.data.status,
      fallback: result.fallback,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorJson(
      {
        error: "Failed to update label status",
        detail: message,
        hint: "Run `yarn db:migrate` and restart the dev server.",
      },
      { status: 500 },
    );
  }
}
