"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type QueueApiItem = {
  id: number;
  youtubeVideoId: string;
  track?: { title: string } | null;
  release?: { title: string } | null;
  label?: { name: string } | null;
};

const YOUTUBE_QUOTA_EVENT = "digqueue:youtube-quota-exceeded";
const YOUTUBE_QUOTA_CLEAR_EVENT = "digqueue:youtube-quota-cleared";
const YOUTUBE_QUOTA_STORAGE_KEY = "digqueue:youtube-quota-exceeded";

export function TrackQueueButtons({ trackId, youtubeSearchUrl }: { trackId: number; youtubeSearchUrl: string }) {
  const [loading, setLoading] = useState<"queue" | "play" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [youtubeQuotaExceeded, setYoutubeQuotaExceeded] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(YOUTUBE_QUOTA_STORAGE_KEY) === "1";
  });
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
      const response = await fetch("/api/queue/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, queueMode: playNow ? "next" : "normal" }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; item?: QueueApiItem | null; error?: string; reason?: string }
        | null;

      if (body?.reason === "no_match") {
        router.refresh();
        return;
      }
      if (body?.reason === "youtube_quota_exceeded") {
        setYoutubeQuotaExceeded(true);
        setError("YouTube quota reached. Queue/play disabled.");
        window.sessionStorage.setItem(YOUTUBE_QUOTA_STORAGE_KEY, "1");
        window.dispatchEvent(new CustomEvent(YOUTUBE_QUOTA_EVENT));
        return;
      }

      if (!response.ok || !body?.ok || !body.item) {
        throw new Error(body?.error || "Unable to queue this track.");
      }

      if (playNow) {
        window.dispatchEvent(new CustomEvent("digqueue:play-item", { detail: body.item }));
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to queue this track.";
      setError(message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <Link
          href={youtubeSearchUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center rounded-md border border-[var(--color-border)] px-3 text-xs hover:bg-[var(--color-surface2)]"
        >
          YouTube
        </Link>
        <Button
          type="button"
          size="sm"
          variant="outline"
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
      {error ? <p className="max-w-[220px] text-right text-[11px] text-rose-300">{error}</p> : null}
    </div>
  );
}
