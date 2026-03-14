export const dynamic = "force-dynamic";

import { z } from "zod";
import { parseMutationBody, requireMutationUser } from "@/lib/api-mutation";
import { okJson } from "@/lib/api-response";
import { buildIntegrationDisconnectResponse } from "@/lib/auth-mutation-contract";
import { disconnectIntegrationForCurrentUser } from "@/lib/settings-integrations";

const settingsIntegrationSchema = z.object({
  provider: z.enum(["discogs", "youtube"]),
});

export async function POST(request: Request) {
  const auth = await requireMutationUser({
    bucket: "settings-integrations",
    limit: 10,
    windowSeconds: 60,
  });
  if (auth.response) return auth.response;

  const parsed = await parseMutationBody(request, settingsIntegrationSchema);
  if (parsed.response) return parsed.response;

  const provider = await disconnectIntegrationForCurrentUser(parsed.data.provider);
  return okJson(buildIntegrationDisconnectResponse(provider));
}
