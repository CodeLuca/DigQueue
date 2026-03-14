export const dynamic = "force-dynamic";

import { z } from "zod";
import { requireMutationUser, parseMutationBody } from "@/lib/api-mutation";
import { badRequestJson, errorJson, notFoundJson } from "@/lib/api-response";
import { buildSourceProcessResponse } from "@/lib/source-state-contract";
import { attemptProcessSourceForUser } from "@/lib/source-single-actions";

const schema = z.object({
  sourceId: z.number().int().positive().optional(),
  labelId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "worker/process",
    limit: 240,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const parsed = await parseMutationBody(request, schema);
  if (parsed.response) return parsed.response;

  const sourceId = parsed.data.sourceId ?? parsed.data.labelId;
  if (!sourceId) {
    return badRequestJson("Missing sourceId");
  }

  const result = await attemptProcessSourceForUser(userId, sourceId);
  if (!result.found) {
    return notFoundJson("Source not found");
  }

  if (result.inactive) {
    return Response.json(buildSourceProcessResponse({
      sourceId,
      done: false,
      message: "Inactive",
      outcome: "inactive",
    }));
  }

  if (result.paused) {
    return Response.json(buildSourceProcessResponse({
      sourceId,
      done: false,
      message: "Paused",
      outcome: "paused",
    }));
  }

  if (result.busy) {
    return Response.json(buildSourceProcessResponse({
      sourceId,
      done: false,
      message: "Worker busy",
      outcome: "busy",
    }));
  }
  if (result.failed) {
    return errorJson(
      buildSourceProcessResponse({
        sourceId,
        done: false,
        message: result.attempt.error || "Unable to process source.",
        outcome: "failed",
      }),
      { status: 500 },
    );
  }
  return Response.json(buildSourceProcessResponse({
    sourceId,
    done: true,
    message: result.attempt.message || "Processed one source step.",
    outcome: "processed",
  }));
}
