export const dynamic = "force-dynamic";

import { z } from "zod";
import { requireMutationUser, parseMutationBody } from "@/lib/api-mutation";
import { errorJson, okJson } from "@/lib/api-response";
import { buildSourceIntakeResponse } from "@/lib/source-intake-contract";
import { addSourceForUser } from "@/lib/source-intake";

const schema = z.object({
  source: z.string().trim().min(1),
  entityKind: z.enum(["label", "artist"]).optional(),
});

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "sources/add",
    limit: 30,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const parsed = await parseMutationBody(request, schema);
  if (parsed.response) return parsed.response;

  try {
    const result = await addSourceForUser({
      userId,
      raw: parsed.data.source,
      requestedKind: parsed.data.entityKind ?? null,
    });
    return okJson(buildSourceIntakeResponse({
      sourceId: result.sourceId,
      entityKind: result.entityKind,
      sourceName: result.name,
    }));
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "Unable to add source.", { status: 400 });
  }
}
