export const dynamic = "force-dynamic";

import { runUserJsonRoute } from "@/lib/api-user-route";
import {
  syncSavedTracksToDiscogsWishlistForUser,
} from "@/lib/release-wishlist-sync-service";

export async function POST() {
  return runUserJsonRoute(
    async (userId) => syncSavedTracksToDiscogsWishlistForUser(userId),
    {
      errorMessage: "Unable to sync saved tracks to Discogs wishlist.",
      rateLimit: {
        bucket: "wishlist/sync-saved",
        limit: 3,
        windowSeconds: 300,
      },
    },
  );
}
