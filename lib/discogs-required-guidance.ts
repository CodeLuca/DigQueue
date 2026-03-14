export type DiscogsRequiredGuidanceContext =
  | "ingestion"
  | "wishlist_sync_status"
  | "wishlist_actions";

export function getDiscogsRequiredGuidance(context: DiscogsRequiredGuidanceContext) {
  switch (context) {
    case "ingestion":
      return {
        detail: "Connect Discogs to enable ingestion. YouTube is an optional fallback for releases without Discogs videos.",
        actionLabel: "Connect Discogs",
      };
    case "wishlist_sync_status":
      return {
        detail: "Connect Discogs to enable wishlist sync status.",
        actionLabel: "Connect Discogs",
      };
    case "wishlist_actions":
      return {
        detail: "Connect Discogs to sync wants and enable wishlist actions.",
        actionLabel: "Connect Discogs",
      };
  }
}
