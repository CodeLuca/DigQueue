import { YOUTUBE_QUOTA_CLEAR_EVENT, YOUTUBE_QUOTA_EVENT, YOUTUBE_QUOTA_STORAGE_KEY } from "@/lib/client-events";
import { dispatchClientEvent, subscribeClientSignalEvent } from "@/lib/client-event-bus";

export function isYouTubeQuotaExceededInSession() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(YOUTUBE_QUOTA_STORAGE_KEY) === "1";
}

export function setYouTubeQuotaExceededInSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(YOUTUBE_QUOTA_STORAGE_KEY, "1");
  dispatchClientEvent(YOUTUBE_QUOTA_EVENT);
}

export function clearYouTubeQuotaExceededInSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(YOUTUBE_QUOTA_STORAGE_KEY);
  dispatchClientEvent(YOUTUBE_QUOTA_CLEAR_EVENT);
}

export function subscribeYouTubeQuotaExceeded(handler: () => void) {
  return subscribeClientSignalEvent(YOUTUBE_QUOTA_EVENT, handler);
}

export function subscribeYouTubeQuotaCleared(handler: () => void) {
  return subscribeClientSignalEvent(YOUTUBE_QUOTA_CLEAR_EVENT, handler);
}
