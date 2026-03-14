import { useEffect, useState } from "react";
import {
  isYouTubeQuotaExceededInSession,
  subscribeYouTubeQuotaCleared,
  subscribeYouTubeQuotaExceeded,
} from "@/lib/youtube-quota-client";

export function useYouTubeQuotaState(options?: {
  onExceeded?: () => void;
  onCleared?: () => void;
}) {
  const [youtubeQuotaExceeded, setYoutubeQuotaExceeded] = useState(() => isYouTubeQuotaExceededInSession());

  useEffect(() => {
    const unsubscribeExceeded = subscribeYouTubeQuotaExceeded(() => {
      setYoutubeQuotaExceeded(true);
      options?.onExceeded?.();
    });
    const unsubscribeCleared = subscribeYouTubeQuotaCleared(() => {
      setYoutubeQuotaExceeded(false);
      options?.onCleared?.();
    });
    return () => {
      unsubscribeExceeded();
      unsubscribeCleared();
    };
  }, [options]);

  return {
    youtubeQuotaExceeded,
    setYoutubeQuotaExceeded,
  };
}
