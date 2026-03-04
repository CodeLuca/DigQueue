import { YOUTUBE_QUOTA_CLEAR_EVENT, YOUTUBE_QUOTA_EVENT, YOUTUBE_QUOTA_STORAGE_KEY } from "@/lib/client-events";

export function isYouTubeQuotaExceededInSession() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(YOUTUBE_QUOTA_STORAGE_KEY) === "1";
}

export function setYouTubeQuotaExceededInSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(YOUTUBE_QUOTA_STORAGE_KEY, "1");
  window.dispatchEvent(new CustomEvent(YOUTUBE_QUOTA_EVENT));
}

export function clearYouTubeQuotaExceededInSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(YOUTUBE_QUOTA_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(YOUTUBE_QUOTA_CLEAR_EVENT));
}
