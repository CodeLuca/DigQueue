"use client";

import {
  DONE_CURRENT_EVENT,
  LISTENING_SCOPE_EVENT,
  PLAY_ITEM_EVENT,
  PLAYBACK_MODE_EVENT,
  PLAYBACK_NEXT_EVENT,
  PLAYBACK_PLAYPAUSE_EVENT,
  PLAYBACK_PREV_EVENT,
  PLAYER_CURRENT_EVENT,
  REQUEST_PLAYER_CURRENT_EVENT,
  REVIEWED_CURRENT_EVENT,
} from "@/lib/client-events";
import {
  dispatchClientEvent,
  readClientEventDetail,
  subscribeClientEvent,
  subscribeClientSignalEvent,
} from "@/lib/client-event-bus";

export type PlaybackModeEventDetail = {
  mode: "in_order" | "shuffle";
};

export type ListeningScopeEventDetail = {
  enabled: boolean;
  trackIds: number[];
  activeLabelId?: number | null;
};

export type PlayerCurrentEventDetail = {
  trackId: number | null;
  queueItemId: number | null;
  saved: boolean | null;
  listened: boolean | null;
  playing: boolean;
};

export function dispatchPlaybackModeEvent(mode: PlaybackModeEventDetail["mode"]) {
  dispatchClientEvent<PlaybackModeEventDetail>(PLAYBACK_MODE_EVENT, { mode });
}

export function dispatchPlayItemEvent<TItem>(item: TItem) {
  dispatchClientEvent<TItem>(PLAY_ITEM_EVENT, item);
}

export function dispatchPlaybackPlayPauseEvent() {
  dispatchClientEvent(PLAYBACK_PLAYPAUSE_EVENT);
}

export function dispatchPlaybackNextEvent() {
  dispatchClientEvent(PLAYBACK_NEXT_EVENT);
}

export function dispatchPlaybackPrevEvent() {
  dispatchClientEvent(PLAYBACK_PREV_EVENT);
}

export function dispatchPlayerCurrentEvent(detail: PlayerCurrentEventDetail) {
  dispatchClientEvent<PlayerCurrentEventDetail>(PLAYER_CURRENT_EVENT, detail);
}

export function requestPlayerCurrentEvent() {
  dispatchClientEvent(REQUEST_PLAYER_CURRENT_EVENT);
}

export function dispatchListeningScopeEvent(detail: ListeningScopeEventDetail) {
  dispatchClientEvent<ListeningScopeEventDetail>(LISTENING_SCOPE_EVENT, detail);
}

export function dispatchReviewedCurrentEvent() {
  dispatchClientEvent(REVIEWED_CURRENT_EVENT);
}

export function getPlaybackModeEventDetail(event: Event): PlaybackModeEventDetail | null {
  const detail = readClientEventDetail<Partial<PlaybackModeEventDetail>>(event);
  if (!detail || (detail.mode !== "in_order" && detail.mode !== "shuffle")) return null;
  return { mode: detail.mode };
}

export function getListeningScopeEventDetail(event: Event): ListeningScopeEventDetail | null {
  const detail = readClientEventDetail<Partial<ListeningScopeEventDetail>>(event);
  if (!detail) return null;
  const trackIds = (detail.trackIds ?? []).filter((value): value is number => Number.isFinite(value) && value > 0);
  if (typeof detail.enabled !== "boolean") return null;
  return {
    enabled: detail.enabled,
    trackIds,
    activeLabelId: typeof detail.activeLabelId === "number" && detail.activeLabelId > 0 ? detail.activeLabelId : null,
  };
}

export function getPlayerCurrentEventDetail(event: Event): PlayerCurrentEventDetail | null {
  const detail = readClientEventDetail<Partial<PlayerCurrentEventDetail>>(event);
  if (!detail || typeof detail.playing !== "boolean") return null;
  return {
    trackId: typeof detail.trackId === "number" ? detail.trackId : null,
    queueItemId: typeof detail.queueItemId === "number" ? detail.queueItemId : null,
    saved: typeof detail.saved === "boolean" ? detail.saved : null,
    listened: typeof detail.listened === "boolean" ? detail.listened : null,
    playing: detail.playing,
  };
}

export function getPlayItemEventDetail<TItem>(event: Event): TItem | null {
  return readClientEventDetail<TItem>(event);
}

export function subscribePlaybackMode(handler: (detail: PlaybackModeEventDetail) => void) {
  return subscribeClientEvent(PLAYBACK_MODE_EVENT, handler, { parse: getPlaybackModeEventDetail });
}

export function subscribeListeningScope(handler: (detail: ListeningScopeEventDetail) => void) {
  return subscribeClientEvent(LISTENING_SCOPE_EVENT, handler, { parse: getListeningScopeEventDetail });
}

export function subscribePlayerCurrent(handler: (detail: PlayerCurrentEventDetail) => void) {
  return subscribeClientEvent(PLAYER_CURRENT_EVENT, handler, { parse: getPlayerCurrentEventDetail });
}

export function subscribePlayItem<TItem>(handler: (detail: TItem) => void) {
  return subscribeClientEvent(PLAY_ITEM_EVENT, handler, { parse: getPlayItemEventDetail<TItem> });
}

export function subscribeRequestPlayerCurrent(handler: () => void) {
  return subscribeClientSignalEvent(REQUEST_PLAYER_CURRENT_EVENT, handler);
}

export function subscribePlaybackPlayPause(handler: () => void) {
  return subscribeClientSignalEvent(PLAYBACK_PLAYPAUSE_EVENT, handler);
}

export function subscribePlaybackNext(handler: () => void) {
  return subscribeClientSignalEvent(PLAYBACK_NEXT_EVENT, handler);
}

export function subscribePlaybackPrev(handler: () => void) {
  return subscribeClientSignalEvent(PLAYBACK_PREV_EVENT, handler);
}

export function subscribeReviewedCurrent(handler: () => void) {
  const unsubscribeReviewed = subscribeClientSignalEvent(REVIEWED_CURRENT_EVENT, handler);
  const unsubscribeDone = subscribeClientSignalEvent(DONE_CURRENT_EVENT, handler);
  return () => {
    unsubscribeReviewed();
    unsubscribeDone();
  };
}
