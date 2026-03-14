export const dynamic = "force-dynamic";

import { parseMutationBody, requireMutationUser } from "@/lib/api-mutation";
import { okJson } from "@/lib/api-response";
import { sourceControlActionSchema } from "@/lib/source-action-contract";
import { buildSourceControlResponse } from "@/lib/source-operations-contract";
import { runSourceControlActionForUser } from "@/lib/source-control-service";

const sourceControlSchema = sourceControlActionSchema.transform((action) => ({ action }));

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "sources-control",
    limit: 20,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;

  const parsed = await parseMutationBody(request, sourceControlSchema);
  if (parsed.response) return parsed.response;

  const result = await runSourceControlActionForUser(auth.userId, parsed.data.action);
  return okJson(buildSourceControlResponse(result));
}
