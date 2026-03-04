"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAY_ITEM_EVENT, YOUTUBE_QUOTA_CLEAR_EVENT, YOUTUBE_QUOTA_EVENT } from "@/lib/client-events";
import { enqueueTrackForClient } from "@/lib/client-queue";
import { QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED } from "@/lib/queue-errors";
import { isYouTubeQuotaExceededInSession, setYouTubeQuotaExceededInSession } from "@/lib/youtube-quota-client";

type QueueApiItem = {
  id: number;
  youtubeVideoId: string;
};

export function PlayMatchButton({ trackId, matchId }: { trackId: number; matchId: number }) {
  const [loading, setLoading] = useState(false);
  const [youtubeQuotaExceeded, setYoutubeQuotaExceeded] = useState(() => isYouTubeQuotaExceededInSession());
  const router = useRouter();

  useEffect(() => {
    const onQuotaExceeded = () => setYoutubeQuotaExceeded(true);
    const onQuotaCleared = () => setYoutubeQuotaExceeded(false);
    window.addEventListener(YOUTUBE_QUOTA_EVENT, onQuotaExceeded);
    window.addEventListener(YOUTUBE_QUOTA_CLEAR_EVENT, onQuotaCleared);
    return () => {
      window.removeEventListener(YOUTUBE_QUOTA_EVENT, onQuotaExceeded);
      window.removeEventListener(YOUTUBE_QUOTA_CLEAR_EVENT, onQuotaCleared);
    };
  }, []);

  const onPlay = async () => {
    if (youtubeQuotaExceeded || loading) return;
    setLoading(true);
    try {
      const item = await enqueueTrackForClient<QueueApiItem>({ trackId, matchId, queueMode: "next" });
      window.dispatchEvent(new CustomEvent(PLAY_ITEM_EVENT, { detail: item }));
      router.refresh();
    } catch (error) {
      if (error instanceof Error && error.message === QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED) {
        setYouTubeQuotaExceededInSession();
        return;
      }
      // Keep existing behavior: silently ignore non-quota enqueue failures in this compact control.
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => void onPlay()}
      disabled={loading || youtubeQuotaExceeded}
      title="Play this match now in the mini-player"
      aria-label="Play match now"
    >
      {loading ? "..." : <Play className="h-3.5 w-3.5" />}
    </Button>
  );
}
