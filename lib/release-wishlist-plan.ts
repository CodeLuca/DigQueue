export type ReleaseWishlistMode = "toggle" | "set";

export function resolveNextReleaseWishlistValue(currentWishlist: boolean, mode: ReleaseWishlistMode, value?: boolean) {
  return mode === "set" ? Boolean(value) : !currentWishlist;
}
