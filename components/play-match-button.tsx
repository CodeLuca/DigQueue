"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAY_ITEM_EVENT, YOUTUBE_QUOTA_CLEAR_EVENT, YOUTUBE_QUOTA_EVENT } from "@/lib/client-events";
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
      const response = await fetch("/api/queue/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, matchId, queueMode: "next" }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; item?: QueueApiItem | null; reason?: string; error?: string }
        | null;

      if (body?.reason === "youtube_quota_exceeded") {
        setYouTubeQuotaExceededInSession();
        return;
      }
      if (!response.ok || !body?.ok || !body.item) {
        return;
      }

      window.dispatchEvent(new CustomEvent(PLAY_ITEM_EVENT, { detail: body.item }));
      router.refresh();
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
