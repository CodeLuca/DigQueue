"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAY_ITEM_EVENT, YOUTUBE_QUOTA_CLEAR_EVENT, YOUTUBE_QUOTA_EVENT } from "@/lib/client-events";
import { enqueueTrackForClient } from "@/lib/client-queue";
import { QUEUE_ERROR_NO_MATCH, QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED } from "@/lib/queue-errors";
import { isYouTubeQuotaExceededInSession, setYouTubeQuotaExceededInSession } from "@/lib/youtube-quota-client";

type QueueApiItem = {
  id: number;
  youtubeVideoId: string;
  track?: { title: string } | null;
  release?: { title: string } | null;
  label?: { name: string } | null;
};

export function TrackQueueButtons({ trackId, youtubeSearchUrl }: { trackId: number; youtubeSearchUrl: string }) {
  const [loading, setLoading] = useState<"queue" | "play" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [youtubeQuotaExceeded, setYoutubeQuotaExceeded] = useState(() => isYouTubeQuotaExceededInSession());
  const router = useRouter();

  useEffect(() => {
    const onQuotaExceeded = () => {
      setYoutubeQuotaExceeded(true);
      setError("YouTube quota reached. Queue/play disabled.");
    };
    const onQuotaCleared = () => {
      setYoutubeQuotaExceeded(false);
      setError(null);
    };
    window.addEventListener(YOUTUBE_QUOTA_EVENT, onQuotaExceeded);
    window.addEventListener(YOUTUBE_QUOTA_CLEAR_EVENT, onQuotaCleared);
    return () => {
      window.removeEventListener(YOUTUBE_QUOTA_EVENT, onQuotaExceeded);
      window.removeEventListener(YOUTUBE_QUOTA_CLEAR_EVENT, onQuotaCleared);
    };
  }, []);

  const enqueue = async (playNow: boolean) => {
    if (youtubeQuotaExceeded) return;
    setLoading(playNow ? "play" : "queue");
    setError(null);
    try {
      const item = await enqueueTrackForClient<QueueApiItem>({ trackId, queueMode: playNow ? "next" : "normal" });
      if (playNow) {
        window.dispatchEvent(new CustomEvent(PLAY_ITEM_EVENT, { detail: item }));
      }
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.message === QUEUE_ERROR_NO_MATCH) {
        router.refresh();
        return;
      }
      if (err instanceof Error && err.message === QUEUE_ERROR_YOUTUBE_QUOTA_EXCEEDED) {
        setYoutubeQuotaExceeded(true);
        setError("YouTube quota reached. Queue/play disabled.");
        setYouTubeQuotaExceededInSession();
        return;
      }
      const message = err instanceof Error ? err.message : "Unable to queue this track.";
      setError(message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
        <Link
          href={youtubeSearchUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--color-border)] px-3 text-xs hover:bg-[var(--color-surface2)] sm:justify-start"
        >
          YouTube
        </Link>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full justify-center sm:w-auto sm:justify-start"
          onClick={() => void enqueue(false)}
          disabled={loading !== null || youtubeQuotaExceeded}
          title="Add to queue (plays after current/up-next items)"
          aria-label="Queue later"
        >
          {loading === "queue" ? "Queueing..." : "Queue Later"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="col-span-2 w-full justify-center sm:col-auto sm:w-auto sm:justify-start"
          onClick={() => void enqueue(true)}
          disabled={loading !== null || youtubeQuotaExceeded}
          title="Play now in the mini-player"
          aria-label="Play now"
        >
          {loading === "play" ? "..." : (
            <>
              <Play className="h-3.5 w-3.5" />
              Play Now
            </>
          )}
        </Button>
      </div>
      {error ? <p className="max-w-full text-[11px] text-rose-300 sm:max-w-[220px] sm:text-right">{error}</p> : null}
    </div>
  );
}
