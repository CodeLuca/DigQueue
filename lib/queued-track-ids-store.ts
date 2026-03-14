"use client";

import { fetchQueuedTrackIdsClient } from "@/lib/client-queue-state";
import { subscribeQueueActivity } from "@/lib/client-queue-events";
import { createClientPollingStore } from "@/lib/client-polling-store";

type QueuedTrackIdsSubscriber = (trackIds: ReadonlySet<number>) => void;

const ACTIVE_TICK_MS = 15000;
const BACKGROUND_TICK_MS = 30000;
const ERROR_TICK_MS = 15000;
const MIN_POLL_GAP_MS = 1200;

function getNextPollDelay() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return BACKGROUND_TICK_MS;
  }
  return ACTIVE_TICK_MS;
}

const queuedTrackIdsPollingStore = createClientPollingStore<
  ReadonlySet<number>,
  QueuedTrackIdsSubscriber,
  { lastPollAt: number }
>({
  initialData: new Set<number>(),
  initialExtra: { lastPollAt: 0 },
  defaultMode: undefined,
  createSubscriber: (callback) => callback,
  notify: (subscriber, trackIds) => {
    subscriber(trackIds);
  },
  poll: async (store) => {
    store.extra.lastPollAt = Date.now();
    return await fetchQueuedTrackIdsClient({ limit: 40 });
  },
  getNextPollDelay: () => getNextPollDelay(),
  getErrorPollDelay: () => ERROR_TICK_MS,
  shouldStartPolling: (store) => Date.now() - store.extra.lastPollAt >= MIN_POLL_GAP_MS,
  bindWakeup: (wake) => {
    subscribeQueueActivity(() => wake());
  },
});

export function ensureQueuedTrackIdsPolling() {
  queuedTrackIdsPollingStore.ensurePolling();
}

export function subscribeQueuedTrackIdsClient(
  callback: QueuedTrackIdsSubscriber,
  options?: { emitLatest?: boolean },
) {
  return queuedTrackIdsPollingStore.subscribe(callback, options);
}

export function getLatestQueuedTrackIdsClient() {
  return queuedTrackIdsPollingStore.getLastData();
}
