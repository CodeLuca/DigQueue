export const dynamic = "force-dynamic";

import { runUserJsonRoute } from "@/lib/api-user-route";
import { runDiscogsWantsManualSyncForUser } from "@/lib/discogs-wants-sync-service";

export async function POST() {
  return runUserJsonRoute(
    async (userId) => ({
      ok: true,
      status: await runDiscogsWantsManualSyncForUser(userId, { maxItems: 200 }),
    }),
    { errorMessage: "Unable to run manual wishlist sync." },
  );
}
