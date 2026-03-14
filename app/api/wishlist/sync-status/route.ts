export const dynamic = "force-dynamic";

import { runUserJsonRoute } from "@/lib/api-user-route";
import { loadDiscogsWantsSyncStatusForUser } from "@/lib/discogs-wants-sync-service";

export async function GET() {
  return runUserJsonRoute(
    async (userId) => ({
      ok: true,
      status: await loadDiscogsWantsSyncStatusForUser(userId),
    }),
    { errorMessage: "Unable to load wishlist sync status." },
  );
}
