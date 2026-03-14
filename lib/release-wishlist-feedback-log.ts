import { logFeedbackEvent } from "@/lib/recommendations";
import { type ReleaseWishlistSyncTarget } from "@/lib/release-wishlist-sync";

export async function logReleaseWishlistFeedbackTargets(input: {
  eventType: "record_wishlist_add" | "record_wishlist_remove";
  source: string;
  userId: string;
  targets: ReleaseWishlistSyncTarget[];
}) {
  await Promise.allSettled(
    input.targets.map((target) =>
      logFeedbackEvent({
        eventType: input.eventType,
        source: input.source,
        releaseId: target.primaryLocalReleaseId,
        externalDiscogsReleaseId: target.externalDiscogsReleaseId,
        labelId: target.primaryLabelId,
        userId: input.userId,
      }),
    ),
  );
}
