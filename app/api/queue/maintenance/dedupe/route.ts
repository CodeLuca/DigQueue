export const dynamic = "force-dynamic";

import { z } from "zod";
import { requireMutationUser, parseMutationBody } from "@/lib/api-mutation";
import { okJson } from "@/lib/api-response";
import { buildQueueDedupeMutationResponse } from "@/lib/queue-mutation-contract";
import { dedupePendingQueueItems } from "@/lib/queue-maintenance";

const schema = z
  .object({
    trackId: z.number().int().positive().optional(),
  })
  .optional();

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "queue/maintenance/dedupe",
    limit: 20,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const parsed = await parseMutationBody(request, schema, { fallbackBody: {} });
  if (parsed.response) return parsed.response;

  const result = await dedupePendingQueueItems(userId, {
    trackId: parsed.data?.trackId,
  });
  return okJson(buildQueueDedupeMutationResponse(result));
}
