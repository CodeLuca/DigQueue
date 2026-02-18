"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type QueueApiItem = {
  id: number;
  youtubeVideoId: string;
};

const YOUTUBE_QUOTA_EVENT = "digqueue:youtube-quota-exceeded";
const YOUTUBE_QUOTA_CLEAR_EVENT = "digqueue:youtube-quota-cleared";
const YOUTUBE_QUOTA_STORAGE_KEY = "digqueue:youtube-quota-exceeded";

export function PlayMatchButton({ trackId, matchId }: { trackId: number; matchId: number }) {
  const [loading, setLoading] = useState(false);
  const [youtubeQuotaExceeded, setYoutubeQuotaExceeded] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(YOUTUBE_QUOTA_STORAGE_KEY) === "1";
  });
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
        window.sessionStorage.setItem(YOUTUBE_QUOTA_STORAGE_KEY, "1");
        window.dispatchEvent(new CustomEvent(YOUTUBE_QUOTA_EVENT));
        return;
      }
      if (!response.ok || !body?.ok || !body.item) {
        return;
      }

      window.dispatchEvent(new CustomEvent("digqueue:play-item", { detail: body.item }));
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
