export const dynamic = "force-dynamic";

import { runUserJsonRoute } from "@/lib/api-user-route";
import { testEffectiveApiKeysForCurrentUser } from "@/lib/api-key-health";

export async function GET() {
  return runUserJsonRoute(
    async () => testEffectiveApiKeysForCurrentUser(),
    { errorMessage: "Unable to test API keys." },
  );
}
