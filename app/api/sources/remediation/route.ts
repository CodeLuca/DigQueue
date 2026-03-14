export const dynamic = "force-dynamic";

import { z } from "zod";
import { parseMutationBody, requireMutationUser } from "@/lib/api-mutation";
import { okJson } from "@/lib/api-response";
import { sourceRemediationActionSchema } from "@/lib/source-action-contract";
import { buildSourceRemediationResponse } from "@/lib/source-operations-contract";
import {
  runSourceRemediationActionForUser,
} from "@/lib/source-remediation-service";

const sourceRemediationSchema = z.object({
  action: sourceRemediationActionSchema,
  nextPath: z.string().optional(),
  category: z.string().optional(),
  actionLabel: z.string().optional(),
  scopeLabel: z.string().optional(),
  sourceIds: z.array(z.number().int().positive()).optional(),
});

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "sources-remediation",
    limit: 20,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;

  const parsed = await parseMutationBody(request, sourceRemediationSchema);
  if (parsed.response) return parsed.response;

  const result = await runSourceRemediationActionForUser({
    userId: auth.userId,
    action: parsed.data.action,
    nextPath: parsed.data.nextPath,
    category: parsed.data.category,
    actionLabel: parsed.data.actionLabel,
    scopeLabel: parsed.data.scopeLabel,
    sourceIds: parsed.data.sourceIds,
  });
  return okJson(buildSourceRemediationResponse(result));
}
