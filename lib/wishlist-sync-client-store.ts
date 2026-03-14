"use client";

import type { WantsSyncStatus } from "@/lib/client-wishlist-sync";
import {
  fetchWishlistSyncStatusClient,
  triggerWishlistAutoSyncClient,
} from "@/lib/client-wishlist-sync";
import { subscribeWishlistSyncMutated } from "@/lib/client-wishlist-sync-events";
import { createClientPollingStore } from "@/lib/client-polling-store";

type WishlistSyncSubscriber = (status: WantsSyncStatus | null) => void;

const ACTIVE_TICK_MS = 3000;
const BACKGROUND_TICK_MS = 10000;
const ERROR_TICK_MS = 10000;

function getNextPollDelay() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return BACKGROUND_TICK_MS;
  }
  return ACTIVE_TICK_MS;
}

const wishlistSyncPollingStore = createClientPollingStore<
  WantsSyncStatus | null,
  WishlistSyncSubscriber,
  { autoSyncTick: number },
  "poll" | "auto" | "event"
>({
  initialData: null,
  initialExtra: { autoSyncTick: 0 },
  defaultMode: "poll",
  createSubscriber: (callback) => callback,
  notify: (subscriber, status) => {
    subscriber(status);
  },
  poll: async (store, mode) => {
    if (mode === "poll") {
      store.extra.autoSyncTick += 1;
    }
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      (mode === "auto" || (mode === "poll" && store.extra.autoSyncTick % 7 === 0))
    ) {
      void triggerWishlistAutoSyncClient();
    }
    return await fetchWishlistSyncStatusClient();
  },
  getNextPollDelay: () => getNextPollDelay(),
  getErrorPollDelay: () => ERROR_TICK_MS,
  shouldEmitLatest: (store, options) => options?.emitLatest !== false && store.lastData !== null,
  bindWakeup: (wake) => {
    subscribeWishlistSyncMutated(() => wake("event"));
  },
});

export function ensureWishlistSyncStatusPolling(mode: "poll" | "auto" | "event" = "poll") {
  wishlistSyncPollingStore.ensurePolling(mode);
}

export function subscribeWishlistSyncStatusClient(
  callback: WishlistSyncSubscriber,
  options?: { emitLatest?: boolean },
) {
  return wishlistSyncPollingStore.subscribe(callback, options);
}

export function getLatestWishlistSyncStatusClient() {
  return wishlistSyncPollingStore.getLastData();
}
