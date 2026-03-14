"use client";

import {
  dispatchPlayerCurrentEvent,
  requestPlayerCurrentEvent,
  subscribePlayerCurrent,
  type PlayerCurrentEventDetail,
} from "@/lib/client-playback-events";
import { createLatestClientEventStore } from "@/lib/latest-client-event-store";

const playerCurrentStore = createLatestClientEventStore<PlayerCurrentEventDetail>({
  publish: dispatchPlayerCurrentEvent,
  subscribe: subscribePlayerCurrent,
  onEmitLatestMiss: requestPlayerCurrentEvent,
});

export function publishPlayerCurrent(detail: PlayerCurrentEventDetail) {
  playerCurrentStore.publish(detail);
}

export function subscribePlayerCurrentState(
  handler: (detail: PlayerCurrentEventDetail) => void,
  options?: { emitLatest?: boolean },
) {
  return playerCurrentStore.subscribe(handler, options);
}

export function getLatestPlayerCurrentState() {
  return playerCurrentStore.getLastDetail();
}
