export const dynamic = "force-dynamic";

import { z } from "zod";
import { requireSourceMutationRoute } from "@/lib/api-source-route";
import { parseMutationBody } from "@/lib/api-mutation";
import { errorJson, notFoundJson, okJson } from "@/lib/api-response";
import { buildSourceActiveMutationResponse } from "@/lib/source-state-contract";
import { updateSourceActiveForUser } from "@/lib/source-status-actions";

const schema = z.object({ active: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const source = await requireSourceMutationRoute(params, {
    bucket: "labels/active",
    limit: 60,
    windowSeconds: 60,
    invalidMessage: "Invalid label id",
  });
  if (source.response) return source.response;

  const payload = await parseMutationBody(request, schema);
  if (payload.response) return payload.response;

  try {
    const result = await updateSourceActiveForUser({
      userId: source.userId,
      sourceId: source.sourceId,
      active: payload.data.active,
    });
    if (!result.found) {
      return notFoundJson("Label not found");
    }
    return okJson(buildSourceActiveMutationResponse({
      sourceId: source.sourceId,
      active: result.active,
      status: result.status,
      fallback: result.fallback,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorJson(
      {
        error: "Failed to toggle label activation",
        detail: message,
        hint: "Run `yarn db:migrate` and restart the dev server.",
      },
      { status: 500 },
    );
  }
}
