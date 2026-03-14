"use client";

import {
  dispatchListeningScopeEvent,
  subscribeListeningScope,
  type ListeningScopeEventDetail,
} from "@/lib/client-playback-events";
import { createLatestClientEventStore } from "@/lib/latest-client-event-store";

const listeningScopeStore = createLatestClientEventStore<ListeningScopeEventDetail>({
  publish: dispatchListeningScopeEvent,
  subscribe: subscribeListeningScope,
});

export function publishListeningScope(detail: ListeningScopeEventDetail) {
  listeningScopeStore.publish(detail);
}

export function subscribeListeningScopeState(
  handler: (detail: ListeningScopeEventDetail) => void,
  options?: { emitLatest?: boolean },
) {
  return listeningScopeStore.subscribe(handler, options);
}

export function getLatestListeningScopeState() {
  return listeningScopeStore.getLastDetail();
}
